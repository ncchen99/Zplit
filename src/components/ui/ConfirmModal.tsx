import { createPortal } from "react-dom";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** DaisyUI button variant for the confirm button, e.g. "btn-error", "btn-primary" */
  confirmVariant?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "btn-primary",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const resolvedConfirmClass = (() => {
    if (confirmVariant.includes("error")) return "btn-danger-soft";
    if (confirmVariant.includes("primary")) return "btn-theme-green";
    if (confirmVariant.includes("outline")) return "btn-muted";
    return `btn ${confirmVariant}`;
  })();

  // .modal 是 position:fixed，若祖先帶有 transform 會改以該祖先為定位基準
  // 而錯位，因此固定掛在 body 底下
  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box">
        {title && <h3 className="font-bold text-lg mb-2">{title}</h3>}
        <p className="text-sm">{message}</p>
        <div className="modal-action">
          <button className="btn-white-soft" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={resolvedConfirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>,
    document.body,
  );
}
