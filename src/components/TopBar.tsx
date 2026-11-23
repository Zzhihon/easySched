import { useRef } from "react";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Monitor,
} from "lucide-react";
import {
  formatDateHeader,
  formatShortcutDisplay,
  shiftDateKey,
  todayKey,
} from "../lib/dates";

interface TopBarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  activeReminderCount: number;
  quickShortcut: string;
  themeMode: string;
  onCycleTheme: () => void;
  onOpenNewBlock: () => void;
  onOpenReminders: () => void;
  onSummonQuickPanel: () => void;
}

export function TopBar({
  selectedDate,
  onSelectDate,
  activeReminderCount,
  quickShortcut,
  themeMode,
  onCycleTheme,
  onOpenNewBlock,
  onOpenReminders,
  onSummonQuickPanel,
}: TopBarProps) {
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const { main, weekday, relative } = formatDateHeader(selectedDate);
  const isToday = selectedDate === todayKey();

  const ThemeIcon =
    themeMode === "dark" ? Moon : themeMode === "light" ? Sun : Monitor;
  const themeTitle =
    themeMode === "dark"
      ? "深色模式（点击切换）"
      : themeMode === "light"
        ? "浅色模式（点击切换）"
        : "跟随系统外观（点击切换）";

  return (
    <header
      className="titlebar-drag shrink-0 h-12 flex items-center justify-between border-b"
      style={{
        borderColor: "var(--border-hairline)",
        background: "var(--bg-canvas)",
      }}
    >
      {/* Left: Date navigation */}
      <div className="titlebar-nodrag flex items-center gap-1.5">
        <div className="flex items-center rounded-lg border px-0.5 py-0.5"
          style={{
            borderColor: "var(--border-hairline)",
            background: "var(--bg-surface)",
          }}
        >
          <button
            type="button"
            onClick={() => onSelectDate(shiftDateKey(selectedDate, -1))}
            className="p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
            title="前一天"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const el = dateInputRef.current;
              if (!el) return;
              if (typeof el.showPicker === "function") {
                el.showPicker();
              } else {
                el.focus();
                el.click();
              }
            }}
            className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[13px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-primary)" }}
            title="点击选择任意日期"
          >
            <Calendar className="w-3.5 h-3.5 opacity-60" />
            <span>{main}</span>
            <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
              {weekday}
            </span>
            {relative && (
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-medium"
                style={{
                  background: isToday
                    ? "rgba(59, 130, 246, 0.14)"
                    : "var(--bg-subtle)",
                  color: isToday ? "var(--accent-ink)" : "var(--text-secondary)",
                }}
              >
                {relative}
              </span>
            )}
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) onSelectDate(e.target.value);
              }}
              className="sr-only"
              tabIndex={-1}
            />
          </button>

          <button
            type="button"
            onClick={() => onSelectDate(shiftDateKey(selectedDate, 1))}
            className="p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
            title="后一天"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isToday && (
          <button
            type="button"
            onClick={() => onSelectDate(todayKey())}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: "var(--border-hairline)",
              background: "var(--bg-surface)",
              color: "var(--accent-ink)",
            }}
          >
            回到今天
          </button>
        )}
      </div>

      {/* Right: Core lightweight actions */}
      <div className="titlebar-nodrag flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSummonQuickPanel}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            borderColor: "var(--border-hairline)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
          title={`随时呼出悬浮速记框 (${formatShortcutDisplay(quickShortcut)})`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>悬浮速记</span>
          <kbd
            className="hidden sm:inline-block px-1 py-0.5 rounded text-[10px] font-mono"
            style={{
              background: "var(--bg-subtle)",
              color: "var(--text-muted)",
            }}
          >
            {formatShortcutDisplay(quickShortcut)}
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenNewBlock}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
          style={{
            background: "var(--text-primary)",
            color: "var(--bg-canvas)",
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建色块</span>
        </button>

        <button
          type="button"
          onClick={onOpenReminders}
          className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            borderColor: "var(--border-hairline)",
            background: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
          title="配置 Tag 定时提醒、快捷键与本地备份"
        >
          <Bell className="w-3.5 h-3.5" />
          <span>提醒</span>
          {activeReminderCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold"
              style={{
                background: "rgba(59, 130, 246, 0.16)",
                color: "var(--accent-ink)",
              }}
            >
              {activeReminderCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onCycleTheme}
          className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--bg-hover)]"
          style={{
            borderColor: "var(--border-hairline)",
            background: "var(--bg-surface)",
            color: "var(--text-secondary)",
          }}
          title={themeTitle}
        >
          <ThemeIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
