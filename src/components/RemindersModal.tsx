import { useEffect, useState } from "react";
import {
  Bell,
  BellRing,
  Download,
  FolderOpen,
  Keyboard,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type {
  SystemStatus,
  TagReminder,
  UpsertTagReminderInput,
} from "../mygo";
import {
  formatRepeatRule,
  formatShortcutDisplay,
  todayKey,
} from "../lib/dates";

interface RemindersModalProps {
  open: boolean;
  reminders: TagReminder[];
  knownTags: string[];
  themeMode: string;
  systemStatus: SystemStatus | null;
  onClose: () => void;
  onUpsertReminder: (input: UpsertTagReminderInput) => Promise<void>;
  onToggleReminder: (id: string, enabled: boolean) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onTestReminder: (ruleId: string) => Promise<void>;
  onUpdateShortcut: (shortcut: string) => Promise<void>;
  onUpdateTheme: (mode: string) => Promise<void>;
  onRevealData: () => Promise<void>;
  onExportBackup: () => Promise<void>;
}

const WEEKDAYS = [
  { val: 1, label: "一" },
  { val: 2, label: "二" },
  { val: 3, label: "三" },
  { val: 4, label: "四" },
  { val: 5, label: "五" },
  { val: 6, label: "六" },
  { val: 0, label: "日" },
];

const SHORTCUT_PRESETS = [
  "Alt+Shift+Space",
  "CmdOrCtrl+Shift+N",
  "Alt+Shift+N",
  "CmdOrCtrl+Shift+K",
];

export function RemindersModal({
  open,
  reminders,
  knownTags,
  themeMode,
  systemStatus,
  onClose,
  onUpsertReminder,
  onToggleReminder,
  onDeleteReminder,
  onTestReminder,
  onUpdateShortcut,
  onUpdateTheme,
  onRevealData,
  onExportBackup,
}: RemindersModalProps) {
  const [tab, setTab] = useState<"reminders" | "settings">("reminders");

  // Reminder form state
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [tag, setTag] = useState("");
  const [time, setTime] = useState("09:30");
  const [repeat, setRepeat] = useState<"daily" | "weekdays" | "custom" | "once">(
    "weekdays",
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 3, 5]);
  const [onceDate, setOnceDate] = useState(todayKey());
  const [onlyWhenOpen, setOnlyWhenOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Settings state
  const [shortcutDraft, setShortcutDraft] = useState(
    systemStatus?.quickShortcut ?? "Alt+Shift+Space",
  );
  const [shortcutMsg, setShortcutMsg] = useState("");

  useEffect(() => {
    if (open) {
      setShortcutDraft(systemStatus?.quickShortcut ?? "Alt+Shift+Space");
      setShortcutMsg("");
      setFormError("");
    }
  }, [open, systemStatus?.quickShortcut]);

  if (!open) return null;

  const resetForm = () => {
    setEditingId(undefined);
    setTag("");
    setTime("09:30");
    setRepeat("weekdays");
    setDaysOfWeek([1, 3, 5]);
    setOnceDate(todayKey());
    setOnlyWhenOpen(false);
    setMessage("");
    setFormError("");
  };

  const loadIntoForm = (r: TagReminder) => {
    setEditingId(r.id);
    setTag(r.tag);
    setTime(r.time);
    setRepeat((r.repeat as "daily" | "weekdays" | "custom" | "once") || "daily");
    setDaysOfWeek(r.daysOfWeek && r.daysOfWeek.length > 0 ? r.daysOfWeek : [1, 3, 5]);
    setOnceDate(r.onceDate || todayKey());
    setOnlyWhenOpen(Boolean(r.onlyWhenOpen));
    setMessage(r.message ?? "");
    setFormError("");
  };

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const cleanTag = tag.trim().replace(/^#+/, "");
    if (!cleanTag) {
      setFormError("请输入或选择一个标签");
      return;
    }
    if (repeat === "custom" && daysOfWeek.length === 0) {
      setFormError("自定义周期请至少选择一天");
      return;
    }

    setSaving(true);
    try {
      await onUpsertReminder({
        id: editingId,
        tag: cleanTag,
        time,
        repeat,
        daysOfWeek: repeat === "custom" ? daysOfWeek : undefined,
        onceDate: repeat === "once" ? onceDate : undefined,
        onlyWhenOpen,
        message: message.trim() || undefined,
        enabled: true,
      });
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyShortcut = async (sc: string) => {
    setShortcutMsg("");
    try {
      await onUpdateShortcut(sc);
      setShortcutDraft(sc);
      setShortcutMsg("全局快捷键已更新并生效");
    } catch (err) {
      setShortcutMsg(err instanceof Error ? err.message : "快捷键注册失败");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border overflow-hidden animate-fade-slide"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
          boxShadow: "var(--shadow-float)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + Tabs */}
        <div
          className="px-5 pt-4 pb-3 border-b flex items-center justify-between"
          style={{ borderColor: "var(--border-hairline)" }}
        >
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
            <button
              type="button"
              onClick={() => setTab("reminders")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === "reminders" ? "var(--bg-surface)" : "transparent",
                color: tab === "reminders" ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: tab === "reminders" ? "var(--shadow-card)" : "none",
              }}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Tag 定时提醒 ({reminders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === "settings" ? "var(--bg-surface)" : "transparent",
                color: tab === "settings" ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: tab === "settings" ? "var(--shadow-card)" : "none",
              }}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>快捷键与数据</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onTestReminder("")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-hover)]"
              style={{
                borderColor: "var(--border-hairline)",
                color: "var(--text-secondary)",
              }}
            >
              <BellRing className="w-3.5 h-3.5 text-amber-500" />
              <span>测试系统通知</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {tab === "reminders" ? (
            <>
              {/* Rule Form */}
              <form
                onSubmit={(e) => void handleSaveRule(e)}
                className="rounded-2xl border p-4 space-y-3.5"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: "var(--border-hairline)",
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {editingId ? "编辑 Tag 提醒规则" : "新建 Tag 定时提醒"}
                  </h4>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs hover:underline"
                      style={{ color: "var(--text-muted)" }}
                    >
                      取消编辑
                    </button>
                  )}
                </div>

                {/* Tag + Time row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11.5px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      目标标签 (#Tag)
                    </label>
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder="例如：日报、晨会、项目A"
                      className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-[var(--border-strong)]"
                      style={{
                        background: "var(--bg-surface)",
                        borderColor: "var(--border-hairline)",
                        color: "var(--text-primary)",
                      }}
                    />
                    {knownTags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {knownTags.slice(0, 8).map((kt) => (
                          <button
                            key={kt}
                            type="button"
                            onClick={() => setTag(kt)}
                            className="px-1.5 py-0.5 rounded-md text-[11px] transition-colors"
                            style={{
                              background:
                                tag.replace(/^#+/, "") === kt
                                  ? "rgba(59, 130, 246, 0.16)"
                                  : "var(--bg-surface)",
                              color:
                                tag.replace(/^#+/, "") === kt
                                  ? "var(--accent-ink)"
                                  : "var(--text-muted)",
                            }}
                          >
                            #{kt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11.5px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      提醒时间
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-[var(--border-strong)]"
                      style={{
                        background: "var(--bg-surface)",
                        borderColor: "var(--border-hairline)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      到点自动汇总该标签下的待办并弹出系统通知
                    </p>
                  </div>
                </div>

                {/* Repeat cadence */}
                <div>
                  <label className="block text-[11.5px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                    提醒频率
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["daily", "每天"],
                        ["weekdays", "工作日"],
                        ["custom", "自定义周几"],
                        ["once", "单次日期"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRepeat(key)}
                        className="px-3 py-1 rounded-lg border text-xs font-medium transition-colors"
                        style={{
                          background:
                            repeat === key
                              ? "rgba(59, 130, 246, 0.14)"
                              : "var(--bg-surface)",
                          borderColor:
                            repeat === key
                              ? "var(--accent-ink)"
                              : "var(--border-hairline)",
                          color:
                            repeat === key
                              ? "var(--accent-ink)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {repeat === "custom" && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {WEEKDAYS.map((wd) => {
                        const active = daysOfWeek.includes(wd.val);
                        return (
                          <button
                            key={wd.val}
                            type="button"
                            onClick={() => toggleDay(wd.val)}
                            className="w-8 h-8 rounded-full border text-xs font-medium transition-colors"
                            style={{
                              background: active
                                ? "var(--accent-ink)"
                                : "var(--bg-surface)",
                              borderColor: active
                                ? "var(--accent-ink)"
                                : "var(--border-hairline)",
                              color: active ? "#fff" : "var(--text-secondary)",
                            }}
                          >
                            {wd.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {repeat === "once" && (
                    <div className="mt-2">
                      <input
                        type="date"
                        value={onceDate}
                        onChange={(e) => setOnceDate(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border text-xs outline-none"
                        style={{
                          background: "var(--bg-surface)",
                          borderColor: "var(--border-hairline)",
                          color: "var(--text-primary)",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Optional message + OnlyWhenOpen */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="自定义附言（可选，例如：下班前检查并发送日报）"
                    className="flex-1 px-3 py-1.5 rounded-xl border text-xs outline-none focus:border-[var(--border-strong)]"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border-hairline)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <label
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs cursor-pointer"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <input
                      type="checkbox"
                      checked={onlyWhenOpen}
                      onChange={(e) => setOnlyWhenOpen(e.target.checked)}
                    />
                    <span>仅当有未完成项时提醒</span>
                  </label>
                </div>

                {formError && (
                  <p className="text-xs text-red-500">{formError}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{
                      background: "var(--text-primary)",
                      color: "var(--bg-canvas)",
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{editingId ? "更新规则" : "添加提醒规则"}</span>
                  </button>
                </div>
              </form>

              {/* Existing Rules List */}
              <div className="space-y-2">
                <h4
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  已设置的 Tag 提醒
                </h4>

                {reminders.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed py-8 text-center text-xs"
                    style={{
                      borderColor: "var(--border-strong)",
                      color: "var(--text-muted)",
                    }}
                  >
                    还没有 Tag 定时提醒，在上方为常用标签（如 #日报、#复盘）设一个时间吧
                  </div>
                ) : (
                  reminders.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border px-4 py-3 flex items-center justify-between gap-3"
                      style={{
                        background: "var(--bg-canvas)",
                        borderColor: "var(--border-hairline)",
                        opacity: r.enabled ? 1 : 0.58,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-semibold"
                            style={{
                              background: "rgba(59, 130, 246, 0.14)",
                              color: "var(--accent-ink)",
                            }}
                          >
                            #{r.tag}
                          </span>
                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {r.time}
                          </span>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                            {formatRepeatRule(r.repeat, r.daysOfWeek, r.onceDate)}
                          </span>
                          {r.onlyWhenOpen && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10.5px]"
                              style={{
                                background: "var(--bg-subtle)",
                                color: "var(--text-muted)",
                              }}
                            >
                              有待办时触发
                            </span>
                          )}
                        </div>
                        {r.message && (
                          <p className="mt-1 text-xs truncate" style={{ color: "var(--text-muted)" }}>
                            {r.message}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void onTestReminder(r.id)}
                          className="px-2 py-1 rounded-lg border text-[11px] hover:bg-[var(--bg-hover)]"
                          style={{
                            borderColor: "var(--border-hairline)",
                            color: "var(--text-secondary)",
                          }}
                          title="立即预览此规则的提醒效果"
                        >
                          试推
                        </button>
                        <button
                          type="button"
                          onClick={() => loadIntoForm(r)}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]"
                          style={{ color: "var(--text-muted)" }}
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteReminder(r.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-500"
                          style={{ color: "var(--text-muted)" }}
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={r.enabled}
                          onClick={() => void onToggleReminder(r.id, !r.enabled)}
                          className="ml-1 relative w-9 h-5 rounded-full transition-colors"
                          style={{
                            background: r.enabled
                              ? "var(--accent-ink)"
                              : "var(--border-strong)",
                          }}
                        >
                          <span
                            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm"
                            style={{
                              transform: r.enabled
                                ? "translateX(16px)"
                                : "translateX(0px)",
                            }}
                          />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Global Shortcut */}
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: "var(--border-hairline)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      全局悬浮速记快捷键
                    </h4>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      在任何应用甚至全屏窗口上方直接呼出极简速记框
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                    style={{
                      background: systemStatus?.shortcutActive
                        ? "rgba(16, 185, 129, 0.14)"
                        : "rgba(245, 158, 11, 0.14)",
                      color: systemStatus?.shortcutActive ? "#10b981" : "#d97706",
                    }}
                  >
                    {systemStatus?.shortcutActive ? "已生效" : "未注册"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {SHORTCUT_PRESETS.map((sc) => {
                    const active = shortcutDraft === sc;
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() => void handleApplyShortcut(sc)}
                        className="px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors"
                        style={{
                          background: active
                            ? "rgba(59, 130, 246, 0.14)"
                            : "var(--bg-surface)",
                          borderColor: active
                            ? "var(--accent-ink)"
                            : "var(--border-hairline)",
                          color: active
                            ? "var(--accent-ink)"
                            : "var(--text-secondary)",
                        }}
                      >
                        {formatShortcutDisplay(sc)}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shortcutDraft}
                    onChange={(e) => setShortcutDraft(e.target.value)}
                    placeholder="如 Alt+Shift+Space"
                    className="flex-1 px-3 py-1.5 rounded-xl border text-xs font-mono outline-none"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border-hairline)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleApplyShortcut(shortcutDraft)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium"
                    style={{
                      background: "var(--text-primary)",
                      color: "var(--bg-canvas)",
                    }}
                  >
                    应用
                  </button>
                </div>

                {(shortcutMsg || systemStatus?.shortcutError) && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {shortcutMsg || systemStatus?.shortcutError}
                  </p>
                )}
              </div>

              {/* Theme */}
              <div
                className="rounded-2xl border p-4 flex items-center justify-between gap-4"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: "var(--border-hairline)",
                }}
              >
                <div>
                  <h4 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    外观主题
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    浅色暖纸感与深色静谧模式均针对色块分区专门调校
                  </p>
                </div>
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                  {(
                    [
                      ["system", "跟随系统"],
                      ["light", "浅色"],
                      ["dark", "深色"],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => void onUpdateTheme(val)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background:
                          themeMode === val ? "var(--bg-surface)" : "transparent",
                        color:
                          themeMode === val
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Storage & Backup */}
              <div
                className="rounded-2xl border p-4 space-y-3"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: "var(--border-hairline)",
                }}
              >
                <div>
                  <h4 className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    纯本地数据与备份
                  </h4>
                  <p className="text-xs mt-1 font-mono break-all" style={{ color: "var(--text-muted)" }}>
                    {systemStatus?.dataPath || "加载中…"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onRevealData()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-[var(--bg-hover)]"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border-hairline)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>打开数据目录</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onExportBackup()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-[var(--bg-hover)]"
                    style={{
                      background: "var(--bg-surface)",
                      borderColor: "var(--border-hairline)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>导出 JSON 备份</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
