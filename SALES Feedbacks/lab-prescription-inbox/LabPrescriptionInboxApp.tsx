import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../src/app/context/ToastContext';
import Layout from '../../src/app/components/Layout';
import LabOverviewPage from '../../src/app/pages/LabOverviewPage';
import LabAnalyticsPage from '../../src/app/pages/LabAnalyticsPage';
import CasesPage, { draftCases } from '../../src/app/pages/CasesPage';
import QuickCreateCasePage from '../../src/app/pages/QuickCreateCasePage';
import InvoicesPage from '../../src/app/pages/InvoicesPage';
import MessagesPage from '../../src/app/pages/MessagesPage';
import NotificationsPage from '../../src/app/pages/NotificationsPage';
import { getCreatedCases } from '../../src/app/data/createdCases';
import PrescriptionInboxBar from './components/PrescriptionInboxBar';
import RxPhotoDock from './components/RxPhotoDock';
import LabSettingsWithInbox from './settings/LabSettingsWithInbox';
import { removeSandboxDraft, useRxInbox } from './inboxStore';
import DesignStudioPage from '../design-studio/studio/DesignStudioPage';
import { DesignStudioBar } from '../design-studio/studio/StudioEntryPoints';
import CaseDesignReviewSlot from '../design-studio/studio/CaseDesignReviewSlot';
import { ensureDesignStudioDemo, syncStudioNotifications, useStudio } from '../design-studio/store/studioStore';
import { ensureUploadDemo, syncUploadNotifications, useUploadLinks } from '../upload-links/uploadStore';
import { removeIntakeDraft, syncIntakeNotifications, useIntake } from '../intake-form/intakeStore';
import IntakeFilesDock from '../intake-form/IntakeFilesDock';
import { enterGrowth, leaveGrowth } from '../growthIsolation';

// ─── Growth Team Feedback: Lab Portal shell (Sales Feedbacks copy, at /growth) ─
// Mirrors src/app/LabApp.tsx: same URL ↔ page mapping, same Layout, same
// pages, all imported unchanged. Only three things differ, and all are local
// to this folder:
//   • Cases: the prescription-inbox bar sits above the existing CasesPage.
//   • Drafts: AI drafts from the inbox live in the created-cases store, so a
//     clicked draft is resolved from there as well as from draftCases.
//   • Settings: the lab Settings page gains a "Prescription Email Inbox" tab,
//     and Notifications gains a "Prescription Email Inbox" category.
//   • Draft review: inbox drafts get a photo dock that opens the page viewer,
//     website-form drafts a dock with the files the dentist attached.
//   • Case page: "Design review" and "Request files" items (sandbox overlay).

type LabPage = 'overview' | 'cases' | 'design-studio' | 'quick-create-case' | 'invoices' | 'analytics' | 'configuration' | 'settings' | 'messages' | 'notifications';

const PAGE_TO_PATH: Record<LabPage, string> = {
  overview: '',
  cases: 'cases',
  'design-studio': 'cases',
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

export default function LabPrescriptionInboxApp() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { resetVersion } = useRxInbox();
  const studio = useStudio();
  // Growth Team Feedback only: bring its cases into the shared list, and mirror
  // its bell entries before the first render (NotificationsPage reads the bell
  // once on mount). Leaving /growth takes both out again (growthIsolation.ts).
  useState(() => { enterGrowth(); syncStudioNotifications(); syncUploadNotifications(); syncIntakeNotifications(); return 0; });
  useEffect(() => {
    enterGrowth();
    syncStudioNotifications(); syncUploadNotifications(); syncIntakeNotifications();
    return () => leaveGrowth();
  }, []);

  // Design Studio demo cases join the real Cases list; submitted reviews reach the bell.
  useEffect(() => { ensureDesignStudioDemo(); syncStudioNotifications(); }, [studio]);
  // Upload links and website intake submissions reach the bell the same way.
  const uploads = useUploadLinks();
  const intake = useIntake();
  useEffect(() => { ensureUploadDemo(); syncUploadNotifications(); }, [uploads]);
  useEffect(() => { syncIntakeNotifications(); }, [intake]);

  const parsed = useMemo(() => {
    const rest = location.pathname.replace(/^\/growth\/?/, '').replace(/\/$/, '');
    const [segment = '', detailId, draftId] = rest.split('/');
    // Design Studio: /growth/cases/<id>/studio (reserved segment, like quick-new).
    if (segment === 'cases' && detailId && draftId === 'studio') {
      return { page: 'design-studio' as LabPage, caseId: decodeURIComponent(detailId), invoiceId: undefined, prefillDraftId: undefined };
    }
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
    () => (parsed.prefillDraftId
      ? draftCases.find(d => d.id === parsed.prefillDraftId)
        ?? getCreatedCases().find(d => d.id === parsed.prefillDraftId && d.status === 'draft')
        ?? null
      : null),
    [parsed.prefillDraftId],
  );

  const [invoiceFilter, setInvoiceFilter] = useState<string | undefined>(undefined);

  const setActivePage = (p: LabPage, id?: string) => {
    const base = PAGE_TO_PATH[p];
    const segment = id && (p === 'cases' || p === 'invoices') ? `${base}/${encodeURIComponent(id)}` : base;
    navigate(segment ? `/growth/${segment}` : '/growth');
  };

  const handleNavigate = (page: string) => {
    const valid: LabPage[] = ['overview', 'cases', 'invoices', 'analytics', 'configuration', 'settings', 'messages', 'notifications'];
    if (valid.includes(page as LabPage)) {
      setInvoiceFilter(undefined);
      setActivePage(page as LabPage);
    }
  };

  if (activePage === 'messages') {
    return <MessagesPage onClose={() => setActivePage('overview')} />;
  }

  if (activePage === 'configuration') {
    return <Navigate to="/growth/settings?tab=case-scoring" replace />;
  }

  if (activePage === 'quick-create-case') {
    return (
      <>
      <QuickCreateCasePage
        onCancel={() => setActivePage('cases')}
        onSubmitted={() => {
          // The reviewed case was saved as a new record, so the inbox draft it came from is done.
          if (prefillDraft) { removeSandboxDraft(prefillDraft.id); removeIntakeDraft(prefillDraft.id); }
          setActivePage('cases');
        }}
        prefillDraft={prefillDraft}
        counterparty="lab"
      />
      {/* Inbox drafts: the photographed prescription, page by page. */}
      {prefillDraft && <RxPhotoDock caseId={prefillDraft.id} />}
      {/* Website intake drafts: the files the dentist attached to the form. */}
      {prefillDraft && <IntakeFilesDock caseId={prefillDraft.id} />}
      </>
    );
  }

  return (
    <Layout activePage={activePage === 'design-studio' ? 'cases' : activePage} onNavigate={handleNavigate} portal="lab">
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
      {activePage === 'design-studio' && caseInitialId && <DesignStudioPage caseId={caseInitialId} />}
      {activePage === 'cases' && (
        <>
          {!caseInitialId && <PrescriptionInboxBar />}
          {!caseInitialId && <DesignStudioBar />}
          {caseInitialId && <CaseDesignReviewSlot caseId={caseInitialId} />}
          <CasesPage
            key={`${resetVersion}-${intake.resetVersion}`}
            portal="lab"
            initialCaseId={caseInitialId}
            onCreateCase={() => navigate('/growth/cases/quick-new')}
            onConfigureScoring={() => setActivePage('configuration')}
            onOpenDraft={(c) => navigate(`/growth/cases/quick-new/${encodeURIComponent(c.id)}`)}
            caseViewLimit={2}
            showConnectEmailNotice
            showScannerExpiryNotice
            onCaseSelected={(caseId, opts) => {
              if (!caseId) { navigate('/growth/cases'); return; }
              const query = opts?.conversation ? `?conversation=1&channel=${opts.conversation}` : '';
              navigate(`/growth/cases/${encodeURIComponent(caseId)}${query}`);
            }}
          />
        </>
      )}
      {activePage === 'invoices' && (
        <InvoicesPage
          initialInvoiceId={invoiceInitialId}
          initialFilter={invoiceFilter as any}
          showMonthlyExports={false}
          showScopeNotice
          onOpenCase={(caseId) => { setActivePage('cases', caseId); toast.success(`Opening ${caseId}`); }}
          onInvoiceSelected={(invoiceId) => {
            if (invoiceId) setActivePage('invoices', invoiceId);
            else setActivePage('invoices');
          }}
        />
      )}
      {activePage === 'settings' && <LabSettingsWithInbox />}
      {activePage === 'notifications' && (
        <NotificationsPage portal="lab" onOpenSettings={() => navigate('/growth/settings?tab=notifications')} />
      )}
    </Layout>
  );
}
