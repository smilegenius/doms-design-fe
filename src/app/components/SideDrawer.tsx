import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import ModalPortal from './ModalPortal';

// ─── Side drawer ─────────────────────────────────────────────────────────────
// The right-slide panel the Case Details page uses for its Conversation hub,
// extracted so other case-level surfaces (CareStack, related cases) can share
// the exact same chrome. Portalled so it covers the top bar + sidebar.

export default function SideDrawer({
  open, onClose, title, subtitle, icon, iconBg = 'bg-[#EEF4FF]', children, width = 'md:w-[55%] md:max-w-[680px]', zIndex = 'z-[100]',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  children: ReactNode;
  width?: string;
  zIndex?: string;
}) {
  if (!open) return null;
  return (
    <ModalPortal>
      <div className={`fixed inset-0 ${zIndex} flex`}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className={`relative md:ml-auto flex flex-col bg-white shadow-2xl w-full ${width} h-full animate-in slide-in-from-right duration-200`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {icon && <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>{icon}</div>}
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#030213] truncate">{title}</h3>
                {subtitle && <p className="text-[11px] text-[#717182] truncate">{subtitle}</p>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#FAFBFC] p-4">
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
