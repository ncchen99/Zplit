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
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'btn-primary',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        {title && <h3 className="font-bold text-lg mb-2">{title}</h3>}
        <p className="text-sm">{message}</p>
        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${confirmVariant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  );
}
