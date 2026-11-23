package model

// ColorKey identifies one of the curated pastel color block palettes.
type ColorKey string

const (
	ColorSky    ColorKey = "sky"
	ColorSage   ColorKey = "sage"
	ColorAmber  ColorKey = "amber"
	ColorRose   ColorKey = "rose"
	ColorViolet ColorKey = "violet"
	ColorTeal   ColorKey = "teal"
	ColorCoral  ColorKey = "coral"
	ColorStone  ColorKey = "stone"
)

// RepeatType defines the schedule cadence for a tag reminder rule.
type RepeatType string

const (
	RepeatDaily    RepeatType = "daily"
	RepeatWeekdays RepeatType = "weekdays"
	RepeatCustom   RepeatType = "custom"
	RepeatOnce     RepeatType = "once"
)

// ThemeMode selects the color appearance of the desktop app.
type ThemeMode string

const (
	ThemeSystem ThemeMode = "system"
	ThemeLight  ThemeMode = "light"
	ThemeDark   ThemeMode = "dark"
)

// ProjectBlock represents a color-coded project or topic block grouping daily tasks.
type ProjectBlock struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Color     ColorKey `json:"color"`
	Order     int      `json:"order"`
	Archived  bool     `json:"archived,omitempty"`
	CreatedAt string   `json:"createdAt"`
}

// Task represents a daily task inside a color-coded ProjectBlock.
type Task struct {
	ID              string   `json:"id"`
	BlockID         string   `json:"blockId"`
	Date            string   `json:"date"` // YYYY-MM-DD
	Title           string   `json:"title"`
	Note            string   `json:"note,omitempty"`
	Done            bool     `json:"done"`
	Tags            []string `json:"tags"`
	ReminderTime    string   `json:"reminderTime,omitempty"`    // HH:MM on Date
	ReminderFiredAt string   `json:"reminderFiredAt,omitempty"` // YYYY-MM-DDTHH:MM
	Order           int      `json:"order"`
	CreatedAt       string   `json:"createdAt"`
	CompletedAt     string   `json:"completedAt,omitempty"`
}

// QuickNote represents a fleeting thought or memo in the always-available scratchpad ("随手记").
type QuickNote struct {
	ID        string   `json:"id"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
	Pinned    bool     `json:"pinned,omitempty"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

// TagReminder defines a scheduled notification rule attached to a tag.
type TagReminder struct {
	ID           string     `json:"id"`
	Tag          string     `json:"tag"`                    // normalized without leading '#'
	Time         string     `json:"time"`                   // HH:MM (24-hour)
	Repeat       RepeatType `json:"repeat"`                 // daily | weekdays | custom | once
	DaysOfWeek   []int      `json:"daysOfWeek,omitempty"`   // 0=Sun .. 6=Sat when repeat=="custom"
	OnceDate     string     `json:"onceDate,omitempty"`     // YYYY-MM-DD when repeat=="once"
	OnlyWhenOpen bool       `json:"onlyWhenOpen,omitempty"` // skip if no open tasks match tag
	Message      string     `json:"message,omitempty"`      // optional custom note
	Enabled      bool       `json:"enabled"`
	LastFiredKey string     `json:"lastFiredKey,omitempty"` // YYYY-MM-DDTHH:MM
	CreatedAt    string     `json:"createdAt"`
}

// AppSettings stores lightweight personal preferences.
type AppSettings struct {
	QuickShortcut string    `json:"quickShortcut"`
	ThemeMode     ThemeMode `json:"themeMode"`
}

// WorkspaceSnapshot is the complete state persisted to disk and synced to windows.
type WorkspaceSnapshot struct {
	Version      int            `json:"version"`
	Blocks       []ProjectBlock `json:"blocks"`
	Tasks        []Task         `json:"tasks"`
	Notes        []QuickNote    `json:"notes"`
	TagReminders []TagReminder  `json:"tagReminders"`
	Settings     AppSettings    `json:"settings"`
	KnownTags    []string       `json:"knownTags"`
}

// ReminderNotification is broadcast to pages when a reminder fires.
type ReminderNotification struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // "tag" | "task" | "test"
	Title       string `json:"title"`
	Body        string `json:"body"`
	Tag         string `json:"tag,omitempty"`
	TaskID      string `json:"taskId,omitempty"`
	TaskDate    string `json:"taskDate,omitempty"`
	FiredAt     string `json:"firedAt"`
	OSNotified  bool   `json:"osNotified"`
	OSNotifyErr string `json:"osNotifyErr,omitempty"`
}

// CreateBlockInput holds parameters for creating a color block project.
type CreateBlockInput struct {
	Name  string   `json:"name"`
	Color ColorKey `json:"color"`
}

// UpdateBlockInput holds parameters for updating a color block project.
type UpdateBlockInput struct {
	ID    string   `json:"id"`
	Name  string   `json:"name"`
	Color ColorKey `json:"color"`
}

// CreateTaskInput holds parameters for adding a daily task.
type CreateTaskInput struct {
	BlockID      string   `json:"blockId"`
	Date         string   `json:"date"` // YYYY-MM-DD
	Title        string   `json:"title"`
	Note         string   `json:"note,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	ReminderTime string   `json:"reminderTime,omitempty"` // HH:MM
}

// UpdateTaskInput holds parameters for editing an existing task.
type UpdateTaskInput struct {
	ID           string   `json:"id"`
	BlockID      string   `json:"blockId"`
	Date         string   `json:"date"`
	Title        string   `json:"title"`
	Note         string   `json:"note,omitempty"`
	Done         bool     `json:"done"`
	Tags         []string `json:"tags"`
	ReminderTime string   `json:"reminderTime,omitempty"`
}

// CreateNoteInput holds parameters for adding a quick note.
type CreateNoteInput struct {
	Content string   `json:"content"`
	Tags    []string `json:"tags,omitempty"`
}

// UpdateNoteInput holds parameters for editing a quick note.
type UpdateNoteInput struct {
	ID      string   `json:"id"`
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Pinned  bool     `json:"pinned"`
}

// ConvertNoteInput turns a quick note into a daily task inside a color block.
type ConvertNoteInput struct {
	NoteID       string `json:"noteId"`
	BlockID      string `json:"blockId"`
	Date         string `json:"date"` // YYYY-MM-DD
	ReminderTime string `json:"reminderTime,omitempty"`
	DeleteNote   bool   `json:"deleteNote"`
}

// UpsertTagReminderInput creates or updates a tag reminder rule.
type UpsertTagReminderInput struct {
	ID           string     `json:"id,omitempty"`
	Tag          string     `json:"tag"`
	Time         string     `json:"time"` // HH:MM
	Repeat       RepeatType `json:"repeat"`
	DaysOfWeek   []int      `json:"daysOfWeek,omitempty"`
	OnceDate     string     `json:"onceDate,omitempty"`
	OnlyWhenOpen bool       `json:"onlyWhenOpen"`
	Message      string     `json:"message,omitempty"`
	Enabled      bool       `json:"enabled"`
}

// FocusTarget asks the main window to jump to a date or highlight a tag/task.
type FocusTarget struct {
	Date   string `json:"date,omitempty"`
	Tag    string `json:"tag,omitempty"`
	TaskID string `json:"taskId,omitempty"`
}

// SystemStatus reports runtime capabilities shown in settings.
type SystemStatus struct {
	DataPath               string `json:"dataPath"`
	NotificationsSupported bool   `json:"notificationsSupported"`
	QuickShortcut          string `json:"quickShortcut"`
	ShortcutActive         bool   `json:"shortcutActive"`
	ShortcutError          string `json:"shortcutError,omitempty"`
}
