import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end md:items-start justify-center z-50 md:pt-[5vh] overflow-y-auto"
      onClick={onClose}
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div
        className="modal-card bg-s1 border border-border rounded-t-2xl md:rounded-xl w-full max-w-full md:max-w-[520px] max-h-[92vh] overflow-y-auto shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-border2" />
        </div>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-[14px] text-text">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg border border-border bg-s2 text-muted cursor-pointer inline-flex items-center justify-center hover:text-text hover:bg-s3 transition-all"
            aria-label="Close"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-border flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
