import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Lock, Receipt, Search, Settings2, Users } from 'lucide-react';
import { useAuth } from '../../../src/app/context/AuthContext';
import { teamMemberFor } from '../../lab-prescription-inbox/data';
import { syncBilling, useBilling } from '../billingStore';
import { pendingInvoices } from '../insights';
import { toolName } from '../engine';
import { ReadOnly } from '../BillingApp';
import { Card, Pill } from '../ui';
import { unconfirmed } from './shared';
import Find from './Find';
import DemoPanel from './DemoPanel';
import HomeV1 from './HomeV1';
import InvoicesV1 from './InvoicesV1';
import InvoiceV1 from './InvoiceV1';
import { DentistPage, PracticePage, PracticesList } from './PracticesV1';
import SettingsV1 from './SettingsV1';

// ── Billing V1: the simpler design ───────────────────────────────────────────
// Four places, built around the lab's three jobs (get the bill out, get paid,
// know who's slipping): Home · Invoices · Practices · Settings. Same data and
// rules as V0; V0 is one click away in the header.
//
// /growth/billing                     Home: the month in three steps + Needs you
// /growth/billing/invoices[/:id]      one list with filter chips; one invoice
// /growth/billing/practices[/:id]     practices and dentists (accounts + insights)
// /growth/billing/dentists/:name      one dentist
// /growth/billing/settings[/:section] basics, prices, more options
// Old V0 addresses (accounts, insights, statements, catalog, pricing) land in the right V1 place.

const ADMIN_ROLES = ['Super Admin', 'Admin'];

export default function BillingV1() {
  const s = useBilling();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const member = teamMemberFor(user?.email);
  const [ready, setReady] = useState(false);
  const [find, setFind] = useState(false);
  useEffect(() => { syncBilling(); setReady(true); }, []);
  // ⌘K / Ctrl+K or "/" opens Find from anywhere in Billing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setFind(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const accountant = s.viewAs === 'accountant';
  const rest = pathname.replace(/^\/growth\/billing\/?/, '').replace(/\/$/, '');
  const [sub0 = '', id] = rest.split('/').map(decodeURIComponent);
  // V0 addresses still work (What's new links, nudges, bookmarks).
  const sub = ({ accounts: 'practices', insights: 'practices', reports: 'practices', statements: 'practices', catalog: 'settings', pricing: 'settings' } as Record<string, string>)[sub0] ?? sub0;
  const settingsSection = sub0 === 'catalog' ? 'prices' : sub0 === 'pricing' ? 'promotions' : id;

  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card><div className="flex items-start gap-3"><Lock className="w-5 h-5 text-[#717182]" /><div><p className="text-sm font-semibold text-[#030213]">Billing is for admins</p><p className="text-xs text-[#717182] mt-1">Prices, invoices and billing settings are open to lab admins only{member ? ` (${member.role} can't see them)` : ''}. Ask an admin if you need something changed.</p></div></div></Card>
      </div>
    );
  }

  const TABS = accountant
    ? [{ id: 'invoices', label: 'Invoices', icon: Receipt }, { id: 'practices', label: 'Practices', icon: Users }]
    : [{ id: '', label: 'Home', icon: Home }, { id: 'invoices', label: 'Invoices', icon: Receipt }, { id: 'practices', label: 'Practices', icon: Users }, { id: 'settings', label: 'Settings', icon: Settings2 }];
  const known = [...TABS.map(t => t.id), 'dentists'];
  const tab = known.includes(sub) ? sub : accountant ? 'invoices' : '';
  const activeTab = tab === 'dentists' ? 'practices' : tab;
  const waiting = pendingInvoices(s).length + s.issues.length;
  const fresh = unconfirmed(s).length;
  const tool = toolName(s);
  const expired = s.issues.some(x => x.kind === 'connection-expired');

  return (
    <ReadOnly.Provider value={accountant}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 pb-24">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Billing</h1>
            <p className="text-sm text-[#717182] mt-1">
              {accountant ? 'Accountant view: invoices and statements. Read-only.' : <>Invoices go out when a case ships.{' '}
                <button className="inline-flex items-center gap-1.5 hover:text-[#030213]" onClick={() => navigate('/growth/billing/settings')}>
                  <span className={`w-2 h-2 rounded-full ${!tool ? 'bg-[#F59E0B]' : expired ? 'bg-[#E53935]' : 'bg-[#43A047]'}`} />
                  {tool ? (expired ? `${tool} needs reconnecting` : `Payments come back from ${tool}`) : s.bank ? `Payments matched from ${s.bank === 'revolut' ? 'Revolut' : 'Wise'}` : 'No accounting tool: mark invoices paid by hand'}
                </button></>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setFind(true)} className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-xs text-[#717182] hover:border-[#4D8EF7] hover:text-[#030213] min-w-[200px]">
              <Search className="w-3.5 h-3.5" /> <span className="flex-1 text-left">Find or "how do I…"</span><kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F3F7] border border-[#E0E0E6]">⌘K</kbd>
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#E0E0E6] -mx-1 px-1">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button key={tid || 'home'} onClick={() => navigate(`/growth/billing${tid ? `/${tid}` : ''}`)} className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${activeTab === tid ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}>
              <Icon className="w-4 h-4" /> {label}
              {tid === '' && waiting + fresh > 0 && <span className="w-2 h-2 rounded-full bg-[#F59E0B]" title="Something needs you" />}
              {tid === 'practices' && fresh > 0 && !accountant && <Pill tone="blue">{fresh} new</Pill>}
            </button>
          ))}
        </nav>

        {ready && (
          <>
            {tab === '' && <HomeV1 openFind={() => setFind(true)} />}
            {tab === 'invoices' && !id && <InvoicesV1 />}
            {tab === 'invoices' && id && <InvoiceV1 id={id} />}
            {tab === 'practices' && !id && <PracticesList />}
            {tab === 'practices' && id && <PracticePage id={id} />}
            {tab === 'dentists' && id && <DentistPage name={id} />}
            {tab === 'settings' && <SettingsV1 section={settingsSection} />}
          </>
        )}
      </div>
      {find && <Find onClose={() => setFind(false)} />}
      <DemoPanel />
    </ReadOnly.Provider>
  );
}
