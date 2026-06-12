import { useState, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { SupplierFieldsProvider } from './context/SupplierFieldsContext';
import { useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import LoginPage from './pages/LoginPage';
import InvitePage from './pages/InvitePage';
import OnboardingPage from './pages/OnboardingPage';
import PortalSelectPage from './pages/PortalSelectPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ClinicApp from './ClinicApp';
import SuppliersPage from './pages/SuppliersPage';
import SupplierDetailPage from './pages/SupplierDetailPage';
import InvoicesPage from './pages/InvoicesPage';
import SpendAnalyticsPage from './pages/SpendAnalyticsPage';
import SpendSettingsPage from './pages/SpendSettingsPage';
import PracticeManagementPage from './pages/PracticeManagementPage';
import StaffManagementPage from './pages/StaffManagementPage';
import PracticeDetailPage from './pages/PracticeDetailPage';
import CasesPage from './pages/CasesPage';
import OverviewPage from './pages/OverviewPage';
import SettingsPage from './pages/SettingsPage';
import MessagesPage from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import Layout from './components/Layout';
import InviteModal from './components/InviteModal';
import StaffDetailModal from './components/StaffDetailModal';
import AddStaffModal, { StaffFormData } from './components/AddStaffModal';
import { Practice, StaffMember, mockStaffMembers, mockPractices } from './data/clinicsData';
import { Supplier, SupplierRelationshipStatus, mockSuppliers } from './data/suppliersData';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

type SupplierPage = 'overview' | 'cases' | 'practice-management' | 'staff' | 'practice-detail' | 'suppliers' | 'supplier-detail' | 'invoices' | 'spend-analytics' | 'spend-settings' | 'settings' | 'messages' | 'notifications';

// ─── URL ↔ page mapping ──────────────────────────────────────────────────────
// Source of truth: the URL under /supplier/*. Sidebar clicks and detail opens
// all push history, so a fresh reload or shared link lands on the same view.
const PAGE_TO_PATH: Record<Exclude<SupplierPage, 'practice-detail' | 'supplier-detail'>, string> = {
  overview: '',
  cases: 'cases',
  'practice-management': 'practices',
  staff: 'staff',
  suppliers: 'suppliers',
  invoices: 'invoices',
  'spend-analytics': 'analytics',
  'spend-settings': 'spend-settings',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};
const PATH_TO_PAGE: Record<string, SupplierPage> = {
  '': 'overview',
  overview: 'overview',
  cases: 'cases',
  practices: 'practice-management',
  staff: 'staff',
  suppliers: 'suppliers',
  invoices: 'invoices',
  analytics: 'spend-analytics',
  'spend-settings': 'spend-settings',
  settings: 'settings',
  messages: 'messages',
  notifications: 'notifications',
};

function SupplierApp() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Derive page + detail id from URL
  const parsed = useMemo(() => {
    const rest = location.pathname.replace(/^\/supplier\/?/, '').replace(/\/$/, '');
    const [segment = '', detailId] = rest.split('/');
    let page: SupplierPage = PATH_TO_PAGE[segment] ?? 'overview';
    if (page === 'suppliers' && detailId) page = 'supplier-detail';
    if (page === 'practice-management' && detailId) page = 'practice-detail';
    return {
      page,
      supplierId: page === 'supplier-detail' ? decodeURIComponent(detailId) : undefined,
      practiceId: page === 'practice-detail' ? decodeURIComponent(detailId) : undefined,
      invoiceId:  page === 'invoices' && detailId ? decodeURIComponent(detailId) : undefined,
      caseId:     page === 'cases' && detailId ? decodeURIComponent(detailId) : undefined,
    };
  }, [location.pathname]);

  const activePage = parsed.page;
  const setActivePage = (p: SupplierPage, id?: string) => {
    let segment = '';
    if (p === 'supplier-detail') segment = `suppliers/${id ?? ''}`;
    else if (p === 'practice-detail') segment = `practices/${id ?? ''}`;
    else {
      const base = PAGE_TO_PATH[p as Exclude<SupplierPage, 'practice-detail' | 'supplier-detail'>] ?? '';
      // invoices/:id and cases/:id are list pages that can deep-link into a detail
      segment = id && (p === 'invoices' || p === 'cases') ? `${base}/${encodeURIComponent(id)}` : base;
    }
    navigate(segment ? `/supplier/${segment}` : '/supplier');
  };

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(mockStaffMembers);
  const [supplierStatuses, setSupplierStatuses] = useState<Record<string, SupplierRelationshipStatus>>({});
  const [supplierEdits, setSupplierEdits] = useState<Record<string, Partial<Supplier>>>({});

  // Look up detail entities from the URL id
  const selectedSupplier: Supplier | null = useMemo(() => {
    if (!parsed.supplierId) return null;
    return mockSuppliers.find(s => s.id === parsed.supplierId) ?? null;
  }, [parsed.supplierId]);

  const selectedPractice: Practice | null = useMemo(() => {
    if (!parsed.practiceId) return null;
    return mockPractices.find(p => p.id === parsed.practiceId) ?? null;
  }, [parsed.practiceId]);

  const [invoiceInitialFilter, setInvoiceInitialFilter] = useState<string | undefined>(undefined);
  const invoiceInitialId = parsed.invoiceId;
  const [invoiceInitialSupplier, setInvoiceInitialSupplier] = useState<string | undefined>(undefined);
  const [supplierInitialStatusFilter, setSupplierInitialStatusFilter] = useState<SupplierRelationshipStatus | 'all' | undefined>(undefined);
  const caseInitialId = parsed.caseId;

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    practices: Practice[];
    staff: StaffMember[];
  }>({ practices: [], staff: [] });

  const [staffDetailModal, setStaffDetailModal] = useState<StaffMember | null>(null);
  const [staffEditTarget, setStaffEditTarget] = useState<StaffMember | null>(null);

  const handleNavigate = (page: string) => {
    const valid: SupplierPage[] = ['overview', 'cases', 'practice-management', 'staff', 'suppliers', 'invoices', 'spend-analytics', 'spend-settings', 'settings', 'messages', 'notifications'];
    if (valid.includes(page as SupplierPage)) {
      if (page !== 'invoices') {
        setInvoiceInitialSupplier(undefined);
        setInvoiceInitialFilter(undefined);
      }
      setActivePage(page as SupplierPage);
    }
  };

  const handleShowInviteModal = (practices: Practice[], staff: StaffMember[] = []) => {
    setInviteData({ practices, staff });
    setInviteModalOpen(true);
  };

  const handleSendInvites = (emails: { practice?: string; dentists: string[] }[]) => {
    console.log('Sending invites:', emails);
    toast.success('Invitations sent successfully');
  };

  const handlePracticeUpdated = (_updated: Practice) => {
    // Practice mutations go through mockPractices; selectedPractice re-derives
    // from the URL id on the next render, so nothing to do here besides feedback.
    toast.success('Practice updated successfully');
  };

  const handleArchivePracticeFromDetail = (practice: Practice) => {
    toast.success(`${practice.name} archived`);
  };

  const handleArchiveStaffFromModal = (staff: StaffMember) => {
    toast.success(`${staff.name} archived`);
    setStaffDetailModal(null);
  };

  const handleStaffAdded = (staff: StaffMember) => {
    setStaffMembers((prev) => [...prev, staff]);
    toast.success(`${staff.name} added successfully`);
  };

  const handleEditTemplate = () => {
    setInviteModalOpen(false);
    console.log('Edit template clicked');
  };

  const handleShowPracticeDetail = (practice: Practice) => {
    setActivePage('practice-detail', practice.id);
  };

  const handleShowStaffDetail = (staff: StaffMember) => {
    setStaffDetailModal(staff);
  };

  const handleInviteStaff = (staff: StaffMember) => {
    handleShowInviteModal([], [staff]);
  };

  const handleEditStaff = (staff: StaffMember) => {
    setStaffDetailModal(null);
    setStaffEditTarget(staff);
  };

  const handleStaffEditSubmit = (data: StaffFormData) => {
    if (!staffEditTarget) return;
    const practice = mockPractices.find((p) => p.id === data.practiceId);
    setStaffMembers((prev) =>
      prev.map((s) =>
        s.id === staffEditTarget.id
          ? {
              ...s,
              practiceId: data.practiceId,
              practiceName: practice?.name ?? s.practiceName,
              name: data.name,
              staffType: data.staffType,
              email: data.email,
              phone: data.phone,
              performerCode: data.performerCode,
              performerName: data.performerName,
              employeeId: data.employeeId,
            }
          : s
      )
    );
    toast.success(`${data.name} updated`);
    setStaffEditTarget(null);
  };

  const handleInvitePractice = (practice: Practice) => {
    handleShowInviteModal([practice]);
  };

  // Full-screen pages render outside Layout (no sidebar/header)
  if (activePage === 'messages') {
    return (
      <>
        <MessagesPage onClose={() => setActivePage('overview')} />
      </>
    );
  }

  return (
    <>
      <Layout activePage={activePage === 'practice-detail' || activePage === 'supplier-detail' ? (activePage === 'supplier-detail' ? 'suppliers' : 'practice-management') : activePage} onNavigate={handleNavigate}>
        {activePage === 'overview' && (
          <OverviewPage
            onNavigateToInvoices={(filter) => {
              setInvoiceInitialFilter(filter);
              setActivePage('invoices');
            }}
            onNavigateToSuppliers={(statusFilter) => {
              setSupplierInitialStatusFilter(statusFilter);
              setActivePage('suppliers');
            }}
            onActivityClick={(target) => {
              switch (target.kind) {
                case 'invoice':
                  setInvoiceInitialFilter(undefined);
                  setActivePage('invoices');
                  break;
                case 'case':
                  setActivePage('cases', target.id);
                  break;
                case 'supplier':
                  setActivePage('suppliers');
                  break;
                case 'practice':
                  setActivePage('practice-management');
                  break;
                case 'staff':
                  setActivePage('staff');
                  break;
                case 'extraction':
                  setActivePage('spend-settings');
                  break;
              }
            }}
          />
        )}
        {activePage === 'settings' && <SettingsPage />}
        {activePage === 'notifications' && <NotificationsPage onOpenSettings={() => setActivePage('settings')} />}
        {activePage === 'cases' && <CasesPage initialCaseId={caseInitialId} />}
        {activePage === 'suppliers' && (
          <SuppliersPage
            onSupplierClick={(s) => setActivePage('supplier-detail', s.id)}
            initialStatusFilter={supplierInitialStatusFilter}
            onNavigateToSettings={() => setActivePage('spend-settings')}
          />
        )}
        {activePage === 'supplier-detail' && selectedSupplier && (
          <SupplierDetailPage
            supplier={{ ...selectedSupplier, ...supplierEdits[selectedSupplier.id], relationshipStatus: supplierStatuses[selectedSupplier.id] ?? selectedSupplier.relationshipStatus }}
            onBack={() => setActivePage('suppliers')}
            onStatusChange={(id, status) => setSupplierStatuses(prev => ({ ...prev, [id]: status }))}
            onSave={(id, updates) => setSupplierEdits(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }))}
            onOpenInvoice={(invoiceId, supplierName) => {
              setInvoiceInitialSupplier(supplierName);
              setInvoiceInitialFilter(undefined);
              setActivePage('invoices', invoiceId);
            }}
            onNavigateToSettings={() => setActivePage('spend-settings')}
          />
        )}
        {activePage === 'invoices' && (
          <InvoicesPage
            initialFilter={invoiceInitialFilter as any}
            initialInvoiceId={invoiceInitialId}
            initialSupplier={invoiceInitialSupplier}
            onOpenCase={(caseId) => { setActivePage('cases', caseId); toast.success(`Opening ${caseId}`); }}
            onInvoiceSelected={(invoiceId) => {
              if (invoiceId) setActivePage('invoices', invoiceId);
              else setActivePage('invoices');
            }}
            onUpdateSupplier={(id, updates) => setSupplierEdits(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }))}
          />
        )}
        {activePage === 'spend-analytics' && (
          <SpendAnalyticsPage
            onNavigateToInvoices={(filter) => {
              setInvoiceInitialFilter(filter);
              setActivePage('invoices');
            }}
          />
        )}
        {activePage === 'spend-settings' && <SpendSettingsPage />}
        {activePage === 'staff' && (
          <StaffManagementPage
            onShowInviteModal={handleShowInviteModal}
            onShowStaffDetail={handleShowStaffDetail}
          />
        )}
        {activePage === 'practice-management' && (
          <PracticeManagementPage
            onShowInviteModal={handleShowInviteModal}
            onShowPracticeDetail={handleShowPracticeDetail}
          />
        )}
        {activePage === 'practice-detail' && selectedPractice && (
          <PracticeDetailPage
            practice={selectedPractice}
            staffMembers={staffMembers}
            onBack={() => setActivePage('practice-management')}
            onInvite={handleInvitePractice}
            onStaffClick={handleShowStaffDetail}
            onPracticeUpdated={handlePracticeUpdated}
            onStaffAdded={handleStaffAdded}
            onArchive={handleArchivePracticeFromDetail}
          />
        )}
      </Layout>

      {inviteModalOpen && (
        <InviteModal
          onClose={() => setInviteModalOpen(false)}
          selectedPractices={inviteData.practices}
          selectedStaff={inviteData.staff}
          onSendInvites={handleSendInvites}
          onEditTemplate={handleEditTemplate}
        />
      )}

      {staffDetailModal && (
        <StaffDetailModal
          staff={staffDetailModal}
          onClose={() => setStaffDetailModal(null)}
          onInvite={handleInviteStaff}
          onEdit={handleEditStaff}
          onArchive={handleArchiveStaffFromModal}
        />
      )}

      <AddStaffModal
        isOpen={!!staffEditTarget}
        onClose={() => setStaffEditTarget(null)}
        practices={mockPractices}
        mode="edit"
        hideDraft
        initialData={
          staffEditTarget
            ? {
                practiceId: staffEditTarget.practiceId,
                name: staffEditTarget.name,
                staffType: staffEditTarget.staffType,
                email: staffEditTarget.email,
                phone: staffEditTarget.phone,
                performerCode: staffEditTarget.performerCode,
                performerName: staffEditTarget.performerName,
                employeeId: staffEditTarget.employeeId,
              }
            : undefined
        }
        onSubmit={handleStaffEditSubmit}
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
    <SupplierFieldsProvider>
    <Routes>
      <Route path="/" element={<PortalSelectPage />} />
      <Route path="/portal-select" element={<PortalSelectPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite" element={<InvitePage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/supplier/*"
        element={
          <ProtectedRoute>
            <SupplierApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clinic/*"
        element={
          <ProtectedRoute>
            <ClinicApp />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </SupplierFieldsProvider>
    </ToastProvider>
  );
}
