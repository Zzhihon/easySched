package scheduler

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"schednautix/internal/model"
	"schednautix/internal/store"
)

// FireFunc is called whenever a tag reminder or single-task reminder becomes due.
type FireFunc func(n model.ReminderNotification)

// Scheduler periodically evaluates TagReminder rules and per-task reminders.
type Scheduler struct {
	store  *store.Store
	onFire FireFunc
	now    func() time.Time

	mu     sync.Mutex
	cancel context.CancelFunc
}

// New creates a reminder scheduler backed by the local store.
func New(st *store.Store, onFire FireFunc) *Scheduler {
	return &Scheduler{
		store:  st,
		onFire: onFire,
		now:    time.Now,
	}
}

// Start runs the background ticker loop until Stop is called.
func (s *Scheduler) Start() {
	s.mu.Lock()
	if s.cancel != nil {
		s.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.mu.Unlock()

	go func() {
		// Check shortly after launch, then every 15 seconds.
		s.CheckNow()
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.CheckNow()
			}
		}
	}()
}

// Stop halts the background loop.
func (s *Scheduler) Stop() {
	s.mu.Lock()
	cancel := s.cancel
	s.cancel = nil
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// CheckNow evaluates all due tag rules and single-task reminders at the current minute.
func (s *Scheduler) CheckNow() {
	s.CheckAt(s.now())
}

// CheckAt evaluates due reminders for a specific timestamp (exported for unit tests).
func (s *Scheduler) CheckAt(now time.Time) {
	snap := s.store.Snapshot()
	blockNames := make(map[string]string, len(snap.Blocks))
	for _, b := range snap.Blocks {
		blockNames[b.ID] = b.Name
	}

	dateStr := now.Format("2006-01-02")
	hhmm := now.Format("15:04")
	firedKey := dateStr + "T" + hhmm

	// 1. Evaluate Tag Reminder Rules.
	for _, rule := range snap.TagReminders {
		if !rule.Enabled {
			continue
		}
		if rule.LastFiredKey == firedKey {
			continue
		}
		if !ruleMatchesTime(rule, now) {
			continue
		}

		openTasks := findOpenTasksByTag(snap.Tasks, rule.Tag, dateStr)
		if rule.OnlyWhenOpen && len(openTasks) == 0 {
			// Mark skipped for this minute so we don't keep checking within the same minute.
			_ = s.store.MarkTagReminderFired(rule.ID, firedKey, false)
			continue
		}

		body := buildTagReminderBody(rule, openTasks, countNotesByTag(snap.Notes, rule.Tag))
		notif := model.ReminderNotification{
			ID:      fmt.Sprintf("tag:%s:%s", rule.ID, firedKey),
			Kind:    "tag",
			Title:   fmt.Sprintf("#%s 定时提醒", rule.Tag),
			Body:    body,
			Tag:     rule.Tag,
			FiredAt: now.Format(time.RFC3339),
		}

		_ = s.store.MarkTagReminderFired(rule.ID, firedKey, true)
		if s.onFire != nil {
			s.onFire(notif)
		}
	}

	// 2. Evaluate Single-Task Reminders.
	for _, task := range snap.Tasks {
		if task.Done || task.ReminderTime == "" {
			continue
		}
		if task.Date != dateStr || task.ReminderTime != hhmm {
			continue
		}
		if task.ReminderFiredAt == firedKey {
			continue
		}

		blockName := blockNames[task.BlockID]
		title := "任务提醒"
		if blockName != "" {
			title = fmt.Sprintf("任务提醒 · %s", blockName)
		}
		body := task.Title
		if len(task.Tags) > 0 {
			tagList := make([]string, len(task.Tags))
			for i, tg := range task.Tags {
				tagList[i] = "#" + tg
			}
			body = fmt.Sprintf("%s  (%s)", task.Title, strings.Join(tagList, " "))
		}

		notif := model.ReminderNotification{
			ID:       fmt.Sprintf("task:%s:%s", task.ID, firedKey),
			Kind:     "task",
			Title:    title,
			Body:     body,
			TaskID:   task.ID,
			TaskDate: task.Date,
			FiredAt:  now.Format(time.RFC3339),
		}

		_ = s.store.MarkTaskReminderFired(task.ID, firedKey)
		if s.onFire != nil {
			s.onFire(notif)
		}
	}
}

// BuildTagPreview formats what a tag reminder notification would show right now.
func BuildTagPreview(snap model.WorkspaceSnapshot, rule model.TagReminder, now time.Time) (string, string) {
	dateStr := now.Format("2006-01-02")
	openTasks := findOpenTasksByTag(snap.Tasks, rule.Tag, dateStr)
	title := fmt.Sprintf("#%s 提醒", rule.Tag)
	body := buildTagReminderBody(rule, openTasks, countNotesByTag(snap.Notes, rule.Tag))
	return title, body
}

func ruleMatchesTime(rule model.TagReminder, now time.Time) bool {
	if rule.Time != now.Format("15:04") {
		return false
	}
	switch rule.Repeat {
	case model.RepeatDaily:
		return true
	case model.RepeatWeekdays:
		wd := now.Weekday()
		return wd >= time.Monday && wd <= time.Friday
	case model.RepeatCustom:
		return slices.Contains(rule.DaysOfWeek, int(now.Weekday()))
	case model.RepeatOnce:
		return rule.OnceDate == now.Format("2006-01-02")
	default:
		return false
	}
}

func findOpenTasksByTag(tasks []model.Task, tag, upToDate string) []model.Task {
	want := strings.ToLower(store.NormalizeTag(tag))
	var out []model.Task
	for _, t := range tasks {
		if t.Done {
			continue
		}
		if t.Date > upToDate {
			continue
		}
		for _, tg := range t.Tags {
			if strings.ToLower(tg) == want {
				out = append(out, t)
				break
			}
		}
	}
	return out
}

func countNotesByTag(notes []model.QuickNote, tag string) int {
	want := strings.ToLower(store.NormalizeTag(tag))
	count := 0
	for _, n := range notes {
		for _, tg := range n.Tags {
			if strings.ToLower(tg) == want {
				count++
				break
			}
		}
	}
	return count
}

func buildTagReminderBody(rule model.TagReminder, openTasks []model.Task, noteCount int) string {
	var parts []string
	if msg := strings.TrimSpace(rule.Message); msg != "" {
		parts = append(parts, msg)
	}
	if len(openTasks) > 0 {
		limit := min(len(openTasks), 3)
		titles := make([]string, 0, limit)
		for i := range limit {
			titles = append(titles, "· "+openTasks[i].Title)
		}
		header := fmt.Sprintf("当前有 %d 项待处理任务：", len(openTasks))
		if len(openTasks) > limit {
			titles = append(titles, fmt.Sprintf("… 等共 %d 项", len(openTasks)))
		}
		parts = append(parts, header+"\n"+strings.Join(titles, "\n"))
	} else if noteCount > 0 {
		parts = append(parts, fmt.Sprintf("暂无未完成任务，随手记中有 %d 条 #%s 记录可供查看。", noteCount, rule.Tag))
	} else if len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("到点关注 #%s 相关事项啦。", rule.Tag))
	}
	return strings.Join(parts, "\n")
}
