import { useEffect } from "react";

type ActionTone = "default" | "active" | "danger";

export interface ActionSheetItem {
  key: string;
  label: string;
  tone?: ActionTone;
  disabled?: boolean;
  onClick: () => void;
}

interface ActionSheetProps {
  open: boolean;
  items: ActionSheetItem[];
  onClose: () => void;
}

function resolveButtonClass(tone: ActionTone | undefined): string {
  if (tone === "active") {
    return "join-item btn border-base-300 bg-base-300 text-base-content/85 hover:border-base-300 hover:bg-base-300";
  }
  if (tone === "danger") return "join-item btn btn-danger-soft";
  return "join-item btn btn-white-soft";
}

export function ActionSheet({ open, items, onClose }: ActionSheetProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-base-content/20"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-sm">
        <div className="join join-vertical w-full gap-2 bg-base-100">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.disabled}
              className={`${resolveButtonClass(item.tone)} btn-block justify-start`}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
