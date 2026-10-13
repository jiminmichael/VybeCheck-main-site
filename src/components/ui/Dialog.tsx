import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Native modal dialogs make the background inert and handle nested focus scopes.
export function Dialog({ children, onClose, label, className }: {
  children: React.ReactNode; onClose: () => void; label: string; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const initial = dialog.querySelector<HTMLElement>('[data-initial-focus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), button:not([disabled]), a[href]');
    (initial || dialog).focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected && !trigger.closest('[inert]')) trigger.focus();
    };
  }, []);
  return createPortal(
    <dialog ref={ref} aria-label={label} aria-modal="true" tabIndex={-1}
      className={className} style={{ margin: 0, width: '100%', maxWidth: 'none', height: '100%', maxHeight: 'none', overflowY: 'auto', alignItems: 'safe center', justifyContent: 'safe center', color: 'inherit' }}
      onCancel={event => { event.preventDefault(); close.current(); }}>
      {children}
    </dialog>, document.body);
}
