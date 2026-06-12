import { ReactNode } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import ModalPortal from './ModalPortal';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${sizes[size]} mx-4 max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-6 border-b border-[#E0E0E6] flex-shrink-0">
          <h2 className="text-xl font-semibold text-[#030213]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#F3F3F5] transition-colors"
          >
            <X className="w-5 h-5 text-[#717182]" />
          </button>
        </div>
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          {children}
        </div>
        {footer && (
          <div className="border-t border-[#E0E0E6] p-6 flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
