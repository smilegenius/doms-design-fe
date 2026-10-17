import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// ── An extra tab in the case page's order form panel ─────────────────────────
// CaseDetailPage's panel reads Order form | Lab Documents | Print. Sandbox tabs
// (LabLink form, Email) go right after Lab Documents, at runtime. While one is
// active, sandbox.css hides the native body and the native tabs' underline;
// clicking a native tab, or another sandbox tab, hands over.

interface Panel { panel: HTMLElement; bar: HTMLElement; docsTab: HTMLElement }

function findPanel(): Panel | null {
  const docsTab = [...document.querySelectorAll<HTMLElement>('button')].find(b => b.textContent?.trim() === 'Lab Documents' && b.closest('main'));
  const bar = docsTab?.parentElement;
  const panel = bar?.parentElement;
  return docsTab && bar && panel ? { panel, bar, docsTab } : null;
}

export default function OrderPanelTab({ tabKey, label, icon, openOnLoad, children }: {
  tabKey: string;
  label: string;
  icon: ReactNode;
  /** Open straight away (deep link). */
  openOnLoad?: boolean;
  children: ReactNode;
}) {
  const [found, setFound] = useState<Panel | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setFound(prev => { const n = findPanel(); return prev && n && prev.panel === n.panel && prev.docsTab === n.docsTab ? prev : n; });
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!found) { setHost(null); return; }
    const el = document.createElement('span');
    el.className = 'contents';
    el.dataset.sfPtabHost = tabKey;
    // After "Lab Documents" and any sandbox tab already there.
    let after: Element = found.docsTab;
    while (after.nextElementSibling instanceof HTMLElement && after.nextElementSibling.dataset.sfPtabHost) after = after.nextElementSibling;
    after.insertAdjacentElement('afterend', el);
    setHost(el);
    return () => { el.remove(); };
  }, [found, tabKey]);

  useEffect(() => {
    if (!found || !active) return;
    found.panel.setAttribute('data-sf-ptab', tabKey);
    return () => { if (found.panel.getAttribute('data-sf-ptab') === tabKey) found.panel.removeAttribute('data-sf-ptab'); };
  }, [found, active, tabKey]);

  useEffect(() => {
    if (!found) return;
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || btn.textContent?.trim() === 'Print') return;
      if ((btn as HTMLElement).dataset.sfPtab !== tabKey) setActive(false);
    };
    found.bar.addEventListener('click', onClick, true);
    return () => found.bar.removeEventListener('click', onClick, true);
  }, [found, tabKey]);

  useEffect(() => {
    if (!found || !openOnLoad) return;
    setActive(true);
    const t = window.setTimeout(() => found.panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
    return () => window.clearTimeout(t);
  }, [found, openOnLoad]);

  if (!found) return null;
  return (
    <>
      {host && createPortal(
        <button
          data-sf-ptab={tabKey}
          onClick={() => setActive(true)}
          className={`sf-ptab-tab inline-flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${active ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}
        >
          {icon}
          {label}
        </button>,
        host,
      )}
      {active && createPortal(<div className="sf-ptab-body p-4 space-y-3 overflow-y-auto max-h-[420px]">{children}</div>, found.panel)}
    </>
  );
}
