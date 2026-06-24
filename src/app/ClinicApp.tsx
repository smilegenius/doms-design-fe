import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from './context/ToastContext';
import Layout from './components/Layout';
import ClinicOverviewPage from './pages/ClinicOverviewPage';
import ClinicAnalyticsPage from './pages/ClinicAnalyticsPage';
import CasesPage, { draftCases } from './pages/CasesPage';
import CreateCasePage from './pages/CreateCasePage';
import QuickCreateCasePage from './pages/QuickCreateCasePage';
import InvoicesPage from './pages/InvoicesPage';
import SpendSettingsPage from './pages/SpendSettingsPage';
import SettingsPage from './pages/SettingsPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import ClinicSuppliersPage from './pages/ClinicSuppliersPage';

// ─── Clinic Portal Shell ─────────────────────────────────────────────────────
// Parallel to SupplierApp but with a trimmed surface area. The Clinic Portal
// currently exposes:
//   • Overview — welcome screen + metric placeholder (metrics TBD)
//   • Cases   — reuses the supplier-portal CasesPage as-is, so the clinic sees
//                the same case list. Case creation flow will be wired in next.
//   • Invoices — reuses InvoicesPage as-is. Statuses will be customised for the
//                clinic context later; the underlying data and chrome stay the
//                same for now so we keep one source of truth.
//   • Spend Settings — invoice-related settings (nominal codes, pay period
//                extraction etc). Will eventually live inside the general
//                Settings page for clinic users; surfaced via direct route for
//                now so the screens stay reachable while we restructure.
//   • Settings / Messages / Notifications — shared shell so the top bar +
//                user menu items don't 404.
// Adding a page in future = add it to the type + route maps + render block.

type ClinicPage = 'overview' | 'cases' | 'create-case' | 'quick-create-case' | 'invoices' | 'analytics' | 'suppliers' | 'spend-settings' | 'settings' | 'messages' | 'notifications';

const PAGE_TO_PATH: Record<ClinicPage, string> = {
  overview: '',
  cases: 'cases',
  'create-case': 'cases/new',
  'quick-create-case': 'cases/quick-new',
  invoices: 'invoices',
  analytics: 'analytics',
  suppliers: 'suppliers',
  'spend-settings': 'spend-settings',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};
const PATH_TO_PAGE: Record<string, ClinicPage> = {
  '': 'overview',
  overview: 'overview',
  cases: 'cases',
  invoices: 'invoices',
  analytics: 'analytics',
  suppliers: 'suppliers',
  'spend-settings': 'spend-settings',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};

export default function ClinicApp() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active page + optional deep-link id from /clinic/<page>/<id>
  // Special-case: /clinic/cases/new resolves to the Create Case wizard rather
  // than the case detail view (the literal "new" segment is reserved).
  // For /clinic/cases/quick-new/<draftId> the 3rd segment seeds the
  // QuickCreate flow with a pre-fetched email or manual draft.
  const parsed = useMemo(() => {
    const rest = location.pathname.replace(/^\/clinic\/?/, '').replace(/\/$/, '');
    const [segment = '', detailId, draftId] = rest.split('/');
    if (segment === 'cases' && detailId === 'new') {
      return { page: 'create-case' as ClinicPage, caseId: undefined, invoiceId: undefined, supplierId: undefined, prefillDraftId: undefined };
    }
    if (segment === 'cases' && detailId === 'quick-new') {
      return { page: 'quick-create-case' as ClinicPage, caseId: undefined, invoiceId: undefined, supplierId: undefined, prefillDraftId: draftId ? decodeURIComponent(draftId) : undefined };
    }
    const page: ClinicPage = PATH_TO_PAGE[segment] ?? 'overview';
    return {
      page,
      caseId:     page === 'cases'     && detailId ? decodeURIComponent(detailId) : undefined,
      invoiceId:  page === 'invoices'  && detailId ? decodeURIComponent(detailId) : undefined,
      supplierId: page === 'suppliers' && detailId ? decodeURIComponent(detailId) : undefined,
      prefillDraftId: undefined,
    };
  }, [location.pathname]);

  const activePage = parsed.page;
  const caseInitialId = parsed.caseId;
  const invoiceInitialId = parsed.invoiceId;
  const supplierInitialId = parsed.supplierId;
  const prefillDraftId = parsed.prefillDraftId;
  const prefillDraft = useMemo(
    () => (prefillDraftId ? draftCases.find(d => d.id === prefillDraftId) ?? null : null),
    [prefillDraftId],
  );

  // Filter to apply when the Invoices list opens — set by Analytics / Overview
  // figures so clicking a number lands on the matching filtered list. Cleared
  // on any plain sidebar navigation so a normal "Invoices" click is unfiltered.
  const [invoiceFilter, setInvoiceFilter] = useState<string | undefined>(undefined);

  const setActivePage = (p: ClinicPage, id?: string) => {
    const base = PAGE_TO_PATH[p];
    // cases/:id, invoices/:id, suppliers/:id can deep-link into a detail
    // view; everything else ignores the id segment (mirrors SupplierApp).
    const segment = id && (p === 'cases' || p === 'invoices' || p === 'suppliers')
      ? `${base}/${encodeURIComponent(id)}`
      : base;
    navigate(segment ? `/clinic/${segment}` : '/clinic');
  };

  // Open the Invoices list with an optional pre-applied filter (from Analytics/
  // Overview). Sets the filter before navigating so InvoicesPage mounts with it.
  const goToInvoices = (filter?: string) => {
    setInvoiceFilter(filter);
    setActivePage('invoices');
  };

  const handleNavigate = (page: string) => {
    const valid: ClinicPage[] = ['overview', 'cases', 'invoices', 'analytics', 'suppliers', 'spend-settings', 'settings', 'messages', 'notifications'];
    if (valid.includes(page as ClinicPage)) {
      // Plain sidebar nav → drop any analytics-driven invoice filter.
      setInvoiceFilter(undefined);
      setActivePage(page as ClinicPage);
    }
  };

  // Messages takes over the full viewport (no sidebar/header) — same pattern
  // as SupplierApp keeps the chrome consistent between portals.
  if (activePage === 'messages') {
    return <MessagesPage onClose={() => setActivePage('overview')} />;
  }

  // Case-creation pages run full-screen — no sidebar, no top bar — so the
  // form can use the entire viewport. The MessagesPage escape-hatch pattern
  // makes this work without modifying Layout itself.
  if (activePage === 'create-case') {
    return (
      <CreateCasePage
        onCancel={() => setActivePage('cases')}
        onSubmitted={() => setActivePage('cases')}
        onUseQuick={() => setActivePage('quick-create-case')}
      />
    );
  }
  if (activePage === 'quick-create-case') {
    return (
      <QuickCreateCasePage
        onCancel={() => setActivePage('cases')}
        onSubmitted={() => setActivePage('cases')}
        onUseDetailed={() => setActivePage('create-case')}
        prefillDraft={prefillDraft}
      />
    );
  }

  return (
    <Layout
      activePage={activePage}
      onNavigate={handleNavigate}
      portal="clinic"
    >
      {activePage === 'overview' && (
        <ClinicOverviewPage
          onOpenCases={() => setActivePage('cases')}
          onCreateCase={() => setActivePage('quick-create-case')}
          onOpenInvoices={(filter) => goToInvoices(filter)}
          onOpenAnalytics={() => setActivePage('analytics')}
        />
      )}
      {activePage === 'analytics' && (
        <ClinicAnalyticsPage
          onOpenInvoices={(filter) => goToInvoices(filter)}
          onOpenCases={() => setActivePage('cases')}
        />
      )}
      {activePage === 'cases' && (
        <CasesPage
          initialCaseId={caseInitialId}
          onCreateCase={() => setActivePage('quick-create-case')}
          onOpenDraft={(c) => navigate(`/clinic/cases/quick-new/${encodeURIComponent(c.id)}`)}
        />
      )}
      {activePage === 'invoices' && (
        <InvoicesPage
          initialInvoiceId={invoiceInitialId}
          initialFilter={invoiceFilter as any}
          showMonthlyExports={false}
          onOpenCase={(caseId) => { setActivePage('cases', caseId); toast.success(`Opening ${caseId}`); }}
          onInvoiceSelected={(invoiceId) => {
            if (invoiceId) setActivePage('invoices', invoiceId);
            else setActivePage('invoices');
          }}
        />
      )}
      {activePage === 'suppliers' && (
        <ClinicSuppliersPage
          initialSupplierId={supplierInitialId}
          onSupplierSelected={(id) => setActivePage('suppliers', id)}
        />
      )}
      {activePage === 'spend-settings' && <SpendSettingsPage />}
      {activePage === 'settings' && <SettingsPage />}
      {activePage === 'notifications' && (
        <NotificationsPage onOpenSettings={() => setActivePage('settings')} />
      )}
    </Layout>
  );
}
