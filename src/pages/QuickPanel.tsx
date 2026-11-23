import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  ExternalLink,
  NotebookPen,
  ListTodo,
  SendHorizontal,
} from "lucide-react";
import type { ProjectBlock, WorkspaceSnapshot } from "../mygo";
import {
  AppService,
  createBrowserPreviewSnapshot,
  events,
  inDesktopRuntime,
} from "../lib/bridge";
import { getPalette } from "../lib/colors";
import { todayKey } from "../lib/dates";

export function QuickPanel() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [mode, setMode] = useState<"note" | "task">("note");
  const [text, setText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [reminderTime, setReminderTime] = useState<string>("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    document.body.classList.add("quick-panel-body");
    return () => document.body.classList.remove("quick-panel-body");
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!inDesktopRuntime()) {
        const snap = createBrowserPreviewSnapshot();
        setWorkspace(snap);
        setSelectedBlockId(snap.blocks[0]?.id ?? "");
        return;
      }
      const snap = await AppService.getWorkspace();
      setWorkspace(snap);
      setSelectedBlockId((curr) => curr || snap.blocks[0]?.id || "");
    };
    void load();

    if (!inDesktopRuntime()) return;

    const offWs = events.workspaceChanged.on((snap) => {
      setWorkspace(snap);
      setSelectedBlockId((curr) =>
        snap.blocks.some((b) => b.id === curr)
          ? curr
          : snap.blocks[0]?.id ?? "",
      );
    });

    const offOpen = events.quickpanelOpened.on(() => {
      setSavedFlash(false);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    });

    return () => {
      offWs();
      offOpen();
    };
  }, []);

  const themeMode = workspace?.settings.themeMode ?? "system";
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "dark" || themeMode === "light") {
      root.setAttribute("data-theme", themeMode);
    } else {
      root.removeAttribute("data-theme");
    }
  }, [themeMode]);

  const hidePanel = () => {
    if (inDesktopRuntime()) {
      void AppService.hideQuickPanel();
    }
  };

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      if (inDesktopRuntime()) {
        if (mode === "note") {
          await AppService.createNote({
            content: trimmed,
            tags: selectedTags,
          });
        } else {
          await AppService.createTask({
            blockId: selectedBlockId || workspace?.blocks[0]?.id || "",
            date: todayKey(),
            title: trimmed,
            tags: selectedTags,
            reminderTime: reminderTime || undefined,
          });
        }
      }
      setText("");
      setSelectedTags([]);
      setReminderTime("");
      setSavedFlash(true);
      window.setTimeout(() => {
        setSavedFlash(false);
        hidePanel();
      }, 260);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const blocks: ProjectBlock[] = [...(workspace?.blocks ?? [])].sort(
    (a, b) => a.order - b.order,
  );
  const knownTags = workspace?.knownTags ?? [];

  return (
    <div
      className="h-full w-full flex flex-col rounded-[18px] border overflow-hidden"
      style={{
        background: "var(--bg-surface)",
        borderColor: "var(--border-strong)",
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          hidePanel();
        }
      }}
    >
      {/* Compact Header (draggable) */}
      <div
        className="px-4 py-2.5 border-b flex items-center justify-between"
        style={{
          borderColor: "var(--border-hairline)",
          ["--app-region" as string]: "drag",
        }}
      >
        <div
          className="flex items-center gap-1 p-0.5 rounded-xl"
          style={{
            background: "var(--bg-subtle)",
            ["--app-region" as string]: "no-drag",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("note");
              inputRef.current?.focus();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: mode === "note" ? "var(--bg-surface)" : "transparent",
              color:
                mode === "note"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            <NotebookPen className="w-3.5 h-3.5" />
            <span>随手记</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("task");
              inputRef.current?.focus();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
            style={{
              background: mode === "task" ? "var(--bg-surface)" : "transparent",
              color:
                mode === "task"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            <ListTodo className="w-3.5 h-3.5" />
            <span>今日任务</span>
          </button>
        </div>

        <div
          className="flex items-center gap-2 text-[11px]"
          style={{
            color: "var(--text-muted)",
            ["--app-region" as string]: "no-drag",
          }}
        >
          <span>Esc 收起</span>
          <button
            type="button"
            onClick={() => {
              if (inDesktopRuntime()) {
                void AppService.openMainWindow();
                void AppService.hideQuickPanel();
              }
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
            title="打开主界面"
          >
            <ExternalLink className="w-3 h-3" />
            <span>主界面</span>
          </button>
        </div>
      </div>

      {/* Main Capture Input */}
      <div className="flex-1 px-4 pt-3 pb-2 flex flex-col">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            } else if (e.key === "Tab" && !e.shiftKey) {
              e.preventDefault();
              setMode((m) => (m === "note" ? "task" : "note"));
            }
          }}
          autoFocus
          placeholder={
            mode === "note"
              ? "随时记下想法或备忘… 支持 #标签（Enter 保存，Shift+Enter 换行）"
              : "输入今日任务… 支持 #标签（Enter 直接加入所选色块）"
          }
          className="flex-1 w-full text-[14.5px] leading-relaxed bg-transparent outline-none resize-none placeholder:text-[var(--text-muted)]"
          style={{ color: "var(--text-primary)" }}
        />

        {/* Context strip: Block selector (task mode) OR Tag chips (note mode) */}
        {mode === "task" ? (
          <div className="pt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {blocks.map((b) => {
                const p = getPalette(b.color);
                const active = selectedBlockId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBlockId(b.id)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium transition-all"
                    style={{
                      background: active ? `${p.accent}20` : "var(--bg-subtle)",
                      borderColor: active ? p.accent : "transparent",
                      color: active ? p.accent : "var(--text-secondary)",
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

            <div className="shrink-0 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="px-1.5 py-0.5 rounded-lg border text-[11px] outline-none"
                style={{
                  background: "var(--bg-subtle)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--text-primary)",
                }}
                title="可选：单任务提醒时间"
              />
            </div>
          </div>
        ) : (
          knownTags.length > 0 && (
            <div className="pt-2 flex items-center gap-1 overflow-x-auto py-0.5">
              {knownTags.slice(0, 8).map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors"
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
          )
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 border-t flex items-center justify-between"
        style={{
          borderColor: "var(--border-hairline)",
          background: "var(--bg-canvas)",
        }}
      >
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Tab 切换模式 · 支持输入 #标签
        </span>

        {savedFlash ? (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500 text-white">
            <Check className="w-3.5 h-3.5" />
            <span>已记录</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={!text.trim() || submitting}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg text-xs font-medium transition-opacity disabled:opacity-35 hover:opacity-90"
            style={{
              background: "var(--text-primary)",
              color: "var(--bg-canvas)",
            }}
          >
            <SendHorizontal className="w-3.5 h-3.5" />
            <span>{mode === "note" ? "记入随手记" : "加入今日色块"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
