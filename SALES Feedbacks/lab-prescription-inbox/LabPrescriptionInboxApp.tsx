import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../src/app/context/ToastContext';
import { useAuth } from '../../src/app/context/AuthContext';
import { teamMemberFor } from './data';
import Layout from '../../src/app/components/Layout';
import LabOverviewPage from '../../src/app/pages/LabOverviewPage';
import LabAnalyticsPage from '../../src/app/pages/LabAnalyticsPage';
import CasesPage, { draftCases, mockCases } from '../../src/app/pages/CasesPage';
import QuickCreateCasePage from '../../src/app/pages/QuickCreateCasePage';
import InvoicesPage from '../../src/app/pages/InvoicesPage';
import MessagesPage from '../../src/app/pages/MessagesPage';
import NotificationsPage from '../../src/app/pages/NotificationsPage';
import { getCreatedCases, useCreatedCases } from '../../src/app/data/createdCases';
import PrescriptionInboxBar from './components/PrescriptionInboxBar';
import RxPhotoDock from './components/RxPhotoDock';
import LabSettingsWithInbox from './settings/LabSettingsWithInbox';
import { removeSandboxDraft, useRxInbox } from './inboxStore';
import DesignStudioPage from '../design-studio/studio/DesignStudioPage';
import { DesignStudioBar } from '../design-studio/studio/StudioEntryPoints';
import CaseDesignReviewSlot, { pendingOpen } from '../design-studio/studio/CaseDesignReviewSlot';
import { ensureDesignStudioDemo, syncStudioNotifications, useStudio } from '../design-studio/store/studioStore';
import { ensureUploadDemo, syncUploadNotifications, useUploadLinks } from '../upload-links/uploadStore';
import { INTAKE_ID_PREFIX, linkConfirmedCase, removeIntakeDraft, syncIntakeNotifications, useIntake } from '../intake-form/intakeStore';
import { ensureIntakeDemo } from '../intake-form/intakeDemo';
import IntakeFilesDock from '../intake-form/IntakeFilesDock';
import { enterGrowth, leaveGrowth, saveGrowthStash } from '../growthIsolation';
import WhatsNewPage from '../growth-portal/WhatsNewPage';
import WhatsNewNavItem from '../growth-portal/WhatsNewNavItem';

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

type LabPage = 'overview' | 'cases' | 'design-studio' | 'quick-create-case' | 'invoices' | 'analytics' | 'configuration' | 'settings' | 'messages' | 'notifications' | 'updates';

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
  updates: 'updates',
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
  updates: 'updates',
};

export default function LabPrescriptionInboxApp() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { resetVersion } = useRxInbox();
  const studio = useStudio();
  const { user } = useAuth();
  const meEmail = teamMemberFor(user?.email)?.email;
  // Growth Team Feedback only: bring its cases into the shared list, and mirror
  // its bell entries before the first render (NotificationsPage reads the bell
  // once on mount). Leaving /growth takes both out again (growthIsolation.ts).
  useState(() => { enterGrowth(); ensureDesignStudioDemo(); syncStudioNotifications(); syncUploadNotifications(); syncIntakeNotifications(meEmail); return 0; });
  useEffect(() => {
    enterGrowth();
    syncStudioNotifications(); syncUploadNotifications(); syncIntakeNotifications(meEmail);
    return () => leaveGrowth();
  }, []);
  const createdCases = useCreatedCases();
  useEffect(() => { saveGrowthStash(); }, [createdCases]);

  // Design Studio demo cases join the real Cases list; submitted reviews reach the bell.
  useEffect(() => { ensureDesignStudioDemo(); syncStudioNotifications(); }, [studio]);
  // Upload links and website intake submissions reach the bell the same way.
  const uploads = useUploadLinks();
  const intake = useIntake();
  useEffect(() => { ensureUploadDemo(); syncUploadNotifications(); }, [uploads]);
  useEffect(() => { ensureIntakeDemo(); }, []);
  useEffect(() => { syncIntakeNotifications(meEmail); }, [intake, meEmail]);

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

  // CasesPage opens a case from the URL only when it's one of its built-in cases.
  // Created cases (the Design Studio demos, drafts) open by clicking their row,
  // so a deep link such as /growth/cases/SG-2026-0481?sf=design clicks it for you.
  useEffect(() => {
    if (activePage !== 'cases' || !caseInitialId || mockCases.some(c => c.id === caseInitialId)) return;
    const sf = new URLSearchParams(location.search).get('sf');
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      if (document.querySelector('.sf-design-tab') || tries > 30) { window.clearInterval(t); return; }
      const el = [...document.querySelectorAll<HTMLElement>('main *')].find(e => e.children.length === 0 && e.textContent?.trim() === caseInitialId);
      if (el) { pendingOpen.value = sf; el.click(); window.clearInterval(t); return; }
      // Not on the first page of the list: search for it, then click it.
      const search = document.querySelector<HTMLInputElement>('main input[placeholder*="case ID"]');
      if (search && tries === 4) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, caseInitialId);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 150);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, caseInitialId]);

  // Cases that existed when QuickCreate opened: the one that's new after submit is the confirmed case.
  const casesBeforeConfirm = useMemo(() => new Set(getCreatedCases().map(c => c.id)), [prefillDraft?.id]);

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
          if (prefillDraft?.id.startsWith(INTAKE_ID_PREFIX)) {
            // A website draft the lab checked and confirmed: remember the real case it became.
            const confirmed = getCreatedCases().find(c => !casesBeforeConfirm.has(c.id));
            if (confirmed) linkConfirmedCase(prefillDraft.id, confirmed.id, teamMemberFor(user?.email)?.name);
          }
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
      {activePage === 'updates' && <WhatsNewPage />}
      <WhatsNewNavItem />
      {activePage === 'notifications' && (
        <NotificationsPage portal="lab" onOpenSettings={() => navigate('/growth/settings?tab=notifications')} />
      )}
    </Layout>
  );
}
