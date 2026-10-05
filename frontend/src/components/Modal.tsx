import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className={`relative bg-white rounded-2xl shadow-xl border border-slate-100 w-full ${maxWidthClasses[maxWidth]} overflow-hidden transform transition-all z-10`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3
            id="modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
