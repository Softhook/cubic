import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dismissable modal: closes on Escape, a backdrop click or the × button, and returns focus to
 * whatever opened it. Portalled to <body> so ancestors with backdrop-filter (e.g. .panel) can't
 * trap the fixed overlay. `aria-modal` also tells the global undo shortcut to stand down.
 */
export function Dialog({ title, subtitle, wide, className = '', onClose, children }: {
  title: string;
  subtitle?: string;
  wide?: boolean;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal dialog ${wide ? 'wide' : ''} ${className}`} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="icon-btn dialog-close" onClick={onClose} aria-label="Close">×</button>
        <h2 id={titleId}>{title}</h2>
        {subtitle && <p className="modal-sub">{subtitle}</p>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
