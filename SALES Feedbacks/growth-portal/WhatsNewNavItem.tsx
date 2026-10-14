import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useUpdates } from './updatesStore';

// ── "What's new" in the portal sidebar ───────────────────────────────────────
// Layout's sidebar is internal to src/, so the item is attached at runtime:
// it finds the Settings button in the sidebar's bottom actions and inserts
// itself just above it (below Analytics). Classes match Layout's nav buttons.

function findSettings(): HTMLElement | null {
  for (const b of document.querySelectorAll<HTMLElement>('aside button')) {
    const t = b.textContent?.trim();
    if ((t === 'Settings' || b.getAttribute('title') === 'Settings') && b.parentElement?.classList.contains('space-y-0.5')) return b;
  }
  return null;
}

export default function WhatsNewNavItem() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { unseen } = useUpdates();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const sync = () => {
      const settings = findSettings();
      if (!settings) { setHost(null); return; }
      setCollapsed(!settings.textContent?.trim());
      setHost(prev => {
        if (prev && prev.isConnected && prev.nextElementSibling === settings) return prev;
        prev?.remove();
        const el = document.createElement('div');
        settings.parentElement!.insertBefore(el, settings);
        return el;
      });
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { mo.disconnect(); setHost(h => { h?.remove(); return null; }); };
  }, []);

  if (!host) return null;
  const active = pathname.startsWith('/growth/updates');
  return createPortal(
    <button
      onClick={() => navigate('/growth/updates')}
      title={collapsed ? "What's new" : undefined}
      className={`w-full flex items-center rounded-lg text-left transition-colors relative ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-4 py-2.5'} ${active ? 'bg-white/30 text-[#030213]' : 'text-[#5A5568] hover:bg-white/20'}`}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-r" />}
      <Sparkles className="w-5 h-5 flex-shrink-0" />
      {!collapsed && <span className="text-sm font-medium">What's new</span>}
      {unseen > 0 && (
        collapsed
          ? <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4D8EF7]" />
          : <span className="ml-auto px-1.5 py-px rounded-full text-[10px] font-bold text-white bg-[#4D8EF7]">{unseen}</span>
      )}
    </button>,
    host,
  );
}
