import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ProjectBlock } from "../mygo";
import { BLOCK_PALETTES, getPalette, type PaletteKey } from "../lib/colors";

interface BlockModalProps {
  open: boolean;
  editingBlock: ProjectBlock | null;
  isDark: boolean;
  onClose: () => void;
  onSubmit: (name: string, color: PaletteKey, editingId?: string) => Promise<void>;
}

export function BlockModal({
  open,
  editingBlock,
  isDark,
  onClose,
  onSubmit,
}: BlockModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<PaletteKey>("sky");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingBlock) {
      setName(editingBlock.name);
      setColor((editingBlock.color as PaletteKey) || "sky");
    } else {
      setName("");
      setColor("sky");
    }
  }, [open, editingBlock]);

  if (!open) return null;

  const preview = getPalette(color);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit(trimmed, color, editingBlock?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5 animate-fade-slide"
        style={{
          background: "var(--bg-surface)",
          borderColor: "var(--border-hairline)",
          boxShadow: "var(--shadow-float)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            {editingBlock ? "编辑色块分区" : "新建色块分区"}
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

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Live pastel card preview */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{
              background: isDark ? preview.cardBgDark : preview.cardBgLight,
              borderColor: isDark ? preview.borderDark : preview.borderLight,
            }}
          >
            <div className="h-1.5 w-full" style={{ background: preview.accent }} />
            <div className="px-3.5 py-2.5 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ background: preview.accent }}
              />
              <span
                className="text-sm font-semibold"
                style={{
                  color: isDark ? preview.headerInkDark : preview.headerInkLight,
                }}
              >
                {name.trim() || "例如：Q4 产品发布 / 个人读书"}
              </span>
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              项目 / 议题名称
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={32}
              placeholder="输入项目或议题名称…"
              className="w-full px-3 py-2 rounded-xl text-sm border outline-none focus:border-[var(--border-strong)]"
              style={{
                background: "var(--bg-canvas)",
                borderColor: "var(--border-hairline)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              分区色块
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BLOCK_PALETTES.map((p) => {
                const selected = p.key === color;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setColor(p.key)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-medium transition-all"
                    style={{
                      background: selected
                        ? isDark
                          ? p.cardBgDark
                          : p.cardBgLight
                        : "var(--bg-canvas)",
                      borderColor: selected ? p.accent : "var(--border-hairline)",
                      color: selected
                        ? isDark
                          ? p.headerInkDark
                          : p.headerInkLight
                        : "var(--text-secondary)",
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: p.accent }}
                    />
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-secondary)" }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="px-4 py-1.5 rounded-xl text-xs font-medium text-white transition-opacity disabled:opacity-40"
              style={{ background: preview.accent }}
            >
              {editingBlock ? "保存修改" : "创建色块"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
