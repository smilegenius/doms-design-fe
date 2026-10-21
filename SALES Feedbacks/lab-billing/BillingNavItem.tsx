import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useBilling } from './billingStore';
import { pendingInvoices } from './insights';

// ── "Billing" in the portal sidebar ──────────────────────────────────────────
// Layout's nav items are internal to src/, so the item is attached at runtime,
// right after "Invoices" (the payables inbox stays as it is). Classes match
// Layout's nav buttons. Same technique as growth-portal/WhatsNewNavItem.

function findInvoices(): HTMLElement | null {
  for (const b of document.querySelectorAll<HTMLElement>('aside nav > button')) {
    if (b.textContent?.trim() === 'Invoices' || b.getAttribute('title') === 'Invoices') return b;
  }
  return null;
}

export default function BillingNavItem() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const s = useBilling();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const sync = () => {
      const inv = findInvoices();
      if (!inv) { setHost(null); return; }
      setCollapsed(!inv.textContent?.trim());
      setHost(prev => {
        if (prev && prev.isConnected && prev.previousElementSibling === inv) return prev;
        prev?.remove();
        const el = document.createElement('div');
        el.dataset.sfBillingNav = '1';
        inv.insertAdjacentElement('afterend', el);
        return el;
      });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); setHost(h => { h?.remove(); return null; }); };
  }, []);

  if (!host) return null;
  const active = pathname.startsWith('/growth/billing');
  const pending = pendingInvoices(s).length;
  return createPortal(
    <button
      onClick={() => navigate('/growth/billing')}
      title={collapsed ? 'Billing' : undefined}
      className={`w-full flex items-center rounded-lg text-left transition-colors relative mb-0.5 ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'} ${active ? 'bg-white/30 text-[#030213]' : 'text-[#5A5568] hover:bg-white/20'}`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-r" />}
      <Receipt className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium">Billing</span>}
      {pending > 0 && (
        collapsed
          ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F59E0B]" />
          : <span className="ml-auto px-1.5 py-px rounded-full text-[10px] font-bold text-white bg-[#F59E0B]">{pending}</span>
      )}
    </button>,
    host,
  );
}
