
import React, { useEffect, useRef } from 'react';
import { Icons } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] bg-[--color-popover] rounded-lg shadow-xl m-4 flex flex-col border border-[--color-border]"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header className="flex items-center justify-between p-4 border-b border-[--color-border]">
          <h2 id="modal-title" className="text-xl font-semibold text-[--color-popover-foreground]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-[--color-muted-foreground] rounded-full hover:bg-[--color-muted] hover:text-[--color-foreground] focus:outline-none focus:ring-2 focus:ring-[--color-ring]"
            aria-label="Fermer"
          >
            <Icons.X className="w-6 h-6" />
          </button>
        </header>
        <main className="p-4 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};