import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, BookOpen, Home, Lock, RotateCcw, Settings2, Tag, Users } from 'lucide-react';
import { useAuth } from '../../src/app/context/AuthContext';
import { useToast } from '../../src/app/context/ToastContext';
import { teamMemberFor } from '../lab-prescription-inbox/data';
import { fmtDate } from './format';
import { resetBillingDemo, syncBilling, useBilling } from './billingStore';
import { pendingInvoices } from './insights';
import BillingHome from './screens/BillingHome';
import InvoiceDetail from './screens/InvoiceDetail';
import { AccountPage, AccountsList } from './screens/Accounts';
import Catalog from './screens/Catalog';
import Pricing from './screens/Pricing';
import BillingSettings from './screens/BillingSettings';
import Reports from './screens/Reports';
import { Card, Pill } from './ui';

// ── Billing (Growth Team Feedback): Lab Invoicing & Accounting Sync ──────────
// /growth/billing/…  home · invoices/:id · accounts[/:id] · catalog · pricing
// · reports · settings. Admins only.

const TABS = [
  { id: '', label: 'Home', icon: Home },
  { id: 'accounts', label: 'Accounts', icon: Users },
  { id: 'catalog', label: 'Catalog', icon: BookOpen },
  { id: 'pricing', label: 'Promotions & tiers', icon: Tag },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Billing settings', icon: Settings2 },
];

const ADMIN_ROLES = ['Super Admin', 'Admin'];
const KNOWN = ['', 'invoices', 'accounts', 'catalog', 'pricing', 'reports', 'settings'];

export default function BillingApp() {
  const s = useBilling();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const member = teamMemberFor(user?.email);
  const [ready, setReady] = useState(false);
  // Bring billing up to date with the case list (new cases, dispatches) on the way in.
  useEffect(() => { syncBilling(); setReady(true); }, []);

  const rest = pathname.replace(/^\/growth\/billing\/?/, '').replace(/\/$/, '');
  const [sub = '', id] = rest.split('/').map(decodeURIComponent);
  const tab = sub === 'invoices' || !KNOWN.includes(sub) ? '' : sub;

  if (member && !ADMIN_ROLES.includes(member.role)) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card><div className="flex items-start gap-3"><Lock className="w-5 h-5 text-[#717182]" /><div><p className="text-sm font-semibold text-[#030213]">Billing is for admins</p><p className="text-xs text-[#717182] mt-1">Pricing, invoices and billing settings are open to lab admins only ({member.role} can't see them). Ask an admin if you need something changed.</p></div></div></Card>
      </div>
    );
  }

  const pending = pendingInvoices(s).length;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Billing</h1>
          <p className="text-sm text-[#717182] mt-1">Every case invoiced automatically, posted to {s.setup.provider === 'quickbooks' ? 'QuickBooks' : 'Xero'}, one statement per account at month end.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.setup.provider ? (
            <button onClick={() => navigate('/growth/billing/settings')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-xs text-[#030213] hover:bg-[#F8F9FC]">
              <span className="w-2 h-2 rounded-full bg-[#43A047]" /> {s.setup.provider === 'xero' ? 'Xero' : 'QuickBooks'} connected{s.setup.liveAt ? ` · live since ${fmtDate(s.setup.liveAt)}` : ''}
            </button>
          ) : <button onClick={() => navigate('/growth/billing/settings')} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs text-[#92400E]"><span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Not connected: connect Xero</button>}
          <button onClick={() => { resetBillingDemo(); toast.success('Billing demo reset'); }} title="Reset the Billing demo data" className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-[#717182] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC]"><RotateCcw className="w-3 h-3" /> Reset demo</button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-[#E0E0E6] -mx-1 px-1">
        {TABS.map(({ id: tid, label, icon: Icon }) => {
          const active = tab === tid;
          return (
            <button key={tid || 'home'} onClick={() => navigate(`/growth/billing${tid ? `/${tid}` : ''}`)} className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${active ? 'border-[#4D8EF7] text-[#4D8EF7]' : 'border-transparent text-[#717182] hover:text-[#030213]'}`}>
              <Icon className="w-3.5 h-3.5" /> {label}{tid === '' && pending > 0 && <Pill tone="amber">{pending}</Pill>}
            </button>
          );
        })}
      </nav>

      {ready && (
        <>
          {(sub === '' || !KNOWN.includes(sub)) && <BillingHome />}
          {sub === 'invoices' && id && <InvoiceDetail id={id} />}
          {sub === 'accounts' && !id && <AccountsList />}
          {sub === 'accounts' && id && <AccountPage id={id} />}
          {sub === 'catalog' && <Catalog />}
          {sub === 'pricing' && <Pricing />}
          {sub === 'reports' && <Reports />}
          {sub === 'settings' && <BillingSettings />}
        </>
      )}
    </div>
  );
}
