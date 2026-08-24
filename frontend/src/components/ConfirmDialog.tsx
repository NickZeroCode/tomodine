/**
 * ConfirmDialog — reusable confirmation dialog replacing window.confirm().
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm("Delete this item?");
 *   if (ok) deleteItem();
 */

import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "@/components/Modal";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

type ResolveFn = (result: boolean) => void;

/**
 * Hook that returns a `confirm(options)` function.
 * Returns `true` if the user confirmed, `false` if cancelled.
 */
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: ResolveFn;
  } | null>(null);

  const confirm = useCallback(
    (messageOrOptions: string | ConfirmOptions): Promise<boolean> => {
      const options: ConfirmOptions =
        typeof messageOrOptions === "string"
          ? { message: messageOrOptions }
          : messageOrOptions;

      return new Promise<boolean>((resolve) => {
        setState({ options, resolve });
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog: ReactNode = state ? (
    <ConfirmDialog
      options={state.options}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { title, message, confirmLabel, cancelLabel, variant = "danger" } = options;

  const btnClass =
    variant === "danger"
      ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
      : variant === "warning"
        ? "rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
        : "btn-primary";

  return (
    <Modal
      title={title || "Confirm"}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel || "Cancel"}
          </button>
          <button type="button" className={btnClass} onClick={onConfirm}>
            {confirmLabel || "Confirm"}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">{message}</p>
    </Modal>
  );
}
