import { createPortal } from 'react-dom';
import { useNavSlot } from '../growth-portal/navSlot';
import { useLocation, useNavigate } from 'react-router-dom';
import { PenTool } from 'lucide-react';
import { useCad } from './cadStore';
import { orderFlags } from './screens/DesignBoard';

// ── "Design" in the portal sidebar ───────────────────────────────────────────
// Attached at runtime right after "Cases" (Layout's nav items are internal to
// src/). Same technique as lab-billing/BillingNavItem. The badge counts cases
// that need attention (waiting on a dentist too long, late partner, queued…).

function findCases(): HTMLElement | null {
  for (const b of document.querySelectorAll<HTMLElement>('aside nav > button')) {
    if (b.textContent?.trim() === 'Cases' || b.getAttribute('title') === 'Cases') return b;
  }
  return null;
}

export default function DesignNavItem() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const s = useCad();
  const { host, collapsed } = useNavSlot(findCases, 'after', 1);

  if (!host) return null;
  const active = pathname.startsWith('/growth/design');
  const attention = Object.values(s.orders).filter(o => o.status !== 'cancelled' && orderFlags(o).some(f => f.tone === 'red')).length;
  return createPortal(
    <button
      onClick={() => navigate('/growth/design')}
      title={collapsed ? 'Design' : undefined}
      className={`w-full flex items-center rounded-lg text-left transition-colors relative mb-0.5 ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'} ${active ? 'bg-white/30 text-[#030213]' : 'text-[#5A5568] hover:bg-white/20'}`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-r" />}
      <PenTool className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium">Design</span>}
      {attention > 0 && (
        collapsed
          ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E53935]" />
          : <span className="ml-auto px-1.5 py-px rounded-full text-[10px] font-bold text-white bg-[#E53935]">{attention}</span>
      )}
    </button>,
    host,
  );
}
