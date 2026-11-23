package main

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"

	"schednautix/internal/model"
	"schednautix/internal/scheduler"
	"schednautix/internal/store"
)

//go:embed resources/tray.png
var trayIconPNG []byte

// Typed events pushed from Go to frontend pages.
var (
	WorkspaceChanged = mygo.NewEvent[model.WorkspaceSnapshot]("workspace:changed")
	ReminderFired    = mygo.NewEvent[model.ReminderNotification]("reminder:fired")
	QuickPanelOpened = mygo.NewEvent[bool]("quickpanel:opened")
	FocusRequested   = mygo.NewEvent[model.FocusTarget]("app:focus")
)

// AppService exposes the personal companion app's backend methods to TypeScript.
type AppService struct {
	mu             sync.RWMutex
	store          *store.Store
	sched          *scheduler.Scheduler
	mainWin        *mygo.Window
	quickPanel     *mygo.Window
	tray           *mygo.Tray
	quitting       bool
	activeShortcut string
	shortcutErr    string
}

func (a *AppService) requireStore() (*store.Store, error) {
	a.mu.RLock()
	st := a.store
	a.mu.RUnlock()
	if st == nil {
		return nil, errors.New("数据存储尚未就绪")
	}
	return st, nil
}

// GetWorkspace returns the complete current workspace snapshot.
func (a *AppService) GetWorkspace() (model.WorkspaceSnapshot, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.WorkspaceSnapshot{}, err
	}
	return st.Snapshot(), nil
}

// GetSystemStatus returns runtime info (data path, notification & shortcut status).
func (a *AppService) GetSystemStatus() (model.SystemStatus, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.SystemStatus{}, err
	}
	snap := st.Snapshot()
	a.mu.RLock()
	active := a.activeShortcut != ""
	scErr := a.shortcutErr
	a.mu.RUnlock()
	return model.SystemStatus{
		DataPath:               st.FilePath(),
		NotificationsSupported: mygo.NotificationsSupported(),
		QuickShortcut:          snap.Settings.QuickShortcut,
		ShortcutActive:         active,
		ShortcutError:          scErr,
	}, nil
}

// CreateBlock creates a new color-coded project/topic block.
func (a *AppService) CreateBlock(in model.CreateBlockInput) (model.ProjectBlock, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.ProjectBlock{}, err
	}
	return st.CreateBlock(in)
}

// UpdateBlock renames or recolors a project block.
func (a *AppService) UpdateBlock(in model.UpdateBlockInput) (model.ProjectBlock, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.ProjectBlock{}, err
	}
	return st.UpdateBlock(in)
}

// DeleteBlock removes a color block and optionally moves its tasks to another block.
func (a *AppService) DeleteBlock(blockID string, moveTasksToBlockID string) error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	return st.DeleteBlock(blockID, moveTasksToBlockID)
}

// ReorderBlocks updates project block order.
func (a *AppService) ReorderBlocks(orderedIDs []string) error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	return st.ReorderBlocks(orderedIDs)
}

// CreateTask creates a daily task inside a color block.
func (a *AppService) CreateTask(in model.CreateTaskInput) (model.Task, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.Task{}, err
	}
	return st.CreateTask(in)
}

// UpdateTask modifies an existing task.
func (a *AppService) UpdateTask(in model.UpdateTaskInput) (model.Task, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.Task{}, err
	}
	return st.UpdateTask(in)
}

// ToggleTask toggles a task's completion status.
func (a *AppService) ToggleTask(taskID string) (model.Task, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.Task{}, err
	}
	return st.ToggleTask(taskID)
}

// DeleteTask deletes a task.
func (a *AppService) DeleteTask(taskID string) error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	return st.DeleteTask(taskID)
}

// CarryOverTasks moves unfinished tasks from fromDate to toDate.
func (a *AppService) CarryOverTasks(fromDate string, toDate string) (int, error) {
	st, err := a.requireStore()
	if err != nil {
		return 0, err
	}
	return st.CarryOverTasks(fromDate, toDate)
}

// CreateNote adds a quick capture entry to the scratchpad ("随手记").
func (a *AppService) CreateNote(in model.CreateNoteInput) (model.QuickNote, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.QuickNote{}, err
	}
	return st.CreateNote(in)
}

// UpdateNote updates a quick note.
func (a *AppService) UpdateNote(in model.UpdateNoteInput) (model.QuickNote, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.QuickNote{}, err
	}
	return st.UpdateNote(in)
}

// TogglePinNote pins or unpins a quick note.
func (a *AppService) TogglePinNote(noteID string) (model.QuickNote, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.QuickNote{}, err
	}
	return st.TogglePinNote(noteID)
}

// DeleteNote deletes a quick note.
func (a *AppService) DeleteNote(noteID string) error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	return st.DeleteNote(noteID)
}

// ConvertNoteToTask turns a quick note into a daily task inside a color block.
func (a *AppService) ConvertNoteToTask(in model.ConvertNoteInput) (model.Task, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.Task{}, err
	}
	return st.ConvertNoteToTask(in)
}

// AddTag adds a tag to the known tag list.
func (a *AppService) AddTag(tag string) (string, error) {
	st, err := a.requireStore()
	if err != nil {
		return "", err
	}
	return st.AddKnownTag(tag)
}

// UpsertTagReminder creates or updates a tag-based scheduled reminder rule.
func (a *AppService) UpsertTagReminder(in model.UpsertTagReminderInput) (model.TagReminder, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.TagReminder{}, err
	}
	return st.UpsertTagReminder(in)
}

// ToggleTagReminder enables or disables a tag reminder rule.
func (a *AppService) ToggleTagReminder(id string, enabled bool) (model.TagReminder, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.TagReminder{}, err
	}
	return st.ToggleTagReminder(id, enabled)
}

// DeleteTagReminder removes a tag reminder rule.
func (a *AppService) DeleteTagReminder(id string) error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	return st.DeleteTagReminder(id)
}

// TestTagReminder fires a real preview notification for a specific tag rule (or general test).
func (a *AppService) TestTagReminder(ruleID string) (model.ReminderNotification, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.ReminderNotification{}, err
	}
	snap := st.Snapshot()
	title := "随身记 · 提醒通知测试"
	body := "通知通道正常！到达设定时间后，系统会按你的 Tag 规则准时提醒。"
	tag := ""

	if ruleID != "" {
		for _, r := range snap.TagReminders {
			if r.ID == ruleID {
				title, body = scheduler.BuildTagPreview(snap, r, time.Now())
				title = "[测试] " + title
				tag = r.Tag
				break
			}
		}
	}

	notif := model.ReminderNotification{
		ID:      fmt.Sprintf("test:%d", time.Now().UnixNano()),
		Kind:    "test",
		Title:   title,
		Body:    body,
		Tag:     tag,
		FiredAt: time.Now().Format(time.RFC3339),
	}
	a.dispatchNotification(notif)
	return notif, nil
}

// UpdateThemeMode applies and persists the light/dark/system theme mode.
func (a *AppService) UpdateThemeMode(mode model.ThemeMode) (model.AppSettings, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.AppSettings{}, err
	}
	snap := st.Snapshot()
	snap.Settings.ThemeMode = mode
	updated, err := st.UpdateSettings(snap.Settings)
	if err != nil {
		return model.AppSettings{}, err
	}
	applyTheme(updated.ThemeMode)
	return updated, nil
}

// UpdateQuickShortcut changes and re-registers the global floating capture shortcut.
func (a *AppService) UpdateQuickShortcut(shortcut string) (model.SystemStatus, error) {
	st, err := a.requireStore()
	if err != nil {
		return model.SystemStatus{}, err
	}
	sc := strings.TrimSpace(shortcut)
	if sc == "" {
		return model.SystemStatus{}, errors.New("快捷键不能为空")
	}

	if err := a.registerShortcut(sc); err != nil {
		return model.SystemStatus{}, fmt.Errorf("快捷键注册失败（可能已被其他应用占用）：%w", err)
	}

	snap := st.Snapshot()
	snap.Settings.QuickShortcut = sc
	if _, err := st.UpdateSettings(snap.Settings); err != nil {
		return model.SystemStatus{}, err
	}
	return a.GetSystemStatus()
}

// ShowQuickPanel summons the floating quick-capture panel from the UI.
func (a *AppService) ShowQuickPanel() {
	a.showQuickPanel()
}

// HideQuickPanel hides the floating quick-capture panel.
func (a *AppService) HideQuickPanel() {
	a.mu.RLock()
	p := a.quickPanel
	a.mu.RUnlock()
	if p != nil && !p.IsDestroyed() {
		p.Hide()
	}
}

// OpenMainWindow brings the main workspace window to front.
func (a *AppService) OpenMainWindow() {
	a.showMainWindow(model.FocusTarget{})
}

// RevealDataFile opens the local data.json file in Finder / Explorer.
func (a *AppService) RevealDataFile() error {
	st, err := a.requireStore()
	if err != nil {
		return err
	}
	mygo.Shell.ShowItemInFolder(st.FilePath())
	return nil
}

// ExportBackup prompts the user for a path and saves a JSON snapshot backup.
func (a *AppService) ExportBackup(ctx context.Context) (string, error) {
	st, err := a.requireStore()
	if err != nil {
		return "", err
	}
	defaultName := fmt.Sprintf("schednautix-backup-%s.json", time.Now().Format("2006-01-02"))
	path, err := mygo.Dialog.Save(mygo.SaveDialogOptions{
		Parent:      mygo.CallerWindow(ctx),
		Title:       "导出随身记备份",
		DefaultPath: defaultName,
		Filters:     []mygo.FileFilter{{Name: "JSON 备份文件", Extensions: []string{"json"}}},
	})
	if err != nil || path == "" {
		return "", err
	}
	raw, err := st.ExportJSON()
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, raw, 0o600); err != nil {
		return "", err
	}
	return path, nil
}

func (a *AppService) initRuntime() error {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return fmt.Errorf("resolve user data dir: %w", err)
	}
	dataPath := filepath.Join(dir, "data.json")
	st, err := store.Open(dataPath)
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}

	st.SetOnChange(func(snap model.WorkspaceSnapshot) {
		WorkspaceChanged.Broadcast(snap)
	})

	sched := scheduler.New(st, func(n model.ReminderNotification) {
		a.dispatchNotification(n)
	})

	a.mu.Lock()
	a.store = st
	a.sched = sched
	a.mu.Unlock()

	snap := st.Snapshot()
	applyTheme(snap.Settings.ThemeMode)

	a.setupMenuBar()
	a.setupMainWindow()
	a.setupQuickPanel()
	a.setupTray(snap.Settings.QuickShortcut)

	if err := a.registerShortcut(snap.Settings.QuickShortcut); err != nil {
		log.Printf("global shortcut %q registration warning: %v", snap.Settings.QuickShortcut, err)
	}

	mygo.Power.OnResume(func() {
		go sched.CheckNow()
	})
	mygo.App.OnDidBecomeActive(func() {
		mygo.ClearNotifications()
	})

	sched.Start()
	return nil
}

func (a *AppService) setupMenuBar() {
	mygo.App.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu},
		{Label: "文件", Submenu: []*mygo.MenuItem{
			{Label: "打开主界面", Accelerator: "CmdOrCtrl+1", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.showMainWindow(model.FocusTarget{})
			}},
			{Label: "呼出悬浮速记", Accelerator: "CmdOrCtrl+Shift+N", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.toggleQuickPanel()
			}},
			mygo.Separator(),
			{Role: mygo.RoleClose},
		}},
		{Role: mygo.RoleEditMenu},
		{Role: mygo.RoleViewMenu},
		{Role: mygo.RoleWindowMenu},
	}))
}

func (a *AppService) setupMainWindow() {
	win := mygo.NewWindow(mygo.WindowOptions{
		Title:           "随身记 · SchedNautix",
		URL:             "/",
		Width:           1120,
		Height:          740,
		MinWidth:        820,
		MinHeight:       540,
		StateKey:        "main",
		Hidden:          true,
		TitleBarStyle:   mygo.TitleBarHiddenInset,
		TitleBarHeight:  48,
		BackgroundColor: "light-dark(#f7f6f3, #161618)",
	})
	win.OnReadyToShow(func() {
		if !mygo.App.WasOpenedAtLogin() {
			win.Show()
		}
	})
	win.OnClose(func(e *mygo.CloseEvent) {
		a.mu.RLock()
		quitting := a.quitting
		a.mu.RUnlock()
		if !quitting {
			// Keep running quietly in tray so reminders and quick capture stay active.
			e.PreventDefault()
			win.Hide()
		}
	})

	a.mu.Lock()
	a.mainWin = win
	a.mu.Unlock()
}

func (a *AppService) setupQuickPanel() {
	panel := mygo.NewWindow(mygo.WindowOptions{
		Title:           "随手速记",
		URL:             "/quick",
		Panel:           true,
		Hidden:          true,
		Frameless:       true,
		Transparent:     true,
		CornerRadius:    18,
		Width:           560,
		Height:          284,
		DisableResize:   true,
		BackgroundColor: "light-dark(#ffffff, #202024)",
	})
	panel.OnClose(func(e *mygo.CloseEvent) {
		a.mu.RLock()
		quitting := a.quitting
		a.mu.RUnlock()
		if !quitting {
			e.PreventDefault()
			panel.Hide()
		}
	})
	panel.OnBlur(func() {
		panel.Hide()
	})

	a.mu.Lock()
	a.quickPanel = panel
	a.mu.Unlock()
}

func (a *AppService) setupTray(shortcut string) {
	tray, err := mygo.NewTray(mygo.TrayOptions{
		ID:             "schednautix-tray",
		Icon:           trayIconPNG,
		IconIsTemplate: true,
		ToolTip:        "随身记 · SchedNautix",
		Menu: mygo.NewMenu([]*mygo.MenuItem{
			{Label: "打开随身记主界面", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.showMainWindow(model.FocusTarget{})
			}},
			{ID: "quick-capture", Label: fmt.Sprintf("悬浮速记 (%s)", shortcut), Click: func(*mygo.MenuItem, *mygo.Window) {
				a.showQuickPanel()
			}},
			mygo.Separator(),
			{Role: mygo.RoleQuit, Label: "退出随身记"},
		}),
	})
	if err != nil {
		log.Println("tray init warning:", err)
		return
	}
	a.mu.Lock()
	a.tray = tray
	a.mu.Unlock()
}

func (a *AppService) registerShortcut(shortcut string) error {
	a.mu.Lock()
	prev := a.activeShortcut
	a.mu.Unlock()

	if prev != "" {
		mygo.GlobalShortcut.Unregister(prev)
	}
	if err := mygo.GlobalShortcut.Register(shortcut, func() {
		a.toggleQuickPanel()
	}); err != nil {
		// Restore previous shortcut if available.
		if prev != "" && prev != shortcut {
			_ = mygo.GlobalShortcut.Register(prev, func() { a.toggleQuickPanel() })
		}
		a.mu.Lock()
		a.shortcutErr = err.Error()
		a.mu.Unlock()
		return err
	}

	a.mu.Lock()
	a.activeShortcut = shortcut
	a.shortcutErr = ""
	tray := a.tray
	a.mu.Unlock()

	if tray != nil {
		tray.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
			{Label: "打开随身记主界面", Click: func(*mygo.MenuItem, *mygo.Window) {
				a.showMainWindow(model.FocusTarget{})
			}},
			{ID: "quick-capture", Label: fmt.Sprintf("悬浮速记 (%s)", shortcut), Click: func(*mygo.MenuItem, *mygo.Window) {
				a.showQuickPanel()
			}},
			mygo.Separator(),
			{Role: mygo.RoleQuit, Label: "退出随身记"},
		}))
	}
	return nil
}

func (a *AppService) toggleQuickPanel() {
	a.mu.RLock()
	p := a.quickPanel
	a.mu.RUnlock()
	if p == nil || p.IsDestroyed() {
		return
	}
	if p.IsVisible() {
		p.Hide()
	} else {
		a.showQuickPanel()
	}
}

func (a *AppService) showQuickPanel() {
	a.mu.RLock()
	p := a.quickPanel
	a.mu.RUnlock()
	if p == nil || p.IsDestroyed() {
		return
	}
	d := mygo.Screen.DisplayNearestPoint(mygo.Screen.CursorScreenPoint())
	w, h := p.Size()
	x := d.WorkArea.X + (d.WorkArea.Width-w)/2
	y := d.WorkArea.Y + max((d.WorkArea.Height-h)/4, 48)
	p.SetPosition(x, y)
	p.Show()
	p.Focus()
	_ = QuickPanelOpened.Emit(p, true)
}

func (a *AppService) showMainWindow(target model.FocusTarget) {
	a.mu.RLock()
	win := a.mainWin
	a.mu.RUnlock()
	if win == nil || win.IsDestroyed() {
		a.setupMainWindow()
		a.mu.RLock()
		win = a.mainWin
		a.mu.RUnlock()
	}
	if win != nil {
		if win.IsMinimized() {
			win.Restore()
		}
		win.Show()
		win.Focus()
		if target.Date != "" || target.Tag != "" || target.TaskID != "" {
			_ = FocusRequested.Emit(win, target)
		}
	}
}

func (a *AppService) dispatchNotification(notif model.ReminderNotification) {
	if mygo.NotificationsSupported() {
		n := mygo.NewNotification(mygo.NotificationOptions{
			ID:    notif.ID,
			Title: notif.Title,
			Body:  notif.Body,
		})
		n.OnClick(func() {
			a.showMainWindow(model.FocusTarget{
				Date:   notif.TaskDate,
				Tag:    notif.Tag,
				TaskID: notif.TaskID,
			})
			n.Close()
		})
		if err := n.Show(); err != nil {
			notif.OSNotified = false
			if errors.Is(err, mygo.ErrNotificationsDenied) {
				notif.OSNotifyErr = "系统通知权限未开启，请在系统设置中允许 SchedNautix 发送通知"
			} else {
				notif.OSNotifyErr = err.Error()
			}
		} else {
			notif.OSNotified = true
		}
	} else {
		notif.OSNotified = false
		notif.OSNotifyErr = "当前运行环境不支持系统原生通知（请使用 mygo dev 或打包应用运行）"
	}

	ReminderFired.Broadcast(notif)
}

func applyTheme(mode model.ThemeMode) {
	switch mode {
	case model.ThemeDark:
		mygo.Theme.SetSource(mygo.ThemeDark)
	case model.ThemeLight:
		mygo.Theme.SetSource(mygo.ThemeLight)
	default:
		mygo.Theme.SetSource(mygo.ThemeSystem)
	}
}

func main() {
	svc := &AppService{}
	mygo.Bind(svc)

	// Allow mygo generate to inspect bindings without taking single-instance locks or touching files.
	if os.Getenv("MYGO_GENERATE") == "" {
		if !mygo.App.RequestSingleInstanceLock() {
			return
		}
	}

	mygo.App.OnSecondInstance(func([]string, string) {
		svc.showMainWindow(model.FocusTarget{})
	})
	mygo.App.OnWindowAllClosed(func() {})
	mygo.App.OnActivate(func(hasVisibleWindows bool) {
		if !hasVisibleWindows {
			svc.showMainWindow(model.FocusTarget{})
		}
	})
	mygo.App.OnNotificationClick(func(id string) {
		svc.showMainWindow(model.FocusTarget{})
	})
	mygo.App.OnBeforeQuit(func(*mygo.QuitEvent) {
		svc.mu.Lock()
		svc.quitting = true
		sched := svc.sched
		svc.mu.Unlock()
		if sched != nil {
			sched.Stop()
		}
	})
	mygo.App.OnQuitCanceled(func() {
		svc.mu.Lock()
		svc.quitting = false
		svc.mu.Unlock()
	})
	mygo.App.WhenReady(func() {
		if err := svc.initRuntime(); err != nil {
			log.Printf("init runtime failed: %v", err)
			mygo.Dialog.Error("随身记启动失败", err.Error())
			mygo.App.Quit()
		}
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
