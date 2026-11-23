package scheduler

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"schednautix/internal/model"
	"schednautix/internal/store"
)

func TestSchedulerTagAndTaskReminders(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data.json")
	st, err := store.Open(path)
	if err != nil {
		t.Fatalf("open store: %v", err)
	}

	// Clear seeded reminders so test controls exact state.
	for _, r := range st.Snapshot().TagReminders {
		_ = st.DeleteTagReminder(r.ID)
	}
	blockID := st.Snapshot().Blocks[0].ID

	// Add a task tagged "晨会" with a single-task reminder at 09:30 on 2026-11-23 (Monday)
	_, err = st.CreateTask(model.CreateTaskInput{
		BlockID:      blockID,
		Date:         "2026-11-23",
		Title:        "同步本周研发排期 #晨会",
		ReminderTime: "09:30",
	})
	if err != nil {
		t.Fatalf("create task: %v", err)
	}

	// Add a weekday tag reminder for "晨会" at 09:30
	_, err = st.UpsertTagReminder(model.UpsertTagReminderInput{
		Tag:          "晨会",
		Time:         "09:30",
		Repeat:       model.RepeatWeekdays,
		OnlyWhenOpen: true,
		Enabled:      true,
	})
	if err != nil {
		t.Fatalf("upsert rule: %v", err)
	}

	// Add a once reminder on 2026-11-23 at 10:00
	onceRule, err := st.UpsertTagReminder(model.UpsertTagReminderInput{
		Tag:      "演示",
		Time:     "10:00",
		Repeat:   model.RepeatOnce,
		OnceDate: "2026-11-23",
		Message:  "准备桌面客户端演示",
		Enabled:  true,
	})
	if err != nil {
		t.Fatalf("upsert once rule: %v", err)
	}

	var fired []model.ReminderNotification
	sched := New(st, func(n model.ReminderNotification) {
		fired = append(fired, n)
	})

	// Sunday 09:30 should NOT trigger weekday rule
	sunday := time.Date(2026, 11, 22, 9, 30, 0, 0, time.Local)
	sched.CheckAt(sunday)
	if len(fired) != 0 {
		t.Fatalf("expected no reminders on Sunday, got %d", len(fired))
	}

	// Monday 09:30 should trigger both tag reminder and single-task reminder
	monday := time.Date(2026, 11, 23, 9, 30, 12, 0, time.Local)
	sched.CheckAt(monday)
	if len(fired) != 2 {
		t.Fatalf("expected 2 reminders on Monday 09:30, got %d: %+v", len(fired), fired)
	}
	if fired[0].Kind != "tag" || !strings.Contains(fired[0].Body, "同步本周研发排期") {
		t.Fatalf("unexpected tag reminder payload: %+v", fired[0])
	}
	if fired[1].Kind != "task" || !strings.Contains(fired[1].Body, "同步本周研发排期") {
		t.Fatalf("unexpected task reminder payload: %+v", fired[1])
	}

	// Checking again in the same minute must NOT double-fire
	sched.CheckAt(monday.Add(20 * time.Second))
	if len(fired) != 2 {
		t.Fatalf("expected dedup within same minute, got %d", len(fired))
	}

	// Monday 10:00 triggers the one-time tag reminder and disables it afterwards
	monday10 := time.Date(2026, 11, 23, 10, 0, 0, 0, time.Local)
	sched.CheckAt(monday10)
	if len(fired) != 3 {
		t.Fatalf("expected once reminder to fire, got %d", len(fired))
	}
	for _, r := range st.Snapshot().TagReminders {
		if r.ID == onceRule.ID && r.Enabled {
			t.Fatalf("expected once reminder to auto-disable after firing")
		}
	}
}
