import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Hash, X } from "lucide-react";
import type {
  ConvertNoteInput,
  ProjectBlock,
  SystemStatus,
  UpdateNoteInput,
  UpdateTaskInput,
  UpsertTagReminderInput,
  WorkspaceSnapshot,
} from "../mygo";
import {
  AppService,
  createBrowserPreviewSnapshot,
  createBrowserPreviewStatus,
  events,
  inDesktopRuntime,
  notifyLabel,
} from "../lib/bridge";
import type { PaletteKey } from "../lib/colors";
import { shiftDateKey, todayKey } from "../lib/dates";
import { TopBar } from "../components/TopBar";
import { ColorBlockCard } from "../components/ColorBlockCard";
import { QuickNotesPanel } from "../components/QuickNotesPanel";
import { BlockModal } from "../components/BlockModal";
import { RemindersModal } from "../components/RemindersModal";
import { DeleteBlockDialog } from "../components/DeleteBlockDialog";
import { ToastBanner, type ToastMessage } from "../components/ToastBanner";

function useResolvedDark(themeMode: string): boolean {
  const [sysDark, setSysDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  if (themeMode === "dark") return true;
  if (themeMode === "light") return false;
  return sysDark;
}

export function MainApp() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

  // Modals
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ProjectBlock | null>(null);
  const [deletingBlock, setDeletingBlock] = useState<ProjectBlock | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">, ttlMs = 4200) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    if (ttlMs > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttlMs);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const themeMode = workspace?.settings.themeMode ?? "system";
  const isDark = useResolvedDark(themeMode);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "dark" || themeMode === "light") {
      root.setAttribute("data-theme", themeMode);
    } else {
      root.removeAttribute("data-theme");
    }
  }, [themeMode]);

  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      if (!inDesktopRuntime()) {
        if (!mounted) return;
        setWorkspace(createBrowserPreviewSnapshot());
        setSystemStatus(createBrowserPreviewStatus());
        return;
      }
      try {
        const [snap, status] = await Promise.all([
          AppService.getWorkspace(),
          AppService.getSystemStatus(),
        ]);
        if (!mounted) return;
        setWorkspace(snap);
        setSystemStatus(status);
      } catch (err) {
        console.error("load workspace failed:", err);
      }
    };

    void loadInitial();

    if (!inDesktopRuntime()) {
      return () => {
        mounted = false;
      };
    }

    const offWorkspace = events.workspaceChanged.on((snap) => {
      setWorkspace(snap);
    });
    const offReminder = events.reminderFired.on((notif) => {
      pushToast(
        {
          title: notif.title,
          body: `${notif.body}\n(${notifyLabel(notif)})`,
          kind: "reminder",
          tag: notif.tag,
          taskDate: notif.taskDate,
        },
        9000,
      );
    });
    const offFocus = events.appFocus.on((target) => {
      if (target.date) setSelectedDate(target.date);
      if (target.tag) setActiveTagFilter(target.tag);
      if (target.taskId) {
        setHighlightedTaskId(target.taskId);
        window.setTimeout(() => setHighlightedTaskId(null), 3500);
      }
    });

    return () => {
      mounted = false;
      offWorkspace();
      offReminder();
      offFocus();
    };
  }, [pushToast]);

  const blocks = useMemo(
    () =>
      [...(workspace?.blocks ?? [])].sort((a, b) => a.order - b.order),
    [workspace?.blocks],
  );

  const dayTasks = useMemo(() => {
    const all = workspace?.tasks ?? [];
    return all.filter((t) => {
      if (t.date !== selectedDate) return false;
      if (
        activeTagFilter &&
        !t.tags.some((tg) => tg.toLowerCase() === activeTagFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [workspace?.tasks, selectedDate, activeTagFilter]);

  const tasksByBlock = useMemo(() => {
    const map = new Map<string, typeof dayTasks>();
    for (const b of blocks) map.set(b.id, []);
    for (const t of dayTasks) {
      const list = map.get(t.blockId);
      if (list) list.push(t);
      else if (blocks[0]) map.get(blocks[0].id)?.push(t);
    }
    return map;
  }, [blocks, dayTasks]);

  const allDayTasksRaw = useMemo(
    () => (workspace?.tasks ?? []).filter((t) => t.date === selectedDate),
    [workspace?.tasks, selectedDate],
  );
  const dayDoneCount = allDayTasksRaw.filter((t) => t.done).length;
  const dayTotalCount = allDayTasksRaw.length;
  const progressPct =
    dayTotalCount > 0 ? Math.round((dayDoneCount / dayTotalCount) * 100) : 0;

  const isViewingToday = selectedDate === todayKey();
  const yesterday = shiftDateKey(todayKey(), -1);
  const yesterdayOpenCount = useMemo(() => {
    if (!isViewingToday) return 0;
    return (workspace?.tasks ?? []).filter(
      (t) => t.date === yesterday && !t.done,
    ).length;
  }, [workspace?.tasks, isViewingToday, yesterday]);

  const activeReminderCount = useMemo(
    () => (workspace?.tagReminders ?? []).filter((r) => r.enabled).length,
    [workspace?.tagReminders],
  );

  // Handlers
  const handleSaveBlock = async (
    name: string,
    color: PaletteKey,
    editingId?: string,
  ) => {
    if (!inDesktopRuntime()) return;
    if (editingId) {
      await AppService.updateBlock({ id: editingId, name, color });
    } else {
      await AppService.createBlock({ name, color });
    }
  };

  const handleQuickRecolor = async (block: ProjectBlock, color: PaletteKey) => {
    if (!inDesktopRuntime()) return;
    await AppService.updateBlock({ id: block.id, name: block.name, color });
  };

  const handleMoveBlock = async (blockId: string, direction: -1 | 1) => {
    if (!inDesktopRuntime()) return;
    const ids = blocks.map((b) => b.id);
    const idx = ids.indexOf(blockId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    await AppService.reorderBlocks(next);
  };

  const handleDeleteBlockConfirm = async (
    blockId: string,
    moveToBlockId: string,
  ) => {
    if (!inDesktopRuntime()) return;
    await AppService.deleteBlock(blockId, moveToBlockId);
    pushToast({ title: "已删除色块分区" });
  };

  const handleAddTask = async (blockId: string, rawTitle: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.createTask({
      blockId,
      date: selectedDate,
      title: rawTitle,
    });
  };

  const handleToggleTask = async (taskId: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.toggleTask(taskId);
  };

  const handleUpdateTask = async (input: UpdateTaskInput) => {
    if (!inDesktopRuntime()) return;
    await AppService.updateTask(input);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.deleteTask(taskId);
  };

  const handleCarryOver = async () => {
    if (!inDesktopRuntime()) return;
    const moved = await AppService.carryOverTasks(yesterday, todayKey());
    if (moved > 0) {
      pushToast({ title: `已顺延昨日 ${moved} 项未完成任务到今天` });
    }
  };

  const handleCreateNote = async (content: string, tags: string[]) => {
    if (!inDesktopRuntime()) return;
    await AppService.createNote({ content, tags });
  };

  const handleUpdateNote = async (input: UpdateNoteInput) => {
    if (!inDesktopRuntime()) return;
    await AppService.updateNote(input);
  };

  const handleTogglePinNote = async (noteId: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.togglePinNote(noteId);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.deleteNote(noteId);
  };

  const handleConvertNote = async (input: ConvertNoteInput) => {
    if (!inDesktopRuntime()) return;
    await AppService.convertNoteToTask(input);
    if (input.date !== selectedDate) {
      setSelectedDate(input.date);
    }
    pushToast({ title: "已将随手记转为色块任务" });
  };

  const handleUpsertReminder = async (input: UpsertTagReminderInput) => {
    if (!inDesktopRuntime()) return;
    await AppService.upsertTagReminder(input);
    pushToast({ title: `已保存 #${input.tag} 定时提醒` });
  };

  const handleToggleReminder = async (id: string, enabled: boolean) => {
    if (!inDesktopRuntime()) return;
    await AppService.toggleTagReminder(id, enabled);
  };

  const handleDeleteReminder = async (id: string) => {
    if (!inDesktopRuntime()) return;
    await AppService.deleteTagReminder(id);
  };

  const handleTestReminder = async (ruleId: string) => {
    if (!inDesktopRuntime()) {
      pushToast({
        title: "[预览] 提醒测试",
        body: "请运行桌面客户端以触发真实 macOS 系统通知。",
        kind: "reminder",
      });
      return;
    }
    await AppService.testTagReminder(ruleId);
  };

  const handleUpdateTheme = async (mode: string) => {
    if (!inDesktopRuntime()) {
      setWorkspace((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, themeMode: mode } } : prev,
      );
      return;
    }
    await AppService.updateThemeMode(mode);
  };

  const handleCycleTheme = () => {
    const order = ["system", "light", "dark"];
    const next = order[(order.indexOf(themeMode) + 1) % order.length] ?? "system";
    void handleUpdateTheme(next);
  };

  const handleUpdateShortcut = async (shortcut: string) => {
    if (!inDesktopRuntime()) return;
    const status = await AppService.updateQuickShortcut(shortcut);
    setSystemStatus(status);
  };

  const handleRevealData = async () => {
    if (!inDesktopRuntime()) return;
    await AppService.revealDataFile();
  };

  const handleExportBackup = async () => {
    if (!inDesktopRuntime()) return;
    const saved = await AppService.exportBackup();
    if (saved) {
      pushToast({ title: "备份已导出", body: saved });
    }
  };

  const handleToggleTagFilter = (tag: string) => {
    setActiveTagFilter((curr) =>
      curr && curr.toLowerCase() === tag.toLowerCase() ? null : tag,
    );
  };

  if (!workspace) {
    return (
      <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--text-muted)" }}>
        正在打开随身记…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TopBar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        activeReminderCount={activeReminderCount}
        quickShortcut={workspace.settings.quickShortcut}
        themeMode={themeMode}
        onCycleTheme={handleCycleTheme}
        onOpenNewBlock={() => {
          setEditingBlock(null);
          setBlockModalOpen(true);
        }}
        onOpenReminders={() => setRemindersOpen(true)}
        onSummonQuickPanel={() => {
          if (inDesktopRuntime()) void AppService.showQuickPanel();
        }}
      />

      {/* Main 2-column workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left/Center: Daily Color-Block Board */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto px-5 py-4 space-y-4">
          {/* Calm daily summary & filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {dayTotalCount === 0
                    ? "今日暂无待办"
                    : `已完成 ${dayDoneCount} / ${dayTotalCount}`}
                </span>
              </div>

              {dayTotalCount > 0 && (
                <div
                  className="w-24 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "var(--bg-subtle)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${progressPct}%`,
                      background: progressPct === 100 ? "#10b981" : "var(--accent-ink)",
                    }}
                  />
                </div>
              )}

              {yesterdayOpenCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleCarryOver()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium border transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-hairline)",
                    color: "var(--accent-ink)",
                  }}
                >
                  <span>顺延昨日 {yesterdayOpenCount} 项未完成</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHideCompleted((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              {hideCompleted ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>显示已完成</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>隐藏已完成</span>
                </>
              )}
            </button>
          </div>

          {/* Lightweight #Tag quick filter bar */}
          {workspace.knownTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-0.5 text-[11px] mr-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                <Hash className="w-3 h-3" />
                标签
              </span>
              {workspace.knownTags.map((tag) => {
                const active =
                  activeTagFilter?.toLowerCase() === tag.toLowerCase();
                const hasRule = workspace.tagReminders.some(
                  (r) =>
                    r.enabled && r.tag.toLowerCase() === tag.toLowerCase(),
                );
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleTagFilter(tag)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium border transition-all"
                    style={{
                      background: active
                        ? "var(--text-primary)"
                        : "var(--bg-surface)",
                      borderColor: active
                        ? "var(--text-primary)"
                        : "var(--border-hairline)",
                      color: active
                        ? "var(--bg-canvas)"
                        : "var(--text-secondary)",
                    }}
                    title={
                      hasRule
                        ? `已配置定时提醒 · 点击筛选 #${tag}`
                        : `点击筛选 #${tag}`
                    }
                  >
                    <span>#{tag}</span>
                    {hasRule && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: active ? "#fbbf24" : "#3b82f6",
                        }}
                      />
                    )}
                  </button>
                );
              })}

              {activeTagFilter && (
                <button
                  type="button"
                  onClick={() => setActiveTagFilter(null)}
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="w-3 h-3" />
                  <span>清除筛选</span>
                </button>
              )}
            </div>
          )}

          {/* Color-Block Project Cards Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start pb-6">
            {blocks.map((block, idx) => (
              <ColorBlockCard
                key={block.id}
                block={block}
                index={idx}
                totalBlocks={blocks.length}
                tasks={tasksByBlock.get(block.id) ?? []}
                allBlocks={blocks}
                knownTags={workspace.knownTags}
                isDark={isDark}
                hideCompleted={hideCompleted}
                activeTagFilter={activeTagFilter}
                highlightedTaskId={highlightedTaskId}
                onAddTask={handleAddTask}
                onToggleTask={(id) => void handleToggleTask(id)}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={(id) => void handleDeleteTask(id)}
                onQuickRecolor={handleQuickRecolor}
                onEditBlock={(b) => {
                  setEditingBlock(b);
                  setBlockModalOpen(true);
                }}
                onMoveBlock={(id, dir) => void handleMoveBlock(id, dir)}
                onDeleteBlock={(b) => setDeletingBlock(b)}
                onClickTag={handleToggleTagFilter}
              />
            ))}
          </div>
        </main>

        {/* Right: Always-available Scratchpad ("随手记") */}
        <QuickNotesPanel
          notes={workspace.notes}
          blocks={blocks}
          knownTags={workspace.knownTags}
          selectedDate={selectedDate}
          activeTagFilter={activeTagFilter}
          isDark={isDark}
          onCreateNote={handleCreateNote}
          onUpdateNote={handleUpdateNote}
          onTogglePin={(id) => void handleTogglePinNote(id)}
          onDeleteNote={(id) => void handleDeleteNote(id)}
          onConvertNote={handleConvertNote}
          onClickTag={handleToggleTagFilter}
        />
      </div>

      {/* Modals */}
      <BlockModal
        open={blockModalOpen}
        editingBlock={editingBlock}
        isDark={isDark}
        onClose={() => setBlockModalOpen(false)}
        onSubmit={handleSaveBlock}
      />

      <RemindersModal
        open={remindersOpen}
        reminders={workspace.tagReminders}
        knownTags={workspace.knownTags}
        themeMode={themeMode}
        systemStatus={systemStatus}
        onClose={() => setRemindersOpen(false)}
        onUpsertReminder={handleUpsertReminder}
        onToggleReminder={handleToggleReminder}
        onDeleteReminder={handleDeleteReminder}
        onTestReminder={handleTestReminder}
        onUpdateShortcut={handleUpdateShortcut}
        onUpdateTheme={handleUpdateTheme}
        onRevealData={handleRevealData}
        onExportBackup={handleExportBackup}
      />

      <DeleteBlockDialog
        block={deletingBlock}
        otherBlocks={blocks.filter((b) => b.id !== deletingBlock?.id)}
        taskCount={
          deletingBlock
            ? workspace.tasks.filter((t) => t.blockId === deletingBlock.id)
                .length
            : 0
        }
        onClose={() => setDeletingBlock(null)}
        onConfirm={handleDeleteBlockConfirm}
      />

      <ToastBanner
        toasts={toasts}
        onDismiss={dismissToast}
        onFocusToast={(toast) => {
          if (toast.taskDate) setSelectedDate(toast.taskDate);
          if (toast.tag) setActiveTagFilter(toast.tag);
        }}
      />
    </div>
  );
}
