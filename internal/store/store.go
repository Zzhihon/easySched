package store

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"schednautix/internal/model"
)

const (
	currentSchemaVersion = 1
	DefaultQuickShortcut = "Alt+Shift+Space"
)

var (
	validColors = map[model.ColorKey]bool{
		model.ColorSky:    true,
		model.ColorSage:   true,
		model.ColorAmber:  true,
		model.ColorRose:   true,
		model.ColorViolet: true,
		model.ColorTeal:   true,
		model.ColorCoral:  true,
		model.ColorStone:  true,
	}
	hhmmPattern   = regexp.MustCompile(`^([01]\d|2[0-3]):([0-5]\d)$`)
	datePattern   = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	inlineTagExpr = regexp.MustCompile(`(?:^|\s)#([^\s#@,，。；;、!！?？()（）\[\]【】]+)`)
)

// Store manages thread-safe local JSON persistence for the personal companion app.
type Store struct {
	mu       sync.RWMutex
	filePath string
	data     model.WorkspaceSnapshot
	onChange func(model.WorkspaceSnapshot)
	now      func() time.Time
}

// Open loads an existing workspace file or seeds a welcoming initial workspace.
func Open(filePath string) (*Store, error) {
	return openWithClock(filePath, time.Now)
}

func openWithClock(filePath string, clock func() time.Time) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	s := &Store{
		filePath: filePath,
		now:      clock,
	}

	raw, err := os.ReadFile(filePath)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("read data file: %w", err)
		}
		s.data = seedWorkspace(clock())
		if err := s.saveLocked(); err != nil {
			return nil, err
		}
		return s, nil
	}

	var loaded model.WorkspaceSnapshot
	if err := json.Unmarshal(raw, &loaded); err != nil {
		return nil, fmt.Errorf("parse data file: %w", err)
	}
	s.data = normalizeWorkspace(loaded, clock())
	return s, nil
}

// SetOnChange registers a callback invoked after any persisted mutation.
func (s *Store) SetOnChange(fn func(model.WorkspaceSnapshot)) {
	s.mu.Lock()
	s.onChange = fn
	s.mu.Unlock()
}

// FilePath returns the local JSON data file path.
func (s *Store) FilePath() string {
	return s.filePath
}

// Snapshot returns a deep copy of the current workspace state.
func (s *Store) Snapshot() model.WorkspaceSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneSnapshot(s.data)
}

// CreateBlock adds a new color-coded project/topic block.
func (s *Store) CreateBlock(in model.CreateBlockInput) (model.ProjectBlock, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return model.ProjectBlock{}, errors.New("项目/色块名称不能为空")
	}
	color := normalizeColor(in.Color)

	s.mu.Lock()
	maxOrder := -1
	for _, b := range s.data.Blocks {
		if b.Order > maxOrder {
			maxOrder = b.Order
		}
	}
	block := model.ProjectBlock{
		ID:        newID("blk"),
		Name:      name,
		Color:     color,
		Order:     maxOrder + 1,
		CreatedAt: s.now().Format(time.RFC3339),
	}
	s.data.Blocks = append(s.data.Blocks, block)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.ProjectBlock{}, err
	}
	s.emit(snap)
	return block, nil
}

// UpdateBlock renames or recolors an existing color block.
func (s *Store) UpdateBlock(in model.UpdateBlockInput) (model.ProjectBlock, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return model.ProjectBlock{}, errors.New("项目/色块名称不能为空")
	}
	color := normalizeColor(in.Color)

	s.mu.Lock()
	idx := -1
	for i := range s.data.Blocks {
		if s.data.Blocks[i].ID == in.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.ProjectBlock{}, errors.New("未找到对应色块")
	}
	s.data.Blocks[idx].Name = name
	s.data.Blocks[idx].Color = color
	updated := s.data.Blocks[idx]
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.ProjectBlock{}, err
	}
	s.emit(snap)
	return updated, nil
}

// DeleteBlock removes a color block and deletes or reassigns its tasks to another block.
func (s *Store) DeleteBlock(blockID string, moveTasksToBlockID string) error {
	s.mu.Lock()
	if len(s.data.Blocks) <= 1 {
		s.mu.Unlock()
		return errors.New("至少保留一个色块分区")
	}
	idx := -1
	for i := range s.data.Blocks {
		if s.data.Blocks[i].ID == blockID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return errors.New("未找到对应色块")
	}

	targetBlockID := moveTasksToBlockID
	if targetBlockID != "" {
		foundTarget := false
		for _, b := range s.data.Blocks {
			if b.ID == targetBlockID && b.ID != blockID {
				foundTarget = true
				break
			}
		}
		if !foundTarget {
			targetBlockID = ""
		}
	}

	s.data.Blocks = append(s.data.Blocks[:idx], s.data.Blocks[idx+1:]...)
	if targetBlockID != "" {
		for i := range s.data.Tasks {
			if s.data.Tasks[i].BlockID == blockID {
				s.data.Tasks[i].BlockID = targetBlockID
			}
		}
	} else {
		kept := s.data.Tasks[:0]
		for _, t := range s.data.Tasks {
			if t.BlockID != blockID {
				kept = append(kept, t)
			}
		}
		s.data.Tasks = kept
	}

	s.rebuildKnownTagsLocked()
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// ReorderBlocks updates the display order of project blocks.
func (s *Store) ReorderBlocks(orderedIDs []string) error {
	s.mu.Lock()
	orderMap := make(map[string]int, len(orderedIDs))
	for i, id := range orderedIDs {
		orderMap[id] = i
	}
	next := len(orderedIDs)
	for i := range s.data.Blocks {
		if pos, ok := orderMap[s.data.Blocks[i].ID]; ok {
			s.data.Blocks[i].Order = pos
		} else {
			s.data.Blocks[i].Order = next
			next++
		}
	}
	sort.SliceStable(s.data.Blocks, func(i, j int) bool {
		return s.data.Blocks[i].Order < s.data.Blocks[j].Order
	})
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// CreateTask adds a task under a color block for a given day, automatically parsing #tags.
func (s *Store) CreateTask(in model.CreateTaskInput) (model.Task, error) {
	cleanedTitle, parsedTags := ExtractTagsFromTaskTitle(in.Title)
	if cleanedTitle == "" {
		return model.Task{}, errors.New("任务内容不能为空")
	}
	dateStr := strings.TrimSpace(in.Date)
	if dateStr == "" {
		dateStr = s.now().Format("2006-01-02")
	}
	if !datePattern.MatchString(dateStr) {
		return model.Task{}, errors.New("日期格式需为 YYYY-MM-DD")
	}
	reminderTime := strings.TrimSpace(in.ReminderTime)
	if reminderTime != "" && !hhmmPattern.MatchString(reminderTime) {
		return model.Task{}, errors.New("提醒时间格式需为 HH:MM")
	}

	tags := MergeTags(in.Tags, parsedTags)

	s.mu.Lock()
	blockID := in.BlockID
	if !s.hasBlockLocked(blockID) {
		if len(s.data.Blocks) == 0 {
			s.mu.Unlock()
			return model.Task{}, errors.New("请先创建一个色块分区")
		}
		blockID = s.data.Blocks[0].ID
	}

	maxOrder := -1
	for _, t := range s.data.Tasks {
		if t.BlockID == blockID && t.Date == dateStr && t.Order > maxOrder {
			maxOrder = t.Order
		}
	}

	task := model.Task{
		ID:           newID("tsk"),
		BlockID:      blockID,
		Date:         dateStr,
		Title:        cleanedTitle,
		Note:         strings.TrimSpace(in.Note),
		Done:         false,
		Tags:         tags,
		ReminderTime: reminderTime,
		Order:        maxOrder + 1,
		CreatedAt:    s.now().Format(time.RFC3339),
	}
	s.data.Tasks = append(s.data.Tasks, task)
	s.addKnownTagsLocked(tags)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.Task{}, err
	}
	s.emit(snap)
	return task, nil
}

// UpdateTask modifies an existing task's text, tags, color block, date, done state, or reminder.
func (s *Store) UpdateTask(in model.UpdateTaskInput) (model.Task, error) {
	cleanedTitle, parsedTags := ExtractTagsFromTaskTitle(in.Title)
	if cleanedTitle == "" {
		return model.Task{}, errors.New("任务内容不能为空")
	}
	if in.Date != "" && !datePattern.MatchString(in.Date) {
		return model.Task{}, errors.New("日期格式需为 YYYY-MM-DD")
	}
	reminderTime := strings.TrimSpace(in.ReminderTime)
	if reminderTime != "" && !hhmmPattern.MatchString(reminderTime) {
		return model.Task{}, errors.New("提醒时间格式需为 HH:MM")
	}

	s.mu.Lock()
	idx := -1
	for i := range s.data.Tasks {
		if s.data.Tasks[i].ID == in.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.Task{}, errors.New("未找到对应任务")
	}

	t := &s.data.Tasks[idx]
	if in.BlockID != "" && s.hasBlockLocked(in.BlockID) {
		t.BlockID = in.BlockID
	}
	if in.Date != "" && in.Date != t.Date {
		t.Date = in.Date
		t.ReminderFiredAt = ""
	}
	t.Title = cleanedTitle
	t.Note = strings.TrimSpace(in.Note)
	t.Tags = MergeTags(in.Tags, parsedTags)

	if reminderTime != t.ReminderTime {
		t.ReminderTime = reminderTime
		t.ReminderFiredAt = ""
	}
	if in.Done != t.Done {
		t.Done = in.Done
		if in.Done {
			t.CompletedAt = s.now().Format(time.RFC3339)
		} else {
			t.CompletedAt = ""
		}
	}

	updated := cloneTask(*t)
	s.addKnownTagsLocked(updated.Tags)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.Task{}, err
	}
	s.emit(snap)
	return updated, nil
}

// ToggleTask flips a task's completion status.
func (s *Store) ToggleTask(taskID string) (model.Task, error) {
	s.mu.Lock()
	idx := -1
	for i := range s.data.Tasks {
		if s.data.Tasks[i].ID == taskID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.Task{}, errors.New("未找到对应任务")
	}
	t := &s.data.Tasks[idx]
	t.Done = !t.Done
	if t.Done {
		t.CompletedAt = s.now().Format(time.RFC3339)
	} else {
		t.CompletedAt = ""
	}
	updated := cloneTask(*t)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.Task{}, err
	}
	s.emit(snap)
	return updated, nil
}

// DeleteTask deletes a task by ID.
func (s *Store) DeleteTask(taskID string) error {
	s.mu.Lock()
	idx := -1
	for i := range s.data.Tasks {
		if s.data.Tasks[i].ID == taskID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return nil
	}
	s.data.Tasks = append(s.data.Tasks[:idx], s.data.Tasks[idx+1:]...)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// CarryOverTasks moves all unfinished tasks from fromDate into toDate.
func (s *Store) CarryOverTasks(fromDate, toDate string) (int, error) {
	if !datePattern.MatchString(fromDate) || !datePattern.MatchString(toDate) {
		return 0, errors.New("日期格式需为 YYYY-MM-DD")
	}
	if fromDate == toDate {
		return 0, nil
	}
	s.mu.Lock()
	moved := 0
	for i := range s.data.Tasks {
		t := &s.data.Tasks[i]
		if t.Date == fromDate && !t.Done {
			t.Date = toDate
			t.ReminderFiredAt = ""
			moved++
		}
	}
	if moved == 0 {
		s.mu.Unlock()
		return 0, nil
	}
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return 0, err
	}
	s.emit(snap)
	return moved, nil
}

// CreateNote appends a new entry to the anytime scratchpad ("随手记"), extracting inline #tags.
func (s *Store) CreateNote(in model.CreateNoteInput) (model.QuickNote, error) {
	content := strings.TrimSpace(in.Content)
	if content == "" {
		return model.QuickNote{}, errors.New("记录内容不能为空")
	}
	extracted := ExtractTagsFromText(content)
	tags := MergeTags(in.Tags, extracted)
	nowStr := s.now().Format(time.RFC3339)

	note := model.QuickNote{
		ID:        newID("nte"),
		Content:   content,
		Tags:      tags,
		CreatedAt: nowStr,
		UpdatedAt: nowStr,
	}

	s.mu.Lock()
	s.data.Notes = append([]model.QuickNote{note}, s.data.Notes...)
	s.addKnownTagsLocked(tags)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.QuickNote{}, err
	}
	s.emit(snap)
	return note, nil
}

// UpdateNote updates an existing quick note's text, tags, or pin status.
func (s *Store) UpdateNote(in model.UpdateNoteInput) (model.QuickNote, error) {
	content := strings.TrimSpace(in.Content)
	if content == "" {
		return model.QuickNote{}, errors.New("记录内容不能为空")
	}
	extracted := ExtractTagsFromText(content)
	tags := MergeTags(in.Tags, extracted)

	s.mu.Lock()
	idx := -1
	for i := range s.data.Notes {
		if s.data.Notes[i].ID == in.ID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.QuickNote{}, errors.New("未找到对应随手记")
	}
	n := &s.data.Notes[idx]
	n.Content = content
	n.Tags = tags
	n.Pinned = in.Pinned
	n.UpdatedAt = s.now().Format(time.RFC3339)
	updated := cloneNote(*n)
	s.addKnownTagsLocked(tags)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.QuickNote{}, err
	}
	s.emit(snap)
	return updated, nil
}

// TogglePinNote pins or unpins a quick note.
func (s *Store) TogglePinNote(noteID string) (model.QuickNote, error) {
	s.mu.Lock()
	idx := -1
	for i := range s.data.Notes {
		if s.data.Notes[i].ID == noteID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.QuickNote{}, errors.New("未找到对应随手记")
	}
	s.data.Notes[idx].Pinned = !s.data.Notes[idx].Pinned
	updated := cloneNote(s.data.Notes[idx])
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.QuickNote{}, err
	}
	s.emit(snap)
	return updated, nil
}

// DeleteNote deletes a quick note by ID.
func (s *Store) DeleteNote(noteID string) error {
	s.mu.Lock()
	idx := -1
	for i := range s.data.Notes {
		if s.data.Notes[i].ID == noteID {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return nil
	}
	s.data.Notes = append(s.data.Notes[:idx], s.data.Notes[idx+1:]...)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// ConvertNoteToTask turns a quick note into a daily task in the chosen color block.
func (s *Store) ConvertNoteToTask(in model.ConvertNoteInput) (model.Task, error) {
	dateStr := strings.TrimSpace(in.Date)
	if dateStr == "" {
		dateStr = s.now().Format("2006-01-02")
	}
	if !datePattern.MatchString(dateStr) {
		return model.Task{}, errors.New("日期格式需为 YYYY-MM-DD")
	}
	reminderTime := strings.TrimSpace(in.ReminderTime)
	if reminderTime != "" && !hhmmPattern.MatchString(reminderTime) {
		return model.Task{}, errors.New("提醒时间格式需为 HH:MM")
	}

	s.mu.Lock()
	noteIdx := -1
	for i := range s.data.Notes {
		if s.data.Notes[i].ID == in.NoteID {
			noteIdx = i
			break
		}
	}
	if noteIdx < 0 {
		s.mu.Unlock()
		return model.Task{}, errors.New("未找到对应随手记")
	}
	note := s.data.Notes[noteIdx]
	blockID := in.BlockID
	if !s.hasBlockLocked(blockID) && len(s.data.Blocks) > 0 {
		blockID = s.data.Blocks[0].ID
	}

	// First line becomes the task title; subsequent lines become the task's note.
	lines := strings.Split(strings.ReplaceAll(note.Content, "\r\n", "\n"), "\n")
	rawTitle := strings.TrimSpace(lines[0])
	rest := ""
	if len(lines) > 1 {
		rest = strings.TrimSpace(strings.Join(lines[1:], "\n"))
	}
	cleanedTitle, parsedTags := ExtractTagsFromTaskTitle(rawTitle)
	if cleanedTitle == "" {
		cleanedTitle = strings.TrimSpace(note.Content)
	}
	tags := MergeTags(note.Tags, parsedTags)

	maxOrder := -1
	for _, t := range s.data.Tasks {
		if t.BlockID == blockID && t.Date == dateStr && t.Order > maxOrder {
			maxOrder = t.Order
		}
	}

	task := model.Task{
		ID:           newID("tsk"),
		BlockID:      blockID,
		Date:         dateStr,
		Title:        cleanedTitle,
		Note:         rest,
		Done:         false,
		Tags:         tags,
		ReminderTime: reminderTime,
		Order:        maxOrder + 1,
		CreatedAt:    s.now().Format(time.RFC3339),
	}
	s.data.Tasks = append(s.data.Tasks, task)
	if in.DeleteNote {
		s.data.Notes = append(s.data.Notes[:noteIdx], s.data.Notes[noteIdx+1:]...)
	}
	s.addKnownTagsLocked(tags)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.Task{}, err
	}
	s.emit(snap)
	return task, nil
}

// AddKnownTag registers a tag so it appears in tag pickers even before tasks use it.
func (s *Store) AddKnownTag(raw string) (string, error) {
	tag := NormalizeTag(raw)
	if tag == "" {
		return "", errors.New("标签名不能为空")
	}
	s.mu.Lock()
	s.addKnownTagsLocked([]string{tag})
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return "", err
	}
	s.emit(snap)
	return tag, nil
}

// UpsertTagReminder creates or updates a scheduled notification rule bound to a tag.
func (s *Store) UpsertTagReminder(in model.UpsertTagReminderInput) (model.TagReminder, error) {
	tag := NormalizeTag(in.Tag)
	if tag == "" {
		return model.TagReminder{}, errors.New("请选择或输入需要提醒的标签")
	}
	tStr := strings.TrimSpace(in.Time)
	if !hhmmPattern.MatchString(tStr) {
		return model.TagReminder{}, errors.New("提醒时间格式需为 HH:MM")
	}
	repeat := in.Repeat
	if repeat == "" {
		repeat = model.RepeatDaily
	}
	var days []int
	onceDate := strings.TrimSpace(in.OnceDate)
	switch repeat {
	case model.RepeatDaily, model.RepeatWeekdays:
		// ok
	case model.RepeatCustom:
		seen := map[int]bool{}
		for _, d := range in.DaysOfWeek {
			if d >= 0 && d <= 6 && !seen[d] {
				seen[d] = true
				days = append(days, d)
			}
		}
		sort.Ints(days)
		if len(days) == 0 {
			return model.TagReminder{}, errors.New("自定义周期请至少选择一个星期")
		}
	case model.RepeatOnce:
		if onceDate == "" {
			onceDate = s.now().Format("2006-01-02")
		}
		if !datePattern.MatchString(onceDate) {
			return model.TagReminder{}, errors.New("单次提醒日期格式需为 YYYY-MM-DD")
		}
	default:
		return model.TagReminder{}, errors.New("不支持的重复周期类型")
	}

	s.mu.Lock()
	var saved model.TagReminder
	if in.ID != "" {
		idx := -1
		for i := range s.data.TagReminders {
			if s.data.TagReminders[i].ID == in.ID {
				idx = i
				break
			}
		}
		if idx < 0 {
			s.mu.Unlock()
			return model.TagReminder{}, errors.New("未找到对应提醒规则")
		}
		r := &s.data.TagReminders[idx]
		scheduleChanged := r.Time != tStr || r.Repeat != repeat || r.OnceDate != onceDate
		r.Tag = tag
		r.Time = tStr
		r.Repeat = repeat
		r.DaysOfWeek = days
		r.OnceDate = onceDate
		r.OnlyWhenOpen = in.OnlyWhenOpen
		r.Message = strings.TrimSpace(in.Message)
		r.Enabled = in.Enabled
		if scheduleChanged {
			r.LastFiredKey = ""
		}
		saved = cloneTagReminder(*r)
	} else {
		saved = model.TagReminder{
			ID:           newID("rem"),
			Tag:          tag,
			Time:         tStr,
			Repeat:       repeat,
			DaysOfWeek:   days,
			OnceDate:     onceDate,
			OnlyWhenOpen: in.OnlyWhenOpen,
			Message:      strings.TrimSpace(in.Message),
			Enabled:      in.Enabled,
			CreatedAt:    s.now().Format(time.RFC3339),
		}
		s.data.TagReminders = append(s.data.TagReminders, saved)
	}

	s.addKnownTagsLocked([]string{tag})
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.TagReminder{}, err
	}
	s.emit(snap)
	return saved, nil
}

// ToggleTagReminder enables or disables a tag reminder rule.
func (s *Store) ToggleTagReminder(id string, enabled bool) (model.TagReminder, error) {
	s.mu.Lock()
	idx := -1
	for i := range s.data.TagReminders {
		if s.data.TagReminders[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return model.TagReminder{}, errors.New("未找到对应提醒规则")
	}
	s.data.TagReminders[idx].Enabled = enabled
	updated := cloneTagReminder(s.data.TagReminders[idx])
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.TagReminder{}, err
	}
	s.emit(snap)
	return updated, nil
}

// DeleteTagReminder removes a tag reminder rule by ID.
func (s *Store) DeleteTagReminder(id string) error {
	s.mu.Lock()
	idx := -1
	for i := range s.data.TagReminders {
		if s.data.TagReminders[i].ID == id {
			idx = i
			break
		}
	}
	if idx < 0 {
		s.mu.Unlock()
		return nil
	}
	s.data.TagReminders = append(s.data.TagReminders[:idx], s.data.TagReminders[idx+1:]...)
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// MarkTagReminderFired persists LastFiredKey so the same minute never double-fires.
func (s *Store) MarkTagReminderFired(id, firedKey string, disableOnce bool) error {
	s.mu.Lock()
	changed := false
	for i := range s.data.TagReminders {
		if s.data.TagReminders[i].ID == id {
			s.data.TagReminders[i].LastFiredKey = firedKey
			if disableOnce && s.data.TagReminders[i].Repeat == model.RepeatOnce {
				s.data.TagReminders[i].Enabled = false
			}
			changed = true
			break
		}
	}
	if !changed {
		s.mu.Unlock()
		return nil
	}
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// MarkTaskReminderFired persists ReminderFiredAt on a single task.
func (s *Store) MarkTaskReminderFired(taskID, firedKey string) error {
	s.mu.Lock()
	changed := false
	for i := range s.data.Tasks {
		if s.data.Tasks[i].ID == taskID {
			s.data.Tasks[i].ReminderFiredAt = firedKey
			changed = true
			break
		}
	}
	if !changed {
		s.mu.Unlock()
		return nil
	}
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return err
	}
	s.emit(snap)
	return nil
}

// UpdateSettings saves app settings such as shortcut and theme preference.
func (s *Store) UpdateSettings(settings model.AppSettings) (model.AppSettings, error) {
	s.mu.Lock()
	if strings.TrimSpace(settings.QuickShortcut) != "" {
		s.data.Settings.QuickShortcut = strings.TrimSpace(settings.QuickShortcut)
	}
	switch settings.ThemeMode {
	case model.ThemeLight, model.ThemeDark, model.ThemeSystem:
		s.data.Settings.ThemeMode = settings.ThemeMode
	}
	updated := s.data.Settings
	snap, err := s.commitLocked()
	s.mu.Unlock()
	if err != nil {
		return model.AppSettings{}, err
	}
	s.emit(snap)
	return updated, nil
}

// ExportJSON returns a pretty-printed JSON backup of the workspace.
func (s *Store) ExportJSON() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return json.MarshalIndent(s.data, "", "  ")
}

func (s *Store) hasBlockLocked(id string) bool {
	for _, b := range s.data.Blocks {
		if b.ID == id {
			return true
		}
	}
	return false
}

func (s *Store) addKnownTagsLocked(tags []string) {
	s.data.KnownTags = MergeTags(s.data.KnownTags, tags)
}

func (s *Store) rebuildKnownTagsLocked() {
	all := slices.Clone(s.data.KnownTags)
	for _, t := range s.data.Tasks {
		all = append(all, t.Tags...)
	}
	for _, n := range s.data.Notes {
		all = append(all, n.Tags...)
	}
	for _, r := range s.data.TagReminders {
		all = append(all, r.Tag)
	}
	s.data.KnownTags = MergeTags(all, nil)
}

func (s *Store) commitLocked() (model.WorkspaceSnapshot, error) {
	if err := s.saveLocked(); err != nil {
		return model.WorkspaceSnapshot{}, err
	}
	return cloneSnapshot(s.data), nil
}

func (s *Store) saveLocked() error {
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("encode data: %w", err)
	}
	tmp := s.filePath + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := os.Rename(tmp, s.filePath); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("commit data file: %w", err)
	}
	return nil
}

func (s *Store) emit(snap model.WorkspaceSnapshot) {
	s.mu.RLock()
	fn := s.onChange
	s.mu.RUnlock()
	if fn != nil {
		fn(snap)
	}
}

// NormalizeTag cleans a tag string by trimming whitespace and leading '#'.
func NormalizeTag(raw string) string {
	t := strings.TrimSpace(raw)
	t = strings.TrimLeft(t, "#")
	t = strings.TrimSpace(t)
	return t
}

// ExtractTagsFromText finds inline #tag occurrences without modifying the text.
func ExtractTagsFromText(text string) []string {
	matches := inlineTagExpr.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil
	}
	tags := make([]string, 0, len(matches))
	for _, m := range matches {
		if len(m) > 1 {
			if norm := NormalizeTag(m[1]); norm != "" {
				tags = append(tags, norm)
			}
		}
	}
	return MergeTags(tags, nil)
}

// ExtractTagsFromTaskTitle extracts #tags and strips standalone inline #tags from the task title
// unless stripping them would leave the title empty.
func ExtractTagsFromTaskTitle(raw string) (string, []string) {
	trimmed := strings.TrimSpace(raw)
	tags := ExtractTagsFromText(trimmed)
	if len(tags) == 0 {
		return trimmed, nil
	}
	stripped := inlineTagExpr.ReplaceAllString(trimmed, " ")
	stripped = strings.Join(strings.Fields(stripped), " ")
	if stripped == "" {
		return trimmed, tags
	}
	return stripped, tags
}

// MergeTags normalizes, deduplicates, and preserves stable alphabetical/case-insensitive uniqueness.
func MergeTags(a, b []string) []string {
	seen := make(map[string]bool, len(a)+len(b))
	out := make([]string, 0, len(a)+len(b))
	for _, list := range [][]string{a, b} {
		for _, raw := range list {
			t := NormalizeTag(raw)
			if t == "" {
				continue
			}
			key := strings.ToLower(t)
			if !seen[key] {
				seen[key] = true
				out = append(out, t)
			}
		}
	}
	return out
}

func normalizeColor(c model.ColorKey) model.ColorKey {
	if validColors[c] {
		return c
	}
	return model.ColorSky
}

func newID(prefix string) string {
	var b [6]byte
	_, _ = rand.Read(b[:])
	return prefix + "_" + hex.EncodeToString(b[:])
}

func normalizeWorkspace(w model.WorkspaceSnapshot, now time.Time) model.WorkspaceSnapshot {
	if w.Version == 0 {
		w.Version = currentSchemaVersion
	}
	if w.Blocks == nil {
		w.Blocks = []model.ProjectBlock{}
	}
	if len(w.Blocks) == 0 {
		w.Blocks = []model.ProjectBlock{{
			ID:        newID("blk"),
			Name:      "日常事项",
			Color:     model.ColorSky,
			Order:     0,
			CreatedAt: now.Format(time.RFC3339),
		}}
	}
	for i := range w.Blocks {
		w.Blocks[i].Color = normalizeColor(w.Blocks[i].Color)
	}
	if w.Tasks == nil {
		w.Tasks = []model.Task{}
	}
	for i := range w.Tasks {
		if w.Tasks[i].Tags == nil {
			w.Tasks[i].Tags = []string{}
		}
	}
	if w.Notes == nil {
		w.Notes = []model.QuickNote{}
	}
	for i := range w.Notes {
		if w.Notes[i].Tags == nil {
			w.Notes[i].Tags = []string{}
		}
	}
	if w.TagReminders == nil {
		w.TagReminders = []model.TagReminder{}
	}
	if strings.TrimSpace(w.Settings.QuickShortcut) == "" {
		w.Settings.QuickShortcut = DefaultQuickShortcut
	}
	if w.Settings.ThemeMode == "" {
		w.Settings.ThemeMode = model.ThemeSystem
	}
	allTags := slices.Clone(w.KnownTags)
	for _, t := range w.Tasks {
		allTags = append(allTags, t.Tags...)
	}
	for _, n := range w.Notes {
		allTags = append(allTags, n.Tags...)
	}
	for _, r := range w.TagReminders {
		allTags = append(allTags, r.Tag)
	}
	w.KnownTags = MergeTags(allTags, nil)
	return w
}

func seedWorkspace(now time.Time) model.WorkspaceSnapshot {
	today := now.Format("2006-01-02")
	nowISO := now.Format(time.RFC3339)

	workID := newID("blk")
	lifeID := newID("blk")
	studyID := newID("blk")

	return model.WorkspaceSnapshot{
		Version: currentSchemaVersion,
		Blocks: []model.ProjectBlock{
			{ID: workID, Name: "工作推进", Color: model.ColorSky, Order: 0, CreatedAt: nowISO},
			{ID: lifeID, Name: "个人与生活", Color: model.ColorSage, Order: 1, CreatedAt: nowISO},
			{ID: studyID, Name: "学习与复盘", Color: model.ColorAmber, Order: 2, CreatedAt: nowISO},
		},
		Tasks: []model.Task{
			{
				ID:        newID("tsk"),
				BlockID:   workID,
				Date:      today,
				Title:     "梳理本周重点议题并确认优先级",
				Tags:      []string{"工作", "晨间"},
				Order:     0,
				CreatedAt: nowISO,
			},
			{
				ID:           newID("tsk"),
				BlockID:      workID,
				Date:         today,
				Title:        "整理进度同步与待办清单",
				Tags:         []string{"日报"},
				ReminderTime: "17:30",
				Order:        1,
				CreatedAt:    nowISO,
			},
			{
				ID:        newID("tsk"),
				BlockID:   lifeID,
				Date:      today,
				Title:     "傍晚散步或拉伸 20 分钟",
				Tags:      []string{"健康"},
				Order:     0,
				CreatedAt: nowISO,
			},
			{
				ID:        newID("tsk"),
				BlockID:   studyID,
				Date:      today,
				Title:     "记录一条今天最有价值的想法",
				Tags:      []string{"复盘"},
				Order:     0,
				CreatedAt: nowISO,
			},
		},
		Notes: []model.QuickNote{
			{
				ID:        newID("nte"),
				Content:   "欢迎使用随身记！随时在这里写下灵感或备忘，输入 #标签 会自动归类，悬停还可一键转为今日任务。#使用提示",
				Tags:      []string{"使用提示"},
				Pinned:    true,
				CreatedAt: nowISO,
				UpdatedAt: nowISO,
			},
			{
				ID:        newID("nte"),
				Content:   "快捷键 Alt+Shift+Space 可在任何界面呼出悬浮速记框，记完按 Esc 立刻回到当前工作。",
				Tags:      []string{"使用提示"},
				CreatedAt: nowISO,
				UpdatedAt: nowISO,
			},
		},
		TagReminders: []model.TagReminder{
			{
				ID:           newID("rem"),
				Tag:          "日报",
				Time:         "17:30",
				Repeat:       model.RepeatWeekdays,
				OnlyWhenOpen: false,
				Message:      "工作日下班前花 3 分钟梳理一下今天的产出",
				Enabled:      true,
				CreatedAt:    nowISO,
			},
		},
		Settings: model.AppSettings{
			QuickShortcut: DefaultQuickShortcut,
			ThemeMode:     model.ThemeSystem,
		},
		KnownTags: []string{"工作", "晨间", "日报", "健康", "复盘", "使用提示"},
	}
}

func cloneSnapshot(s model.WorkspaceSnapshot) model.WorkspaceSnapshot {
	out := model.WorkspaceSnapshot{
		Version:      s.Version,
		Blocks:       slices.Clone(s.Blocks),
		Tasks:        make([]model.Task, len(s.Tasks)),
		Notes:        make([]model.QuickNote, len(s.Notes)),
		TagReminders: make([]model.TagReminder, len(s.TagReminders)),
		Settings:     s.Settings,
		KnownTags:    slices.Clone(s.KnownTags),
	}
	for i, t := range s.Tasks {
		out.Tasks[i] = cloneTask(t)
	}
	for i, n := range s.Notes {
		out.Notes[i] = cloneNote(n)
	}
	for i, r := range s.TagReminders {
		out.TagReminders[i] = cloneTagReminder(r)
	}
	return out
}

func cloneTask(t model.Task) model.Task {
	t.Tags = slices.Clone(t.Tags)
	if t.Tags == nil {
		t.Tags = []string{}
	}
	return t
}

func cloneNote(n model.QuickNote) model.QuickNote {
	n.Tags = slices.Clone(n.Tags)
	if n.Tags == nil {
		n.Tags = []string{}
	}
	return n
}

func cloneTagReminder(r model.TagReminder) model.TagReminder {
	r.DaysOfWeek = slices.Clone(r.DaysOfWeek)
	return r
}
