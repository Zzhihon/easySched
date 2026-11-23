import { useState } from "react";
import { MoreHorizontal, Plus, Trash2, Pencil, ArrowLeft, ArrowRight } from "lucide-react";
import type { ProjectBlock, Task, UpdateTaskInput } from "../mygo";
import { BLOCK_PALETTES, getPalette, type PaletteKey } from "../lib/colors";
import { TaskItem } from "./TaskItem";

interface ColorBlockCardProps {
  block: ProjectBlock;
  index: number;
  totalBlocks: number;
  tasks: Task[];
  allBlocks: ProjectBlock[];
  knownTags: string[];
  isDark: boolean;
  hideCompleted: boolean;
  activeTagFilter: string | null;
  highlightedTaskId: string | null;
  onAddTask: (blockId: string, rawTitle: string) => Promise<void>;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (input: UpdateTaskInput) => Promise<void>;
  onDeleteTask: (taskId: string) => void;
  onQuickRecolor: (block: ProjectBlock, color: PaletteKey) => Promise<void>;
  onEditBlock: (block: ProjectBlock) => void;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onDeleteBlock: (block: ProjectBlock) => void;
  onClickTag: (tag: string) => void;
}

export function ColorBlockCard({
  block,
  index,
  totalBlocks,
  tasks,
  allBlocks,
  knownTags,
  isDark,
  hideCompleted,
  activeTagFilter,
  highlightedTaskId,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onQuickRecolor,
  onEditBlock,
  onMoveBlock,
  onDeleteBlock,
  onClickTag,
}: ColorBlockCardProps) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const palette = getPalette(block.color);

  const completedCount = tasks.filter((t) => t.done).length;
  const visibleTasks = tasks
    .filter((t) => (!hideCompleted ? true : !t.done))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.order - b.order;
    });

  const handleQuickAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const withTag =
        activeTagFilter && !trimmed.includes(`#${activeTagFilter}`)
          ? `${trimmed} #${activeTagFilter}`
          : trimmed;
      await onAddTask(block.id, withTag);
      setDraft("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="relative flex flex-col rounded-2xl border transition-shadow"
      style={{
        background: isDark ? palette.cardBgDark : palette.cardBgLight,
        borderColor: isDark ? palette.borderDark : palette.borderLight,
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Crisp top color accent bar */}
      <div
        className="h-1.5 w-full rounded-t-2xl"
        style={{ background: palette.accent, opacity: isDark ? 0.85 : 0.9 }}
      />

      {/* Block Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <div className="relative flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              setShowColorMenu((v) => !v);
              setShowActions(false);
            }}
            className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-offset-1 transition-transform hover:scale-110"
            style={{
              background: palette.accent,
              boxShadow: `0 0 0 2px ${isDark ? palette.cardBgDark : palette.cardBgLight}`,
            }}
            title="点击快速更换色块颜色"
          />

          <h2
            onDoubleClick={() => onEditBlock(block)}
            className="text-[14.5px] font-semibold truncate cursor-default"
            style={{
              color: isDark ? palette.headerInkDark : palette.headerInkLight,
            }}
            title={block.name}
          >
            {block.name}
          </h2>

          {tasks.length > 0 && (
            <span
              className="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                background: isDark
                  ? palette.accentSoftDark
                  : palette.accentSoftLight,
                color: isDark ? palette.headerInkDark : palette.headerInkLight,
              }}
            >
              {completedCount}/{tasks.length}
            </span>
          )}

          {/* Instant 8-color swatch popover */}
          {showColorMenu && (
            <div
              className="absolute left-0 top-7 z-30 p-2 rounded-xl border flex items-center gap-1.5 animate-fade-slide"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              {BLOCK_PALETTES.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setShowColorMenu(false);
                    void onQuickRecolor(block, p.key);
                  }}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-115 flex items-center justify-center"
                  style={{
                    background: p.accent,
                    outline:
                      p.key === block.color
                        ? `2px solid ${p.accent}`
                        : "none",
                    outlineOffset: "2px",
                  }}
                  title={p.label}
                />
              ))}
            </div>
          )}
        </div>

        {/* Block actions menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowActions((v) => !v);
              setShowColorMenu(false);
            }}
            className="p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--text-muted)" }}
            title="分区操作"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showActions && (
            <div
              className="absolute right-0 top-7 z-30 w-36 py-1 rounded-xl border text-xs animate-fade-slide"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-hairline)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowActions(false);
                  onEditBlock(block);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)]"
                style={{ color: "var(--text-primary)" }}
              >
                <Pencil className="w-3.5 h-3.5 opacity-70" />
                <span>重命名 / 换色</span>
              </button>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(false);
                    onMoveBlock(block.id, -1);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5 opacity-70" />
                  <span>向前移动</span>
                </button>
              )}
              {index < totalBlocks - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowActions(false);
                    onMoveBlock(block.id, 1);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-primary)" }}
                >
                  <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  <span>向后移动</span>
                </button>
              )}
              {totalBlocks > 1 && (
                <>
                  <div
                    className="my-1 h-px"
                    style={{ background: "var(--border-hairline)" }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowActions(false);
                      onDeleteBlock(block);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除色块</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="px-2.5 flex-1 space-y-0.5 min-h-[36px]">
        {visibleTasks.length === 0 ? (
          <div
            className="px-2 py-2.5 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {activeTagFilter
              ? `该分区下暂无 #${activeTagFilter} 任务`
              : tasks.length > 0 && hideCompleted
                ? "今日该分区任务已全部完成"
                : "暂无安排，在下方回车即可快速记录"}
          </div>
        ) : (
          visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              palette={palette}
              isDark={isDark}
              allBlocks={allBlocks}
              knownTags={knownTags}
              highlighted={highlightedTaskId === task.id}
              onToggle={onToggleTask}
              onUpdate={onUpdateTask}
              onDelete={onDeleteTask}
              onClickTag={onClickTag}
            />
          ))
        )}
      </div>

      {/* Inline Quick Add Bar */}
      <div className="px-3 pb-3 pt-2 mt-1">
        <div
          className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 border transition-colors focus-within:border-[var(--border-strong)]"
          style={{
            background: isDark
              ? "rgba(0, 0, 0, 0.22)"
              : "rgba(255, 255, 255, 0.72)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.07)"
              : "rgba(28, 25, 23, 0.07)",
          }}
        >
          <Plus
            className="w-3.5 h-3.5 shrink-0"
            style={{ color: palette.accent }}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleQuickAdd();
              }
            }}
            placeholder={
              activeTagFilter
                ? `添加 #${activeTagFilter} 任务，回车确认…`
                : "添加任务… 支持 #标签，回车确认"
            }
            className="w-full text-[12.5px] bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />
          {draft.trim() && (
            <button
              type="button"
              onClick={() => void handleQuickAdd()}
              disabled={submitting}
              className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: palette.accent }}
            >
              添加
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
