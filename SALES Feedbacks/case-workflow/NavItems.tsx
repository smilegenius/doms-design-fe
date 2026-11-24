import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ListChecks } from 'lucide-react';
import { isOpen, unreadFor, useWorkflow } from './workflowStore';
import { useMe } from './shared';

// ── V2: "My queue" and "Calendar" in the portal sidebar, right after Cases ───
// Same runtime technique as BillingNavItem (Layout's nav is internal to src/).

function findCases(): HTMLElement | null {
  for (const b of document.querySelectorAll<HTMLElement>('aside nav > button')) {
    if (b.textContent?.trim() === 'Cases' || b.getAttribute('title') === 'Cases') return b;
  }
  return null;
}

export default function WorkflowNavItems() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const s = useWorkflow();
  const me = useMe();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const sync = () => {
      const c = findCases();
      if (!c) { setHost(null); return; }
      setCollapsed(!c.textContent?.trim());
      setHost(prev => {
        if (prev && prev.isConnected && prev.previousElementSibling === c) return prev;
        prev?.remove();
        const el = document.createElement('div');
        el.dataset.sfWorkflowNav = '1';
        c.insertAdjacentElement('afterend', el);
        return el;
      });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); setHost(h => { h?.remove(); return null; }); };
  }, []);
  if (!host) return null;
  const mine = Object.values(s.lines).filter(l => isOpen(l) && l.owner === me && (l.status === 'in-production' || l.status === 'qc'));
  const unread = mine.some(l => unreadFor(s, l, me).length > 0);
  const item = (to: string, label: string, Icon: typeof ListChecks, badge?: number, dot?: boolean) => {
    const active = pathname.startsWith(to);
    return (
      <button key={to} onClick={() => navigate(to)} title={collapsed ? label : undefined} className={`w-full flex items-center rounded-lg text-left transition-colors relative mb-0.5 ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'} ${active ? 'bg-white/30 text-[#030213]' : 'text-[#5A5568] hover:bg-white/20'}`}>
        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-r" />}
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{label}</span>}
        {!collapsed && badge ? <span className="ml-auto px-1.5 py-px rounded-full text-[10px] font-bold text-white bg-[#7C3AED]">{badge}</span> : null}
        {dot && <span className={`${collapsed ? 'absolute top-1.5 right-1.5' : ''} w-2 h-2 rounded-full bg-[#E53935]`} title="Unread notes" />}
      </button>
    );
  };
  return createPortal(<>{item('/growth/queue', 'My queue', ListChecks, mine.length, unread)}{item('/growth/calendar', 'Calendar', CalendarDays)}</>, host);
}
