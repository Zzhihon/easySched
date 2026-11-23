import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ProjectBlock } from "../mygo";

interface DeleteBlockDialogProps {
  block: ProjectBlock | null;
  otherBlocks: ProjectBlock[];
  taskCount: number;
  onClose: () => void;
  onConfirm: (blockId: string, moveToBlockId: string) => Promise<void>;
}

export function DeleteBlockDialog({
  block,
  otherBlocks,
  taskCount,
  onClose,
  onConfirm,
}: DeleteBlockDialogProps) {
  const [mode, setMode] = useState<"move" | "delete">("move");
  const [moveTargetId, setMoveTargetId] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (block) {
      setMode("move");
      setMoveTargetId(otherBlocks[0]?.id ?? "");
    }
  }, [block, otherBlocks]);

  if (!block) return null;

  const handleConfirm = async () => {
    setWorking(true);
    try {
      await onConfirm(block.id, taskCount > 0 && mode === "move" ? moveTargetId : "");
      onClose();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5 animate-fade-slide space-y-4"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
          boxShadow: "var(--shadow-float)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            删除色块「{block.name}」
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {taskCount > 0 ? (
          <div className="space-y-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <p>该分区共有 {taskCount} 条历史/今日任务，请选择处理方式：</p>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === "move"}
                onChange={() => setMode("move")}
              />
              <span>转移到其他分区：</span>
            </label>

            {mode === "move" && (
              <select
                value={moveTargetId}
                onChange={(e) => setMoveTargetId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border text-xs outline-none"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: "var(--border-hairline)",
                  color: "var(--text-primary)",
                }}
              >
                {otherBlocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center gap-2 cursor-pointer text-red-500">
              <input
                type="radio"
                checked={mode === "delete"}
                onChange={() => setMode("delete")}
              />
              <span>连同任务一并删除</span>
            </label>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            该色块下暂无任务，确定删除吗？
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void handleConfirm()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
