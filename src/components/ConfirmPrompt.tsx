// An "are you sure?" box drawn in the page itself. We don't use the browser's
// confirm() pop-up: when a browser blocks it, it just returns false, so the
// button looks like it does nothing at all.
export default function ConfirmPrompt({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={message}
      className="flex w-full max-w-md flex-col gap-2 rounded-xl border-2 border-gold bg-surface p-3 text-left"
    >
      <p className="text-sm font-medium break-words">{message}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-accent-strong"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="rounded-lg border-2 border-border px-3.5 py-1.5 text-sm font-medium hover:border-accent/50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
