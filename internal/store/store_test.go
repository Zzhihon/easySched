package store

import (
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"schednautix/internal/model"
)

func TestStoreLifecycleAndPersistence(t *testing.T) {
	fixedNow := time.Date(2026, 11, 23, 15, 30, 0, 0, time.Local)
	path := filepath.Join(t.TempDir(), "data.json")

	s, err := openWithClock(path, func() time.Time { return fixedNow })
	if err != nil {
		t.Fatalf("open seed store: %v", err)
	}

	snap := s.Snapshot()
	if len(snap.Blocks) != 3 {
		t.Fatalf("expected 3 starter blocks, got %d", len(snap.Blocks))
	}
	if len(snap.Tasks) == 0 || len(snap.Notes) == 0 {
		t.Fatalf("expected starter tasks and notes")
	}

	// Create a new color block
	blk, err := s.CreateBlock(model.CreateBlockInput{Name: "Q4 发布", Color: model.ColorRose})
	if err != nil {
		t.Fatalf("create block: %v", err)
	}
	if blk.Color != model.ColorRose {
		t.Fatalf("expected rose color, got %s", blk.Color)
	}

	// Create a task with inline #tags
	tsk, err := s.CreateTask(model.CreateTaskInput{
		BlockID:      blk.ID,
		Date:         "2026-11-23",
		Title:        "确认发版检查表 #发布 #重要",
		ReminderTime: "16:00",
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}
	if tsk.Title != "确认发版检查表" {
		t.Fatalf("expected stripped title, got %q", tsk.Title)
	}
	if !reflect.DeepEqual(tsk.Tags, []string{"发布", "重要"}) {
		t.Fatalf("unexpected tags: %#v", tsk.Tags)
	}

	// Create a quick note and convert it to a task
	note, err := s.CreateNote(model.CreateNoteInput{
		Content: "顺手记录一下接口超时阈值\n需要压测核对 #性能",
	})
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if !reflect.DeepEqual(note.Tags, []string{"性能"}) {
		t.Fatalf("expected extracted note tag, got %#v", note.Tags)
	}

	converted, err := s.ConvertNoteToTask(model.ConvertNoteInput{
		NoteID:     note.ID,
		BlockID:    blk.ID,
		Date:       "2026-11-23",
		DeleteNote: true,
	})
	if err != nil {
		t.Fatalf("convert note: %v", err)
	}
	if converted.Title != "顺手记录一下接口超时阈值" || converted.Note != "需要压测核对 #性能" {
		t.Fatalf("unexpected converted task: %+v", converted)
	}
	if !reflect.DeepEqual(converted.Tags, []string{"性能"}) {
		t.Fatalf("expected tags carried to converted task, got %#v", converted.Tags)
	}

	// Re-open from disk and verify persistence
	reopened, err := openWithClock(path, func() time.Time { return fixedNow })
	if err != nil {
		t.Fatalf("reopen store: %v", err)
	}
	snap2 := reopened.Snapshot()
	if len(snap2.Blocks) != 4 {
		t.Fatalf("expected 4 persisted blocks, got %d", len(snap2.Blocks))
	}
}

func TestCarryOverAndTagReminders(t *testing.T) {
	fixedNow := time.Date(2026, 11, 23, 9, 0, 0, 0, time.Local)
	path := filepath.Join(t.TempDir(), "data.json")
	s, err := openWithClock(path, func() time.Time { return fixedNow })
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	blockID := s.Snapshot().Blocks[0].ID

	t1, _ := s.CreateTask(model.CreateTaskInput{BlockID: blockID, Date: "2026-11-22", Title: "昨日未完成"})
	t2, _ := s.CreateTask(model.CreateTaskInput{BlockID: blockID, Date: "2026-11-22", Title: "昨日已完成"})
	_, _ = s.ToggleTask(t2.ID)

	moved, err := s.CarryOverTasks("2026-11-22", "2026-11-23")
	if err != nil {
		t.Fatalf("carry over: %v", err)
	}
	if moved != 1 {
		t.Fatalf("expected 1 moved task, got %d", moved)
	}
	for _, task := range s.Snapshot().Tasks {
		if task.ID == t1.ID && task.Date != "2026-11-23" {
			t.Fatalf("expected unfinished task moved to today, got %s", task.Date)
		}
		if task.ID == t2.ID && task.Date != "2026-11-22" {
			t.Fatalf("expected completed task to stay on yesterday, got %s", task.Date)
		}
	}

	rule, err := s.UpsertTagReminder(model.UpsertTagReminderInput{
		Tag:        "#周报",
		Time:       "18:00",
		Repeat:     model.RepeatCustom,
		DaysOfWeek: []int{5, 1},
		Enabled:    true,
	})
	if err != nil {
		t.Fatalf("upsert reminder: %v", err)
	}
	if rule.Tag != "周报" || !reflect.DeepEqual(rule.DaysOfWeek, []int{1, 5}) {
		t.Fatalf("unexpected reminder rule: %+v", rule)
	}
}
