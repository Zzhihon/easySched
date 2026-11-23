import { BellRing, CheckCircle2, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  title: string;
  body?: string;
  kind?: "info" | "reminder";
  tag?: string;
  taskDate?: string;
}

interface ToastBannerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onFocusToast?: (toast: ToastMessage) => void;
}

export function ToastBanner({
  toasts,
  onDismiss,
  onFocusToast,
}: ToastBannerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => {
            if (onFocusToast && (t.tag || t.taskDate)) {
              onFocusToast(t);
              onDismiss(t.id);
            }
          }}
          className={`pointer-events-auto rounded-2xl border p-3.5 animate-fade-slide flex items-start gap-2.5 ${
            t.tag || t.taskDate ? "cursor-pointer" : ""
          }`}
          style={{
            background: "var(--bg-surface)",
            borderColor:
              t.kind === "reminder"
                ? "rgba(59, 130, 246, 0.35)"
                : "var(--border-hairline)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {t.kind === "reminder" ? (
            <BellRing className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
          )}
          <div className="min-w-0 flex-1">
            <div
              className="text-xs font-semibold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {t.title}
            </div>
            {t.body && (
              <p
                className="mt-1 text-[11.5px] leading-relaxed whitespace-pre-wrap break-words"
                style={{ color: "var(--text-secondary)" }}
              >
                {t.body}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(t.id);
            }}
            className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
