const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
}

export function shiftDateKey(key: string, deltaDays: number): string {
  const dt = parseDateKey(key);
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

export function formatDateHeader(key: string): {
  main: string;
  weekday: string;
  relative: string | null;
} {
  const dt = parseDateKey(key);
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  const weekday = WEEKDAY_NAMES[dt.getDay()] ?? "";

  const today = todayKey();
  const yesterday = shiftDateKey(today, -1);
  const tomorrow = shiftDateKey(today, 1);

  let relative: string | null = null;
  if (key === today) relative = "今天";
  else if (key === yesterday) relative = "昨天";
  else if (key === tomorrow) relative = "明天";

  const showYear = dt.getFullYear() !== new Date().getFullYear();
  const main = showYear ? `${dt.getFullYear()}年${month}月${day}日` : `${month}月${day}日`;

  return { main, weekday, relative };
}

export function formatNoteTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  if (diffMs >= 0 && diffMs < 60_000) return "刚刚";

  const hhmm = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const key = toDateKey(dt);
  const today = toDateKey(now);
  if (key === today) return hhmm;
  if (key === shiftDateKey(today, -1)) return `昨天 ${hhmm}`;
  return `${dt.getMonth() + 1}/${dt.getDate()} ${hhmm}`;
}

export function formatRepeatRule(
  repeat: string,
  daysOfWeek?: number[],
  onceDate?: string,
): string {
  switch (repeat) {
    case "daily":
      return "每天";
    case "weekdays":
      return "工作日 (周一至周五)";
    case "custom": {
      if (!daysOfWeek || daysOfWeek.length === 0) return "自定义";
      const names = ["日", "一", "二", "三", "四", "五", "六"];
      return "每" + daysOfWeek.map((d) => `周${names[d] ?? ""}`).join("、");
    }
    case "once":
      return onceDate ? `单次 (${onceDate})` : "单次";
    default:
      return repeat;
  }
}

export function formatShortcutDisplay(shortcut: string): string {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  if (!isMac) return shortcut;
  return shortcut
    .replace(/CmdOrCtrl|CommandOrControl|Cmd|Command/gi, "⌘")
    .replace(/Alt|Option/gi, "⌥")
    .replace(/Shift/gi, "⇧")
    .replace(/Ctrl|Control/gi, "⌃")
    .replace(/Space/gi, "Space")
    .replace(/\+/g, " ");
}
