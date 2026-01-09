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
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-800 rounded-lg shadow-xl m-4 flex flex-col border border-slate-700"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 id="modal-title" className="text-xl font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-full hover:bg-slate-700 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
