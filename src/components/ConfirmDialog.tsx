'use client';

import { useState } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="card max-w-sm w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{message}</p>
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm py-2 px-4">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-danger text-sm py-2 px-4">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    resolve: null,
  });

  const confirm = (title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, confirmLabel, resolve });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false }));
  };

  return {
    confirm,
    dialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
