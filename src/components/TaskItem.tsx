import { useState } from "react";
import { Check, Clock, Pencil, Trash2, X } from "lucide-react";
import type { ProjectBlock, Task, UpdateTaskInput } from "../mygo";
import type { BlockPalette } from "../lib/colors";

interface TaskItemProps {
  task: Task;
  palette: BlockPalette;
  isDark: boolean;
  allBlocks: ProjectBlock[];
  knownTags: string[];
  highlighted?: boolean;
  onToggle: (taskId: string) => void;
  onUpdate: (input: UpdateTaskInput) => Promise<void>;
  onDelete: (taskId: string) => void;
  onClickTag: (tag: string) => void;
}

const QUICK_TIMES = ["09:30", "12:00", "14:30", "17:30", "20:00"];

export function TaskItem({
  task,
  palette,
  isDark,
  allBlocks,
  knownTags,
  highlighted,
  onToggle,
  onUpdate,
  onDelete,
  onClickTag,
}: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [tags, setTags] = useState<string[]>(task.tags);
  const [tagDraft, setTagDraft] = useState("");
  const [blockId, setBlockId] = useState(task.blockId);
  const [date, setDate] = useState(task.date);
  const [reminderTime, setReminderTime] = useState(task.reminderTime ?? "");

  const startEdit = () => {
    setTitle(task.title);
    setNote(task.note ?? "");
    setTags(task.tags);
    setTagDraft("");
    setBlockId(task.blockId);
    setDate(task.date);
    setReminderTime(task.reminderTime ?? "");
    setShowTimePicker(false);
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onUpdate({
      id: task.id,
      blockId,
      date,
      title: trimmed,
      note: note.trim() || undefined,
      done: task.done,
      tags,
      reminderTime: reminderTime.trim() || undefined,
    });
    setEditing(false);
  };

  const handleQuickReminder = async (timeValue: string) => {
    await onUpdate({
      id: task.id,
      blockId: task.blockId,
      date: task.date,
      title: task.title,
      note: task.note,
      done: task.done,
      tags: task.tags,
      reminderTime: timeValue || undefined,
    });
    setShowTimePicker(false);
  };

  const addDraftTag = (raw: string) => {
    const clean = raw.trim().replace(/^#+/, "");
    if (!clean) return;
    if (!tags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setTags([...tags, clean]);
    }
    setTagDraft("");
  };

  if (editing) {
    return (
      <div
        className="rounded-xl p-2.5 border animate-fade-slide space-y-2"
        style={{
          background: "var(--bg-surface)",
          borderColor: palette.accent,
        }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void handleSave();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          autoFocus
          className="w-full text-[13.5px] font-medium bg-transparent outline-none"
          style={{ color: "var(--text-primary)" }}
          placeholder="任务标题（可输入 #标签）"
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full text-xs bg-transparent outline-none resize-none rounded-lg px-2 py-1.5 border"
          style={{
            color: "var(--text-secondary)",
            borderColor: "var(--border-hairline)",
          }}
          placeholder="补充说明（可选）"
        />

        {/* Tags editor */}
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{
                background: isDark ? palette.accentSoftDark : palette.accentSoftLight,
                color: isDark ? palette.headerInkDark : palette.headerInkLight,
              }}
            >
              #{t}
              <button
                type="button"
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !e.nativeEvent.isComposing) {
                if (tagDraft.trim()) {
                  e.preventDefault();
                  addDraftTag(tagDraft);
                }
              }
            }}
            placeholder="+ 添加标签"
            className="text-[11px] px-1.5 py-0.5 rounded bg-transparent outline-none w-20"
            style={{ color: "var(--text-secondary)" }}
          />
        </div>

        {/* Quick pick from existing tags */}
        {knownTags.filter((kt) => !tags.includes(kt)).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {knownTags
              .filter((kt) => !tags.includes(kt))
              .slice(0, 6)
              .map((kt) => (
                <button
                  key={kt}
                  type="button"
                  onClick={() => addDraftTag(kt)}
                  className="px-1.5 py-0.5 rounded-full text-[10.5px] border transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: "var(--border-hairline)",
                    color: "var(--text-muted)",
                  }}
                >
                  +#{kt}
                </button>
              ))}
          </div>
        )}

        {/* Block, Date, Reminder row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <select
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            className="rounded-md px-2 py-1 text-xs border outline-none"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-hairline)",
              color: "var(--text-primary)",
            }}
          >
            {allBlocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md px-2 py-1 text-xs border outline-none"
            style={{
              background: "var(--bg-subtle)",
              borderColor: "var(--border-hairline)",
              color: "var(--text-primary)",
            }}
          />

          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
            <input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
              className="rounded-md px-1.5 py-1 text-xs border outline-none"
              style={{
                background: "var(--bg-subtle)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            />
            {reminderTime && (
              <button
                type="button"
                onClick={() => setReminderTime("")}
                className="text-[11px] px-1 hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                清除
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="px-3 py-1 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: palette.accent }}
          >
            保存
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-xl px-2 py-2 transition-colors"
      style={{
        background: highlighted
          ? isDark
            ? palette.accentSoftDark
            : palette.accentSoftLight
          : undefined,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Custom circular checkbox */}
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="mt-[2px] shrink-0 w-[18px] h-[18px] rounded-full border-[1.75px] flex items-center justify-center transition-all"
          style={{
            borderColor: task.done ? palette.accent : `${palette.accent}99`,
            background: task.done ? palette.accent : "transparent",
          }}
          title={task.done ? "标记为未完成" : "标记为已完成"}
        >
          {task.done && <Check className="w-3 h-3 text-white stroke-[2.75]" />}
        </button>

        {/* Task body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span
              onDoubleClick={startEdit}
              className={`text-[13.5px] leading-[1.45] break-words transition-opacity ${
                task.done ? "line-through opacity-50" : ""
              }`}
              style={{ color: "var(--text-primary)" }}
            >
              {task.title}
            </span>

            {/* Hover action icons */}
            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setShowTimePicker((v) => !v)}
                className="p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  color: task.reminderTime ? palette.accent : "var(--text-muted)",
                }}
                title="设置单任务提醒时间"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={startEdit}
                className="p-1 rounded-md transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-muted)" }}
                title="编辑任务"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="p-1 rounded-md transition-colors hover:bg-red-500/10 hover:text-red-500"
                style={{ color: "var(--text-muted)" }}
                title="删除任务"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {task.note && (
            <p
              className="mt-0.5 text-xs leading-relaxed whitespace-pre-wrap break-words"
              style={{ color: "var(--text-secondary)" }}
            >
              {task.note}
            </p>
          )}

          {/* Meta pills: reminder time + tags */}
          {(task.reminderTime || task.tags.length > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {task.reminderTime && (
                <button
                  type="button"
                  onClick={() => setShowTimePicker((v) => !v)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: isDark
                      ? "rgba(255, 255, 255, 0.08)"
                      : "rgba(28, 25, 23, 0.06)",
                    color: task.done ? "var(--text-muted)" : "var(--text-secondary)",
                  }}
                  title="点击调整提醒时间"
                >
                  <Clock className="w-2.5 h-2.5" style={{ color: palette.accent }} />
                  <span>{task.reminderTime}</span>
                </button>
              )}

              {task.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onClickTag(tag)}
                  className="px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{
                    background: isDark
                      ? palette.accentSoftDark
                      : palette.accentSoftLight,
                    color: isDark ? palette.headerInkDark : palette.headerInkLight,
                  }}
                  title={`筛选标签 #${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Quick inline reminder picker */}
          {showTimePicker && (
            <div
              className="mt-2 p-2 rounded-xl border animate-fade-slide flex flex-wrap items-center gap-1.5"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
              }}
            >
              {QUICK_TIMES.map((qt) => (
                <button
                  key={qt}
                  type="button"
                  onClick={() => void handleQuickReminder(qt)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    background:
                      task.reminderTime === qt
                        ? isDark
                          ? palette.accentSoftDark
                          : palette.accentSoftLight
                        : "var(--bg-subtle)",
                    color:
                      task.reminderTime === qt
                        ? palette.accent
                        : "var(--text-secondary)",
                  }}
                >
                  {qt}
                </button>
              ))}
              <input
                type="time"
                defaultValue={task.reminderTime ?? ""}
                onChange={(e) => {
                  if (e.target.value) void handleQuickReminder(e.target.value);
                }}
                className="px-1.5 py-0.5 rounded-md text-[11px] border outline-none"
                style={{
                  background: "var(--bg-subtle)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--text-primary)",
                }}
              />
              {task.reminderTime && (
                <button
                  type="button"
                  onClick={() => void handleQuickReminder("")}
                  className="ml-auto text-[11px] px-1.5 py-0.5 rounded hover:bg-red-500/10 text-red-500"
                >
                  移除提醒
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTimePicker(false)}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
