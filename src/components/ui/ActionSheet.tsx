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
    return "join-item btn btn-active border-base-300 bg-base-300 text-base-content/85 font-semibold hover:border-base-300 hover:bg-base-300";
  }
  if (tone === "danger") {
    return "join-item btn btn-danger-soft text-base-content/85 font-medium";
  }
  return "join-item btn btn-white-soft text-base-content/55 font-medium hover:text-base-content/65";
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
    <div className="modal modal-open z-50">
      <div className="modal-box w-full max-w-64 p-0 shadow-2xl rounded-2xl">
        <div className="join join-vertical w-full overflow-hidden rounded-2xl bg-base-100">
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
      <button
        type="button"
        aria-label="close"
        className="modal-backdrop"
        onClick={onClose}
      />
    </div>
  );
}
