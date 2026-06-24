import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from './context/ToastContext';
import Layout from './components/Layout';
import LabOverviewPage from './pages/LabOverviewPage';
import LabAnalyticsPage from './pages/LabAnalyticsPage';
import LabScoringSettingsPage from './pages/LabScoringSettingsPage';
import CasesPage, { draftCases } from './pages/CasesPage';
import QuickCreateCasePage from './pages/QuickCreateCasePage';
import InvoicesPage from './pages/InvoicesPage';
import SettingsPage from './pages/SettingsPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';

// ─── Lab Portal Shell ────────────────────────────────────────────────────────
// The manufacturing lab's workspace. Cases arrive from the lab's clients
// (clinics + dental groups); the lab triages and produces them. The Lab Portal
// exposes:
//   • Overview      — incoming work, production, prescription completeness
//   • Cases         — the shared CasesPage (now with the completeness Score)
//   • Invoices      — shared InvoicesPage
//   • Analytics     — lab throughput + completeness-by-service
//   • Configuration — Case Scoring setup (weighted fields per service type)
// Draft cases open the QuickCreate case screen pre-filled (in draft state) —
// same as the clinic — rather than the read-only Case Detail page.

type LabPage = 'overview' | 'cases' | 'quick-create-case' | 'invoices' | 'analytics' | 'configuration' | 'settings' | 'messages' | 'notifications';

const PAGE_TO_PATH: Record<LabPage, string> = {
  overview: '',
  cases: 'cases',
  'quick-create-case': 'cases/quick-new',
  invoices: 'invoices',
  analytics: 'analytics',
  configuration: 'configuration',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};
const PATH_TO_PAGE: Record<string, LabPage> = {
  '': 'overview',
  overview: 'overview',
  cases: 'cases',
  invoices: 'invoices',
  analytics: 'analytics',
  configuration: 'configuration',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};

export default function LabApp() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active page + optional deep-link id from /lab/<page>/<id>.
  // /lab/cases/quick-new/<draftId> resolves to the QuickCreate flow with the
  // clicked draft pre-filled (the "quick-new" segment is reserved).
  const parsed = useMemo(() => {
    const rest = location.pathname.replace(/^\/lab\/?/, '').replace(/\/$/, '');
    const [segment = '', detailId, draftId] = rest.split('/');
    if (segment === 'cases' && detailId === 'quick-new') {
      return { page: 'quick-create-case' as LabPage, caseId: undefined, invoiceId: undefined, prefillDraftId: draftId ? decodeURIComponent(draftId) : undefined };
    }
    const page: LabPage = PATH_TO_PAGE[segment] ?? 'overview';
    return {
      page,
      caseId:    page === 'cases'    && detailId ? decodeURIComponent(detailId) : undefined,
      invoiceId: page === 'invoices' && detailId ? decodeURIComponent(detailId) : undefined,
      prefillDraftId: undefined,
    };
  }, [location.pathname]);

  const activePage = parsed.page;
  const caseInitialId = parsed.caseId;
  const invoiceInitialId = parsed.invoiceId;
  const prefillDraft = useMemo(
    () => (parsed.prefillDraftId ? draftCases.find(d => d.id === parsed.prefillDraftId) ?? null : null),
    [parsed.prefillDraftId],
  );

  const [invoiceFilter, setInvoiceFilter] = useState<string | undefined>(undefined);

  const setActivePage = (p: LabPage, id?: string) => {
    const base = PAGE_TO_PATH[p];
    const segment = id && (p === 'cases' || p === 'invoices') ? `${base}/${encodeURIComponent(id)}` : base;
    navigate(segment ? `/lab/${segment}` : '/lab');
  };

  const handleNavigate = (page: string) => {
    const valid: LabPage[] = ['overview', 'cases', 'invoices', 'analytics', 'configuration', 'settings', 'messages', 'notifications'];
    if (valid.includes(page as LabPage)) {
      setInvoiceFilter(undefined);
      setActivePage(page as LabPage);
    }
  };

  // Messages takes over the full viewport — same pattern as the other portals.
  if (activePage === 'messages') {
    return <MessagesPage onClose={() => setActivePage('overview')} />;
  }

  // A clicked draft opens the QuickCreate screen full-screen (no sidebar/top
  // bar) pre-filled with the draft's data, so the lab can review/complete it.
  if (activePage === 'quick-create-case') {
    return (
      <QuickCreateCasePage
        onCancel={() => setActivePage('cases')}
        onSubmitted={() => setActivePage('cases')}
        prefillDraft={prefillDraft}
      />
    );
  }

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate} portal="lab">
      {activePage === 'overview' && (
        <LabOverviewPage
          onOpenCases={() => setActivePage('cases')}
          onOpenConfiguration={() => setActivePage('configuration')}
          onOpenAnalytics={() => setActivePage('analytics')}
        />
      )}
      {activePage === 'analytics' && (
        <LabAnalyticsPage
          onOpenCases={() => setActivePage('cases')}
          onOpenConfiguration={() => setActivePage('configuration')}
        />
      )}
      {activePage === 'cases' && (
        <CasesPage
          initialCaseId={caseInitialId}
          onConfigureScoring={() => setActivePage('configuration')}
          onOpenDraft={(c) => navigate(`/lab/cases/quick-new/${encodeURIComponent(c.id)}`)}
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
      {activePage === 'configuration' && <LabScoringSettingsPage />}
      {activePage === 'settings' && <SettingsPage />}
      {activePage === 'notifications' && (
        <NotificationsPage onOpenSettings={() => setActivePage('settings')} />
      )}
    </Layout>
  );
}
