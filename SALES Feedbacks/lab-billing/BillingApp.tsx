import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, FileText, Home, LineChart, Lock, Receipt, RotateCcw, Settings2, Tag, Users } from 'lucide-react';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { fmtDate } from './format';
import { resetBillingDemo, setViewAs, syncBilling, useBilling } from './billingStore';
import { pendingInvoices } from './insights';
import { toolName, toInvoice } from './engine';
import BillingHome from './screens/BillingHome';
import Invoices from './screens/Invoices';
import Statements from './screens/Statements';
import Insights from './screens/Insights';
import InvoiceDetail from './screens/InvoiceDetail';
import { AccountPage, AccountsList } from './screens/Accounts';
import Catalog from './screens/Catalog';
import Pricing from './screens/Pricing';
import BillingSettings from './screens/BillingSettings';
import { Card, Pill } from './ui';
import { useBillingUi } from './v1/version';
import BillingV1 from './v1/BillingV1';

// ── Billing (Growth Team Feedback): Lab Invoicing, Requirements v2 ───────────
// /growth/billing/…  home · invoices[/:id] · statements · insights · accounts[/:id]
// · catalog · pricing (only when promotions & tiers are on) · settings.
// Super Admin and Admin only; the accountant login is read-only (invoices and
// statements, no clinical data); everyone else, unknown users included, is blocked.

const ADMIN_ROLES = ['Super Admin', 'Admin'];

/** True for the read-only accountant login: action buttons hide. */
export const ReadOnly = createContext(false);
export const useReadOnly = () => useContext(ReadOnly);

export default function BillingApp() {
  // The simpler design (V1) replaced the first one; BillingV0 is kept for reference only.
  if (useBillingUi() === 'v1') return <BillingV1 />;
  return <BillingV0 />;
}

function BillingV0() {
  const s = useBilling();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const member = teamMemberFor(user?.email);
  const [ready, setReady] = useState(false);
  // Bring billing up to date with the case list (new cases, dispatches) on the way in.
  useEffect(() => { syncBilling(); setReady(true); }, []);

  const accountant = s.viewAs === 'accountant';
  const TABS = accountant
    ? [{ id: 'invoices', label: 'Invoices', icon: Receipt }, { id: 'statements', label: 'Statements & reports', icon: FileText }]
    : [
      { id: '', label: 'Home', icon: Home },
      { id: 'invoices', label: 'Invoices', icon: Receipt },
      { id: 'statements', label: 'Statements & reports', icon: FileText },
      { id: 'insights', label: 'Insights', icon: LineChart },
      { id: 'accounts', label: 'Accounts', icon: Users },
      { id: 'catalog', label: 'Catalog', icon: BookOpen },
      ...(s.settings.promotionsOn ? [{ id: 'pricing', label: 'Promotions & tiers', icon: Tag }] : []),
      { id: 'settings', label: 'Settings', icon: Settings2 },
    ];
  const KNOWN = TABS.map(t => t.id);

  const rest = pathname.replace(/^\/growth\/billing\/?/, '').replace(/\/$/, '');
  const [sub0 = '', id] = rest.split('/').map(decodeURIComponent);
  // Old addresses: reports moved into Insights.
  const sub = sub0 === 'reports' ? 'insights' : sub0;
  const tab = KNOWN.includes(sub) ? sub : accountant ? 'invoices' : '';

  // Only known admins. Unknown users (not in the lab team) are blocked too.
  if (!member || !ADMIN_ROLES.includes(member.role)) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card><div className="flex items-start gap-3"><Lock className="w-5 h-5 text-[#717182]" /><div><p className="text-sm font-semibold text-[#030213]">Billing is for admins</p><p className="text-xs text-[#717182] mt-1">Pricing, invoices and billing settings are open to lab admins only{member ? ` (${member.role} can't see them)` : ''}. Ask an admin if you need something changed.</p></div></div></Card>
      </div>
    );
  }

  const pending = pendingInvoices(s).length + s.issues.length;
  const pot = toInvoice(s).length;
  const tool = toolName(s);
  return (
    <ReadOnly.Provider value={accountant}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Billing</h1>
            <p className="text-sm text-[#717182] mt-1">
              {accountant ? 'Accountant view: invoices, statements and exports. Read-only, no clinical data.' : `Invoices follow Shipped. ${tool ? `${tool} reconciles payments; paid status comes back on its own.` : 'Mark invoices paid when the money arrives.'}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tool ? (
              <button onClick={() => !accountant && navigate('/growth/billing/settings')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-xs text-[#030213] hover:bg-[#F8F9FC]">
                <span className={`w-2 h-2 rounded-full ${s.issues.some(x => x.kind === 'connection-expired') ? 'bg-[#E53935]' : 'bg-[#43A047]'}`} /> {tool} {s.issues.some(x => x.kind === 'connection-expired') ? 'needs reconnecting' : 'connected'}{s.setup.liveAt ? ` · live since ${fmtDate(s.setup.liveAt)}` : ''}
              </button>
            ) : <button onClick={() => !accountant && navigate('/growth/billing/settings')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs text-[#92400E]"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> No accounting tool{s.bank ? ` · ${s.bank === 'revolut' ? 'Revolut' : 'Wise'} connected` : ''}</button>}
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#717182]" title="Demo: see Billing as the lab's accountant">
              View as
              <select value={s.viewAs} onChange={e => { setViewAs(e.target.value as 'admin' | 'accountant'); navigate(e.target.value === 'accountant' ? '/growth/billing/invoices' : '/growth/billing'); }} className="px-1.5 py-1 rounded-md border border-[#E0E0E6] text-[11px] bg-white">
                <option value="admin">Admin</option>
                <option value="accountant">Accountant (read-only)</option>
              </select>
            </label>
            {!accountant && <button onClick={() => { resetBillingDemo(); toast.success('Billing demo reset'); }} title="Reset the Billing demo data" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-[#717182] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]"><RotateCcw className="w-3 h-3" /> Reset demo</button>}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#E0E0E6] -mx-1 px-1">
          {TABS.map(({ id: tid, label, icon: Icon }) => {
            const active = tab === tid && !(sub === 'invoices' && id && tid !== 'invoices');
            return (
              <button key={tid || 'home'} onClick={() => navigate(`/growth/billing${tid ? `/${tid}` : ''}`)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${active ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}>
                <Icon className="w-3.5 h-3.5" /> {label}
                {tid === '' && pending > 0 && <Pill tone="amber">{pending}</Pill>}
                {tid === 'invoices' && !accountant && pot > 0 && <Pill tone="blue">{pot} to invoice</Pill>}
              </button>
            );
          })}
        </nav>

        {ready && (
          <>
            {tab === '' && <BillingHome />}
            {tab === 'invoices' && !id && <Invoices />}
            {tab === 'invoices' && id && <InvoiceDetail id={id} />}
            {tab === 'statements' && <Statements />}
            {tab === 'insights' && <Insights />}
            {tab === 'accounts' && !id && <AccountsList />}
            {tab === 'accounts' && id && <AccountPage id={id} />}
            {tab === 'catalog' && <Catalog />}
            {tab === 'pricing' && <Pricing />}
            {tab === 'settings' && <BillingSettings />}
          </>
        )}
      </div>
    </ReadOnly.Provider>
  );
}
