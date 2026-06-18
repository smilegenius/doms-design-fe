import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from './context/ToastContext';
import Layout from './components/Layout';
import LabOverviewPage from './pages/LabOverviewPage';
import LabAnalyticsPage from './pages/LabAnalyticsPage';
import LabScoringSettingsPage from './pages/LabScoringSettingsPage';
import CasesPage from './pages/CasesPage';
import InvoicesPage from './pages/InvoicesPage';
import SettingsPage from './pages/SettingsPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';

// ─── Lab Portal Shell ────────────────────────────────────────────────────────
// The manufacturing lab's workspace. Cases arrive from the lab's clients
// (clinics + dental groups); the lab triages and produces them. Unlike the
// clinic portal, the lab doesn't create cases — it receives them — so the cases
// list is read-only here. The Lab Portal exposes:
//   • Overview      — incoming work, production, prescription completeness
//   • Cases         — the shared CasesPage (now with the completeness Score)
//   • Invoices      — shared InvoicesPage
//   • Analytics     — lab throughput + completeness-by-service
//   • Configuration — Case Scoring setup (weighted fields per service type)

type LabPage = 'overview' | 'cases' | 'invoices' | 'analytics' | 'configuration' | 'settings' | 'messages' | 'notifications';

const PAGE_TO_PATH: Record<LabPage, string> = {
  overview: '',
  cases: 'cases',
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

  const parsed = useMemo(() => {
    const rest = location.pathname.replace(/^\/lab\/?/, '').replace(/\/$/, '');
    const [segment = '', detailId] = rest.split('/');
    const page: LabPage = PATH_TO_PAGE[segment] ?? 'overview';
    return {
      page,
      caseId:    page === 'cases'    && detailId ? decodeURIComponent(detailId) : undefined,
      invoiceId: page === 'invoices' && detailId ? decodeURIComponent(detailId) : undefined,
    };
  }, [location.pathname]);

  const activePage = parsed.page;
  const caseInitialId = parsed.caseId;
  const invoiceInitialId = parsed.invoiceId;

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
        <CasesPage initialCaseId={caseInitialId} onConfigureScoring={() => setActivePage('configuration')} />
      )}
      {activePage === 'invoices' && (
        <InvoicesPage
          initialInvoiceId={invoiceInitialId}
          initialFilter={invoiceFilter as any}
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
