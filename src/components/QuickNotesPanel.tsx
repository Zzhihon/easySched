import { useMemo, useState } from "react";
import {
  ArrowRightCircle,
  Check,
  Pencil,
  Pin,
  Search,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import type {
  ConvertNoteInput,
  ProjectBlock,
  QuickNote,
  UpdateNoteInput,
} from "../mygo";
import { getPalette } from "../lib/colors";
import { formatNoteTime } from "../lib/dates";

interface QuickNotesPanelProps {
  notes: QuickNote[];
  blocks: ProjectBlock[];
  knownTags: string[];
  selectedDate: string;
  activeTagFilter: string | null;
  isDark: boolean;
  onCreateNote: (content: string, tags: string[]) => Promise<void>;
  onUpdateNote: (input: UpdateNoteInput) => Promise<void>;
  onTogglePin: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onConvertNote: (input: ConvertNoteInput) => Promise<void>;
  onClickTag: (tag: string) => void;
}

export function QuickNotesPanel({
  notes,
  blocks,
  knownTags,
  selectedDate,
  activeTagFilter,
  isDark,
  onCreateNote,
  onUpdateNote,
  onTogglePin,
  onDeleteNote,
  onConvertNote,
  onClickTag,
}: QuickNotesPanelProps) {
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Inline convert-to-task popover state
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [targetBlockId, setTargetBlockId] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>(selectedDate);
  const [deleteAfterConvert, setDeleteAfterConvert] = useState(true);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .filter((n) => {
        if (
          activeTagFilter &&
          !n.tags.some((t) => t.toLowerCase() === activeTagFilter.toLowerCase())
        ) {
          return false;
        }
        if (!q) return true;
        return (
          n.content.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [notes, query, activeTagFilter]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const mergedTags = activeTagFilter
        ? Array.from(new Set([...selectedTags, activeTagFilter]))
        : selectedTags;
      await onCreateNote(trimmed, mergedTags);
      setContent("");
      setSelectedTags([]);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDraftTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const openConvert = (note: QuickNote) => {
    setConvertingId(note.id);
    setTargetBlockId(blocks[0]?.id ?? "");
    setTargetDate(selectedDate);
    setDeleteAfterConvert(true);
    setEditingId(null);
  };

  const confirmConvert = async (noteId: string) => {
    if (!targetBlockId) return;
    await onConvertNote({
      noteId,
      blockId: targetBlockId,
      date: targetDate || selectedDate,
      deleteNote: deleteAfterConvert,
    });
    setConvertingId(null);
  };

  const startEdit = (note: QuickNote) => {
    setEditingId(note.id);
    setEditText(note.content);
    setConvertingId(null);
  };

  const saveEdit = async (note: QuickNote) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    await onUpdateNote({
      id: note.id,
      content: trimmed,
      tags: note.tags,
      pinned: Boolean(note.pinned),
    });
    setEditingId(null);
  };

  return (
    <aside
      className="w-[332px] lg:w-[356px] shrink-0 h-full flex flex-col border-l"
      style={{
        borderColor: "var(--border-hairline)",
        background: isDark ? "#1B1B1F" : "#FAF9F6",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2
            className="text-[14.5px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            随手记
          </h2>
          <span
            className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--bg-subtle)",
              color: "var(--text-muted)",
            }}
          >
            {filteredNotes.length}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          随时记 · 可转任务
        </span>
      </div>

      {/* Always-ready Composer */}
      <div className="px-3.5 pb-3">
        <div
          className="rounded-2xl border p-3 transition-colors focus-within:border-[var(--border-strong)]"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                (e.metaKey || e.ctrlKey) &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            rows={3}
            placeholder="想到什么就先记下来…&#10;输入 #标签 自动归类，⌘↵ 立即保存"
            className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />

          {/* Quick tag chips + submit */}
          <div className="mt-2 pt-2 border-t flex items-center justify-between gap-2"
            style={{ borderColor: "var(--border-hairline)" }}
          >
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {knownTags.slice(0, 5).map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleDraftTag(tag)}
                    className="shrink-0 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors"
                    style={{
                      background: active
                        ? "rgba(59, 130, 246, 0.16)"
                        : "var(--bg-subtle)",
                      color: active ? "var(--accent-ink)" : "var(--text-muted)",
                    }}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!content.trim() || submitting}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-opacity disabled:opacity-35 hover:opacity-90"
              style={{
                background: "var(--text-primary)",
                color: "var(--bg-canvas)",
              }}
            >
              <SendHorizontal className="w-3 h-3" />
              <span>记录</span>
            </button>
          </div>
        </div>
      </div>

      {/* Compact search input */}
      <div className="px-3.5 pb-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-hairline)",
          }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索随手记或 #标签…"
            className="w-full text-xs bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Notes Stream */}
      <div className="flex-1 overflow-y-auto px-3.5 pb-4 space-y-2">
        {filteredNotes.length === 0 ? (
          <div
            className="text-center py-10 px-4 text-xs leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {query || activeTagFilter
              ? "没有找到匹配的随手记"
              : "这里空空的，随时记下闪念、临时备忘或待整理的想法吧"}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isEditing = editingId === note.id;
            const isConverting = convertingId === note.id;

            return (
              <article
                key={note.id}
                className="group rounded-2xl border p-3 transition-colors"
                style={{
                  background: "var(--bg-surface)",
                  borderColor: note.pinned
                    ? "rgba(245, 158, 11, 0.35)"
                    : "var(--border-hairline)",
                }}
              >
                {/* Top meta + hover controls */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {note.pinned && (
                      <Pin className="w-3 h-3 text-amber-500 fill-amber-500/30" />
                    )}
                    <span>{formatNoteTime(note.createdAt)}</span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openConvert(note)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--accent-ink)" }}
                      title="转为色块任务"
                    >
                      <ArrowRightCircle className="w-3 h-3" />
                      <span>转任务</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePin(note.id)}
                      className="p-1 rounded-md hover:bg-[var(--bg-hover)]"
                      style={{
                        color: note.pinned ? "#f59e0b" : "var(--text-muted)",
                      }}
                      title={note.pinned ? "取消置顶" : "置顶"}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(note)}
                      className="p-1 rounded-md hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--text-muted)" }}
                      title="编辑"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      className="p-1 rounded-md hover:bg-red-500/10 hover:text-red-500"
                      style={{ color: "var(--text-muted)" }}
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Body or Inline Edit */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey) &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void saveEdit(note);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                        }
                      }}
                      rows={3}
                      autoFocus
                      className="w-full text-[13px] leading-relaxed bg-transparent outline-none resize-none rounded-lg p-1.5 border"
                      style={{
                        borderColor: "var(--border-strong)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2 py-0.5 rounded-md text-xs hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit(note)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium"
                        style={{
                          background: "var(--text-primary)",
                          color: "var(--bg-canvas)",
                        }}
                      >
                        <Check className="w-3 h-3" />
                        <span>保存</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <p
                    onDoubleClick={() => startEdit(note)}
                    className="text-[13px] leading-[1.55] whitespace-pre-wrap break-words"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {note.content}
                  </p>
                )}

                {/* Tag chips */}
                {note.tags.length > 0 && !isEditing && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onClickTag(tag)}
                        className="px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors hover:opacity-80"
                        style={{
                          background: "var(--bg-subtle)",
                          color: "var(--text-secondary)",
                        }}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Inline Convert-to-Task Panel */}
                {isConverting && (
                  <div
                    className="mt-2.5 pt-2.5 border-t space-y-2 animate-fade-slide"
                    style={{ borderColor: "var(--border-hairline)" }}
                  >
                    <div className="text-[11.5px] font-medium" style={{ color: "var(--text-secondary)" }}>
                      选择放入的色块分区：
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {blocks.map((b) => {
                        const p = getPalette(b.color);
                        const active = targetBlockId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setTargetBlockId(b.id)}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11.5px] font-medium transition-all"
                            style={{
                              background: active
                                ? isDark
                                  ? p.cardBgDark
                                  : p.cardBgLight
                                : "var(--bg-canvas)",
                              borderColor: active
                                ? p.accent
                                : "var(--border-hairline)",
                              color: active
                                ? isDark
                                  ? p.headerInkDark
                                  : p.headerInkLight
                                : "var(--text-secondary)",
                            }}
                          >
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ background: p.accent }}
                            />
                            <span>{b.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11.5px]">
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="px-2 py-1 rounded-lg border text-xs outline-none"
                        style={{
                          background: "var(--bg-canvas)",
                          borderColor: "var(--border-hairline)",
                          color: "var(--text-primary)",
                        }}
                      />
                      <label
                        className="inline-flex items-center gap-1.5 cursor-pointer"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <input
                          type="checkbox"
                          checked={deleteAfterConvert}
                          onChange={(e) => setDeleteAfterConvert(e.target.checked)}
                          className="rounded"
                        />
                        <span>转后移除原记录</span>
                      </label>
                    </div>

                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConvertingId(null)}
                        className="px-2 py-1 rounded-lg text-xs hover:bg-[var(--bg-hover)]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => void confirmConvert(note.id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                        style={{ background: "var(--accent-ink)" }}
                      >
                        确认转入任务
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
