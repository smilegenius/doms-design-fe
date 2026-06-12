import React, { useState, useMemo, useEffect, useRef } from 'react';
import CaseDetailPage, { OrderFormModal, ServiceItem } from './CaseDetailPage';
import {
  Plus,
  Download,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsUpDown,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  AlertTriangle,
  RefreshCw,
  Settings2,
  X,
  Grid3x3,
  List,
  Filter,
  MoreHorizontal,
  Check,
  Mail,
  PenLine,
} from 'lucide-react';
import Button from '../components/Button';
import SearchInput from '../components/SearchInput';
import SortDropdown from '../components/SortDropdown';
import Pagination from '../components/Pagination';
import FilterDrawer from '../components/FilterDrawer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CaseStatus =
  | 'draft'
  | 'new'
  | 'submitted'
  | 'in-production'
  | 'quality-check'
  | 'shipped'
  | 'delivered'
  | 'refinement'
  | 'on-hold'
  | 'completed';

type Scanner = 'iTero' | '3Shape' | 'Medit' | 'Carestream';

// How the case data physically reached the clinic.
//   scanner — captured by a chairside intra-oral scanner
//   email   — auto-fetched from the practice inbox with a prescription PDF
//   manual  — typed by a clinic user (optionally from an uploaded prescription)
export type CaseSource = 'scanner' | 'email' | 'manual';

// Metadata for an email-sourced case. Surfaces on the case detail header AND
// in the preview pane when the user opens the case-creation full-screen view.
export interface EmailPrescription {
  fromName: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;        // human-readable, e.g. "2 hr ago" or "12-Jun-2026 09:14"
  attachmentName: string;    // prescription file name
  bodyPreview: string;       // 1-2 sentence excerpt of the email body
}

export interface Case {
  id: string;
  patientName: string;
  practice: string;
  dentist: string;
  // Lab/supplier where the case was sent for manufacturing.
  lab: string;
  services: string[];
  serviceItems: ServiceItem[];
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  requestedDelivery: string | null;
  hasAlert: boolean;
  scanner: Scanner;
  // Where this case came from. Drives the leftmost source icon and (for
  // email) the prescription preview pane shown during case creation.
  source: CaseSource;
  emailPrescription?: EmailPrescription;
}

type ViewMode = 'table' | 'grid';
type SortColumn = 'createdAt' | 'updatedAt' | null;
type SortDir = 'asc' | 'desc';

// ─── Mock Data ────────────────────────────────────────────────────────────────

const ALL_SERVICES = ['Clear Aligners', 'Night Guard', 'Retainer', 'Veneers', 'Crown', 'Bridge', 'Partial Denture', 'Full Denture'];
const PRACTICES = ['Smile Genius Belfast', 'Smile Genius Birmingham 1', 'Smile Genius Birmingham 2', 'Smile Genius Manchester', 'Smile Genius London Central', 'Smile Genius Glasgow', 'Smile Genius Leeds'];
const DENTISTS = ['Dr. Anderson', 'Dr. Campbell', 'Dr. Davies', 'Dr. Murphy', 'Dr. White', 'Sophie Wilson'];
// Lab/supplier the case was sent to — pulled from the same supplier registry the rest of the app uses.
const LABS = ['Smile Genius Lab', 'Kingsbridge Dental Lab', 'Patterson Dental UK', 'Eurodontic Ltd', 'Smile Ceramics Studio', 'Dentsply Sirona Lab'];
// STATUSES intentionally excludes 'draft' — mock generator + service items
// shouldn't randomly produce drafts; the draft-status seed cases below are
// hand-rolled and live in `draftCases`.
const STATUSES: Exclude<CaseStatus, 'draft'>[] = ['new', 'submitted', 'in-production', 'quality-check', 'shipped', 'delivered', 'refinement', 'on-hold', 'completed'];
const PATIENT_FIRST = ['James', 'Emma', 'Oliver', 'Sophia', 'William', 'Isabella', 'Benjamin', 'Mia', 'Elijah', 'Charlotte', 'Lucas', 'Amelia', 'Mason', 'Harper', 'Logan', 'Evelyn', 'Alexander', 'Abigail', 'Ethan', 'Emily', 'Daniel', 'Elizabeth', 'Michael', 'Sofia', 'Henry', 'Avery', 'Jackson', 'Ella', 'Sebastian', 'Scarlett'];
const PATIENT_LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Young', 'Allen', 'King'];
const DATES_CREATED = ['02-Jan-2026', '15-Jan-2026', '28-Jan-2026', '03-Feb-2026', '14-Feb-2026', '22-Feb-2026', '07-Mar-2026', '17-Mar-2026', '25-Mar-2026', '01-Apr-2026', '10-Apr-2026', '18-Apr-2026', '28-Apr-2026', '05-May-2026', '12-May-2026'];
const DATES_UPDATED = ['10-Jan-2026', '20-Jan-2026', '05-Feb-2026', '18-Feb-2026', '28-Feb-2026', '10-Mar-2026', '20-Mar-2026', '30-Mar-2026', '08-Apr-2026', '17-Apr-2026', '26-Apr-2026', '07-May-2026', '14-May-2026', '17-May-2026', '18-May-2026'];
const DELIVERY_DATES = ['20-May-2026', '25-May-2026', '30-May-2026', '05-Jun-2026', '10-Jun-2026', '15-Jun-2026', '01-Jun-2026', '28-May-2026', '10-May-2026', '05-May-2026', '28-Apr-2026', '15-Apr-2026'];
const SCANNERS: Scanner[] = ['iTero', '3Shape', 'Medit', 'Carestream'];

function ScannerIcon({ scanner, size = 32 }: { scanner: Scanner; size?: number }) {
  const imgs: Record<Scanner, string> = {
    iTero:      '/scanner-itero.png.png',
    '3Shape':   '/scanner-3shape.png.png',
    Medit:      '/scanner-medit.png.png',
    Carestream: '/scanner-3shape.png.png',
  };

  return (
    <span title={scanner}>
      <img src={imgs[scanner]} alt={scanner} style={{ width: size, height: size, minWidth: size }} className="flex-shrink-0 rounded-full object-cover" />
    </span>
  );
}

// Leftmost-column source indicator. Cases captured by a chairside scanner
// fall back to the brand-specific ScannerIcon (the existing pattern); email
// and manual sources get a flat coloured tile so the case origin is
// immediately readable at row glance.
function SourceIcon({ source, scanner, size = 32 }: { source: CaseSource; scanner: Scanner; size?: number }) {
  if (source === 'scanner') return <ScannerIcon scanner={scanner} size={size} />;
  if (source === 'email') {
    return (
      <span
        title="Auto-fetched from email"
        style={{ width: size, height: size, minWidth: size }}
        className="flex-shrink-0 rounded-full bg-[#EEF4FF] border border-[#C8D8FC] inline-flex items-center justify-center"
      >
        <Mail className="w-4 h-4 text-[#1565C0]" />
      </span>
    );
  }
  return (
    <span
      title="Manual entry"
      style={{ width: size, height: size, minWidth: size }}
      className="flex-shrink-0 rounded-full bg-[#F3F3F5] border border-[#E0E0E6] inline-flex items-center justify-center"
    >
      <PenLine className="w-4 h-4 text-[#5A5568]" />
    </span>
  );
}

function pick<T>(arr: T[], i: number): T { return arr[i % arr.length]; }

const mockCases: Case[] = Array.from({ length: 50 }, (_, i) => {
  const firstName   = pick(PATIENT_FIRST, i * 3 + 1);
  const lastName    = pick(PATIENT_LAST,  i * 7 + 2);
  const statusIndex = (i * 11 + 3) % STATUSES.length;
  const hasDelivery = i % 4 !== 3;
  const deliveryIndex = i % DELIVERY_DATES.length;
  const primaryDelivery = hasDelivery ? DELIVERY_DATES[deliveryIndex] : null;
  const primarySvc  = ALL_SERVICES[(i * 7) % ALL_SERVICES.length];

  // Build typed ServiceItem list — ~20 % get 3 services, ~30% get 2, rest 1.
  const phases = primarySvc === 'Clear Aligners' ? [
    {
      label: 'Phase 1',
      status: (statusIndex >= 4 ? 'received' : statusIndex >= 2 ? 'completed' : 'in-progress') as 'received' | 'completed' | 'in-progress' | 'pending',
      deliveryDate: DELIVERY_DATES[deliveryIndex],
    },
    {
      label: 'Phase 2',
      status: (statusIndex >= 5 ? 'received' : statusIndex >= 4 ? 'in-progress' : 'pending') as 'received' | 'completed' | 'in-progress' | 'pending',
      deliveryDate: DELIVERY_DATES[(deliveryIndex + 3) % DELIVERY_DATES.length],
    },
  ] : undefined;

  // ── Per-service prescription mock — deterministic, seeded off an integer so
  // every render produces the same values for the same service slot. Surfaces
  // in the per-service Details tab and the Case Summary cards.
  const FDI_POOL = [11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28,31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48];
  const MATERIALS = ['Zirconia', 'PFM', 'E.max', 'Composite', 'Cobalt Chrome'];
  const SHADES    = ['A1', 'A2', 'A3', 'B1', 'C2'];
  const ORDER_TYPES = ['NHS', 'Private'];
  function svcExtras(seed: number) {
    // Pick 2-6 FDI teeth deterministically — stride through the pool.
    const teethCount = 2 + (seed % 5);
    const start = (seed * 7) % FDI_POOL.length;
    const stride = 1 + (seed % 4);
    const fdi: number[] = [];
    const seen = new Set<number>();
    for (let k = 0; k < teethCount; k++) {
      const idx = (start + k * stride) % FDI_POOL.length;
      const tooth = FDI_POOL[idx];
      if (!seen.has(tooth)) { fdi.push(tooth); seen.add(tooth); }
    }
    return {
      fdi: fdi.sort((a, b) => a - b),
      material: MATERIALS[seed % MATERIALS.length],
      shade:    SHADES[seed % SHADES.length],
      orderType: ORDER_TYPES[seed % ORDER_TYPES.length],
      instructions: seed % 3 === 0
        ? 'Match adjacent tooth shade exactly. Patient sensitive to nickel.'
        : undefined,
      scanFileCount:   seed % 5,
      attachmentCount: (seed + 2) % 4,
    };
  }

  const s1: ServiceItem = {
    id: `${i}-s1`,
    name: primarySvc,
    status: STATUSES[statusIndex],
    deliveryDate: primaryDelivery,
    phases,
    ...svcExtras(i),
  };

  const serviceItems: ServiceItem[] = i % 5 === 0
    ? [
        s1,
        {
          id: `${i}-s2`,
          name: ALL_SERVICES[(i * 3 + 2) % ALL_SERVICES.length],
          status: STATUSES[(statusIndex + 3) % STATUSES.length],
          deliveryDate: DELIVERY_DATES[(deliveryIndex + 2) % DELIVERY_DATES.length],
          ...svcExtras(i * 3 + 2),
        },
        {
          id: `${i}-s3`,
          name: ALL_SERVICES[(i * 5 + 4) % ALL_SERVICES.length],
          status: STATUSES[(statusIndex + 5) % STATUSES.length],
          deliveryDate: DELIVERY_DATES[(deliveryIndex + 4) % DELIVERY_DATES.length],
          ...svcExtras(i * 5 + 4),
        },
      ]
    : i % 3 === 0
      ? [
          s1,
          {
            id: `${i}-s2`,
            name: ALL_SERVICES[(i * 3 + 2) % ALL_SERVICES.length],
            status: STATUSES[(statusIndex + 3) % STATUSES.length],
            deliveryDate: DELIVERY_DATES[(deliveryIndex + 2) % DELIVERY_DATES.length],
            ...svcExtras(i * 3 + 2),
          },
        ]
      : [s1];

  const services = serviceItems.map(si => si.name);

  return {
    id: `CASE-${String(i + 1).padStart(3, '0')}`,
    patientName: `${firstName} ${lastName}`,
    practice: pick(PRACTICES, i * 2 + 1),
    dentist: pick(DENTISTS, i * 3 + 2),
    lab: pick(LABS, i * 5 + 1),
    services,
    serviceItems,
    status: STATUSES[statusIndex],
    createdAt: pick(DATES_CREATED, i * 2),
    updatedAt: pick(DATES_UPDATED, i * 3 + 1),
    requestedDelivery: primaryDelivery,
    hasAlert: i % 7 === 0,
    scanner: SCANNERS[i % SCANNERS.length],
    source: 'scanner',
  };
});

// ── Email + manual draft cases ───────────────────────────────────────────────
// Sit at the top of the list (most recent first) so the inbox-fetched cases
// surface immediately. Each carries enough prescription metadata to power the
// left preview pane in the case-creation full-screen view.
// Exported so the routing layer can look up a draft by id when the user
// clicks one — the URL becomes /clinic/cases/quick-new/CASE-DRAFT-001 and
// QuickCreateCasePage prefills from the matching entry.
export const draftCases: Case[] = [
  {
    id: 'CASE-DRAFT-001',
    patientName: 'Lauren Hughes',
    practice: 'Smile Genius Manchester',
    dentist: 'Dr. Murphy',
    lab: 'S4S London',
    services: ['Night Guard'],
    serviceItems: [{
      id: 'd1-s1',
      name: 'Night Guard',
      status: 'new',
      deliveryDate: null,
      fdi: [16, 17, 26, 27, 36, 37, 46, 47],
      material: 'Soft EVA',
      shade: 'Clear',
      orderType: 'Private',
      instructions: 'Upper soft splint, 2mm. Patient grinds.',
      scanFileCount: 0,
      attachmentCount: 1,
    }],
    status: 'draft',
    createdAt: '12-Jun-2026',
    updatedAt: '12-Jun-2026',
    requestedDelivery: '26-Jun-2026',
    hasAlert: false,
    scanner: 'iTero',
    source: 'email',
    emailPrescription: {
      fromName: 'Dr. Murphy',
      fromEmail: 'dr.murphy@smilegenius.co.uk',
      subject: 'New Rx — Lauren Hughes — Upper Night Guard',
      receivedAt: '2 hr ago',
      attachmentName: 'Hughes_L_Rx_S4S.pdf',
      bodyPreview: 'Hi team, please find attached the prescription for Lauren Hughes — upper soft splint, 2mm. Impressions taken today, sending by courier.',
    },
  },
  {
    id: 'CASE-DRAFT-002',
    patientName: 'Ravi Patel',
    practice: 'Smile Genius Birmingham 1',
    dentist: 'Dr. Davies',
    lab: 'Kingsbridge Dental Lab',
    services: ['Crown'],
    serviceItems: [{
      id: 'd2-s1',
      name: 'Crown',
      status: 'new',
      deliveryDate: null,
      fdi: [16],
      material: 'Zirconia',
      shade: 'A2',
      orderType: 'Private',
      instructions: 'Single crown UR6. Match shade A2.',
      scanFileCount: 0,
      attachmentCount: 1,
    }],
    status: 'draft',
    createdAt: '12-Jun-2026',
    updatedAt: '12-Jun-2026',
    requestedDelivery: null,
    hasAlert: false,
    scanner: 'iTero',
    source: 'email',
    emailPrescription: {
      fromName: 'Reception — Birmingham 1',
      fromEmail: 'reception.b1@smilegenius.co.uk',
      subject: 'Crown Rx — Ravi Patel (UR6) — please action',
      receivedAt: '5 hr ago',
      attachmentName: 'Patel_R_Crown_Rx.pdf',
      bodyPreview: 'Forwarding Rx from Dr. Davies for Ravi Patel — zirconia crown on UR6, shade A2. Impressions in the post.',
    },
  },
  {
    id: 'CASE-DRAFT-003',
    patientName: 'Hannah Clarke',
    practice: 'Smile Genius London Central',
    dentist: 'Dr. White',
    lab: 'Smile Genius Lab',
    services: ['Clear Aligners'],
    serviceItems: [{
      id: 'd3-s1',
      name: 'Clear Aligners',
      status: 'new',
      deliveryDate: null,
      fdi: [11, 12, 13, 21, 22, 23, 31, 32, 33, 41, 42, 43],
      material: 'Composite',
      shade: 'Clear',
      orderType: 'Private',
      scanFileCount: 0,
      attachmentCount: 1,
    }],
    status: 'draft',
    createdAt: '11-Jun-2026',
    updatedAt: '11-Jun-2026',
    requestedDelivery: null,
    hasAlert: false,
    scanner: 'iTero',
    source: 'email',
    emailPrescription: {
      fromName: 'Dr. White',
      fromEmail: 'dr.white@smilegenius.co.uk',
      subject: 'Aligner Rx — Hannah Clarke — Phase 1',
      receivedAt: '1 day ago',
      attachmentName: 'Clarke_H_Aligners_Rx.pdf',
      bodyPreview: 'Hi lab team, attached is the aligner prescription for Hannah Clarke. Phase 1 only for now; treatment plan to follow.',
    },
  },
  {
    id: 'CASE-DRAFT-004',
    patientName: 'Tom Bennett',
    practice: 'Smile Genius Glasgow',
    dentist: 'Dr. Anderson',
    lab: 'Eurodontic Ltd',
    services: ['Retainer'],
    serviceItems: [{
      id: 'd4-s1',
      name: 'Retainer',
      status: 'new',
      deliveryDate: null,
      fdi: [11, 12, 13, 21, 22, 23],
      material: 'Composite',
      shade: 'Clear',
      orderType: 'NHS',
      scanFileCount: 0,
      attachmentCount: 0,
    }],
    status: 'draft',
    createdAt: '11-Jun-2026',
    updatedAt: '11-Jun-2026',
    requestedDelivery: null,
    hasAlert: false,
    scanner: 'iTero',
    source: 'manual',
  },
];

mockCases.unshift(...draftCases);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<CaseStatus, string> = {
  draft: 'Draft',
  new: 'New',
  submitted: 'Submitted',
  'in-production': 'In Production',
  'quality-check': 'Quality Check',
  shipped: 'Shipped',
  delivered: 'Delivered',
  refinement: 'Refinement',
  'on-hold': 'On Hold',
  completed: 'Completed',
};

const STATUS_STYLE: Record<CaseStatus, { bg: string; text: string; border: string; icon: any }> = {
  draft:           { bg: '#FFF8E1', text: '#A16207', border: '#FDE68A', icon: PenLine },
  new:             { bg: '#F3F3F5', text: '#5A5568', border: '#E0E0E6', icon: Package },
  submitted:       { bg: '#EEF4FF', text: '#1565C0', border: '#C8D8FC', icon: Package },
  'in-production': { bg: '#F5F3FF', text: '#7C3AED', border: '#EDE9FE', icon: RefreshCw },
  'quality-check': { bg: '#FFF7ED', text: '#E65100', border: '#FED7AA', icon: CheckCircle2 },
  shipped:         { bg: '#F0FDF4', text: '#2E7D32', border: '#BBF7D0', icon: Truck },
  delivered:       { bg: '#E0F7FA', text: '#00838F', border: '#B2EBF2', icon: CheckCircle2 },
  refinement:      { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8', icon: Settings2 },
  'on-hold':       { bg: '#FFF1F2', text: '#BE123C', border: '#FECACA', icon: Clock },
  completed:       { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2 },
};

function parseDate(d: string): Date {
  const months: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const [day, mon, year] = d.split('-');
  return new Date(Number(year), months[mon], Number(day));
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date(2026, 4, 19);
  return parseDate(dateStr) < today;
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap border"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage({ initialCaseId, onCreateCase, onOpenDraft }: {
  initialCaseId?: string;
  onCreateCase?: () => void;
  // Called when the user clicks a draft case (status === 'draft'). The host
  // navigates to the case-creation flow with this draft pre-filled instead of
  // opening the read-only Case Detail page.
  onOpenDraft?: (caseData: Case) => void;
} = {}) {
  const [cases] = useState<Case[]>(mockCases);
  const [selectedCase, setSelectedCase] = useState<Case | null>(() => {
    if (initialCaseId) return mockCases.find(c => c.id === initialCaseId) ?? null;
    return null;
  });
  // Open the requested case when the prop changes after mount
  React.useEffect(() => {
    if (initialCaseId) {
      const c = mockCases.find(c => c.id === initialCaseId);
      if (c) setSelectedCase(c);
    }
  }, [initialCaseId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [practiceFilter, setPracticeFilter] = useState<string>('all');
  const [dentistFilter, setDentistFilter] = useState<string>('all');
  const [scannerFilter, setScannerFilter] = useState<string>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'alerts'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'overdue' | 'upcoming' | 'no-date'>('all');
  // Quick time-window chip — operates on the case's last updated timestamp.
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '1d' | '7d'>('all');

  // ── Column visibility — saved per-user in localStorage so preferences persist ──
  type ColId = 'status' | 'caseId' | 'createdAt' | 'updatedAt' | 'deliveryDate' | 'patient' | 'service' | 'practice' | 'lab' | 'dentist';
  const DEFAULT_COLS: Record<ColId, boolean> = {
    status: true,
    caseId: true,
    createdAt: true,
    updatedAt: true,
    deliveryDate: true,
    patient: true,
    service: true,
    practice: true,
    lab: false,         // off by default — opt-in
    dentist: true,
  };
  const COL_LABELS: Record<ColId, string> = {
    status: 'Status',
    caseId: 'Case ID',
    createdAt: 'Created On',
    updatedAt: 'Updated On',
    deliveryDate: 'Delivery Date',
    patient: 'Patient Name',
    service: 'Service(s)',
    practice: 'Practice',
    lab: 'Lab',
    dentist: 'Dentist',
  };
  const [visibleCols, setVisibleCols] = useState<Record<ColId, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLS;
    try {
      const saved = localStorage.getItem('cases.columns');
      if (saved) return { ...DEFAULT_COLS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_COLS;
  });
  function toggleCol(id: ColId) {
    setVisibleCols((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function persistCols() {
    try { localStorage.setItem('cases.columns', JSON.stringify(visibleCols)); } catch {}
  }
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Centered order-form modal triggered from the Eye icon on a row.
  const [orderFormCase, setOrderFormCase] = useState<Case | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [sortBy, setSortBy] = useState('created-newest');
  const [colSort, setColSort] = useState<SortColumn>(null);
  const [colDir, setColDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [gridMenuOpen, setGridMenuOpen] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Stats
  const stats = useMemo(() => ({
    total: cases.length,
    ready: cases.filter(c => c.status === 'new' || c.status === 'submitted').length,
    partial: cases.filter(c => c.status === 'in-production' || c.status === 'quality-check').length,
    missingInfo: cases.filter(c => c.hasAlert).length,
  }), [cases]);

  // Filter
  const filtered = useMemo(() => {
    // The mock "today" for the demo. parseDate works with the DD-MMM-YYYY strings used in mock data.
    const today = new Date(2026, 4, 19);
    const cutoff = (() => {
      if (timeFilter === 'all') return null;
      const t = new Date(today);
      if (timeFilter === '1h') t.setHours(t.getHours() - 1);
      if (timeFilter === '1d') t.setDate(t.getDate() - 1);
      if (timeFilter === '7d') t.setDate(t.getDate() - 7);
      return t;
    })();

    return cases.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || c.patientName.toLowerCase().includes(q) || c.practice.toLowerCase().includes(q) || c.dentist.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      const matchStatus  = statusFilter   === 'all' || c.status === statusFilter;
      const matchService = serviceFilter  === 'all' || c.services.includes(serviceFilter);
      const matchPractice = practiceFilter === 'all' || c.practice === practiceFilter;
      const matchDentist = dentistFilter  === 'all' || c.dentist === dentistFilter;
      const matchScanner = scannerFilter  === 'all' || c.scanner === scannerFilter;
      const matchAlert   = alertFilter    === 'all' || c.hasAlert;
      let matchDelivery = true;
      if (deliveryFilter === 'overdue')   matchDelivery = isOverdue(c.requestedDelivery);
      if (deliveryFilter === 'upcoming')  matchDelivery = !!c.requestedDelivery && !isOverdue(c.requestedDelivery);
      if (deliveryFilter === 'no-date')   matchDelivery = !c.requestedDelivery;
      // Time window — uses last-updated timestamp ("recent activity").
      const matchTime = !cutoff || parseDate(c.updatedAt) >= cutoff;
      return matchSearch && matchStatus && matchService && matchPractice && matchDentist && matchScanner && matchAlert && matchDelivery && matchTime;
    });
  }, [cases, searchQuery, statusFilter, serviceFilter, practiceFilter, dentistFilter, scannerFilter, alertFilter, deliveryFilter, timeFilter]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (colSort) {
      arr.sort((a, b) => {
        const da = parseDate(colSort === 'createdAt' ? a.createdAt : a.updatedAt).getTime();
        const db = parseDate(colSort === 'createdAt' ? b.createdAt : b.updatedAt).getTime();
        return colDir === 'asc' ? da - db : db - da;
      });
      return arr;
    }
    switch (sortBy) {
      case 'name-asc':       arr.sort((a, b) => a.patientName.localeCompare(b.patientName)); break;
      case 'name-desc':      arr.sort((a, b) => b.patientName.localeCompare(a.patientName)); break;
      case 'created-newest': arr.sort((a, b) => parseDate(b.createdAt).getTime() - parseDate(a.createdAt).getTime()); break;
      case 'created-oldest': arr.sort((a, b) => parseDate(a.createdAt).getTime() - parseDate(b.createdAt).getTime()); break;
      case 'updated-newest': arr.sort((a, b) => parseDate(b.updatedAt).getTime() - parseDate(a.updatedAt).getTime()); break;
    }
    return arr;
  }, [filtered, sortBy, colSort, colDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function handleColSort(col: SortColumn) {
    if (colSort === col) setColDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setColSort(col); setColDir('desc'); }
    setCurrentPage(1);
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('all');
    setServiceFilter('all');
    setPracticeFilter('all');
    setDentistFilter('all');
    setScannerFilter('all');
    setAlertFilter('all');
    setDeliveryFilter('all');
    setTimeFilter('all');
    setCurrentPage(1);
  }

  // Filter option lists for the drawer — values are 'all' + every unique value
  // present in the current case list.
  const statusOptions   = useMemo(() => [{ value: 'all', label: 'All Statuses' }, ...STATUSES.map(s => ({ value: s, label: STATUS_LABEL[s] }))], []);
  const serviceOptions  = useMemo(() => [{ value: 'all', label: 'All Services' },  ...Array.from(new Set(cases.flatMap(c => c.services))).sort().map(s => ({ value: s, label: s }))], [cases]);
  const practiceOptions = useMemo(() => [{ value: 'all', label: 'All Practices' }, ...Array.from(new Set(cases.map(c => c.practice))).sort().map(p => ({ value: p, label: p }))], [cases]);
  const dentistOptions  = useMemo(() => [{ value: 'all', label: 'All Dentists' },  ...Array.from(new Set(cases.map(c => c.dentist))).sort().map(d => ({ value: d, label: d }))], [cases]);
  const scannerOptions  = useMemo(() => [{ value: 'all', label: 'All Scanners' },  ...Array.from(new Set(cases.map(c => c.scanner))).sort().map(s => ({ value: s, label: s }))], [cases]);
  const alertOptions    = [
    { value: 'all',    label: 'All cases (with or without alert)' },
    { value: 'alerts', label: 'Cases with active alerts' },
  ];
  const deliveryOptions = [
    { value: 'all',      label: 'All delivery dates' },
    { value: 'overdue',  label: 'Overdue' },
    { value: 'upcoming', label: 'Upcoming (not yet due)' },
    { value: 'no-date',  label: 'No delivery date set' },
  ];

  // Count of currently-active drawer filters (used for the chip group below)
  const activeFilters: { label: string; value: string; onClear: () => void }[] = [];
  if (statusFilter   !== 'all') activeFilters.push({ label: 'Status',    value: STATUS_LABEL[statusFilter as CaseStatus], onClear: () => setStatusFilter('all') });
  if (serviceFilter  !== 'all') activeFilters.push({ label: 'Service',   value: serviceFilter,                            onClear: () => setServiceFilter('all') });
  if (practiceFilter !== 'all') activeFilters.push({ label: 'Practice',  value: practiceFilter,                           onClear: () => setPracticeFilter('all') });
  if (dentistFilter  !== 'all') activeFilters.push({ label: 'Dentist',   value: dentistFilter,                            onClear: () => setDentistFilter('all') });
  if (scannerFilter  !== 'all') activeFilters.push({ label: 'Scanner',   value: scannerFilter,                            onClear: () => setScannerFilter('all') });
  if (alertFilter    !== 'all') activeFilters.push({ label: 'Alerts',    value: 'With alerts',                            onClear: () => setAlertFilter('all') });
  if (deliveryFilter !== 'all') activeFilters.push({ label: 'Delivery',  value: deliveryOptions.find(o => o.value === deliveryFilter)?.label ?? deliveryFilter, onClear: () => setDeliveryFilter('all') });

  const sortOptions = [
    { value: 'created-newest', label: 'Created (Newest)' },
    { value: 'created-oldest', label: 'Created (Oldest)' },
    { value: 'updated-newest', label: 'Updated (Newest)' },
    { value: 'name-asc',       label: 'Name A–Z' },
    { value: 'name-desc',      label: 'Name Z–A' },
  ];

  // Draft cases route to the case-creation flow instead of the read-only
  // detail page — they get prefilled from the imported email/manual seed.
  function openCase(c: Case) {
    if (c.status === 'draft') {
      onOpenDraft?.(c);
    } else {
      setSelectedCase(c);
    }
  }

  if (selectedCase && selectedCase.status !== 'draft') {
    // Narrowed away from 'draft' above so the case is structurally
    // compatible with CaseDetailPage's CaseForDetail interface.
    return <CaseDetailPage caseData={selectedCase as any} onBack={() => setSelectedCase(null)} />;
  }

  function ColSortIcon({ col }: { col: SortColumn }) {
    if (colSort !== col) return <ChevronsUpDown className="w-3.5 h-3.5 text-[#B0B0C0]" />;
    return colDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-[#4D8EF7]" />
      : <ChevronDown className="w-3.5 h-3.5 text-[#4D8EF7]" />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Header — count badge inline with title, no separate card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213]">Cases</h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold text-[#1565C0] border"
              style={{
                background: 'linear-gradient(white, white) padding-box, linear-gradient(to right, #4D8EF7, #A59DFF) border-box',
                border: '2px solid transparent',
              }}
            >
              {cases.length}
            </span>
          </div>
          <p className="text-sm text-[#717182]">
            Manage and track all lab cases across your practices
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {onCreateCase && (
            <Button
              variant="primary"
              icon={<Plus className="w-5 h-5" />}
              className="whitespace-nowrap"
              onClick={onCreateCase}
            >
              New Case
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <SearchInput
            placeholder="Search by patient, practice, dentist, or case ID..."
            value={searchQuery}
            onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
          />
          <SortDropdown
            options={sortOptions}
            value={sortBy}
            onChange={(v) => { setSortBy(v); setColSort(null); setCurrentPage(1); }}
          />
          <button
            onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
            className="p-3 bg-white border border-[#E0E0E6] hover:bg-[#F8F9FC] rounded-lg transition-colors flex-shrink-0"
            title={viewMode === 'table' ? 'Grid view' : 'Table view'}
          >
            {viewMode === 'table' ? (
              <Grid3x3 className="w-5 h-5 text-[#717182]" />
            ) : (
              <List className="w-5 h-5 text-[#717182]" />
            )}
          </button>
          <button
            onClick={() => setFilterDrawerOpen(true)}
            className="relative p-3 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 rounded-lg transition-opacity flex-shrink-0"
            title="Filters"
          >
            <Filter className="w-5 h-5 text-white" />
            {activeFilters.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#4D8EF7] text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow">
                {activeFilters.length}
              </span>
            )}
          </button>
        </div>

        {/* Active filter chips — surfaces every drawer filter that's been applied */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-sm text-[#717182]">Active Filters:</span>
            {activeFilters.map((f) => (
              <div key={`${f.label}-${f.value}`} className="inline-flex items-center gap-2 px-3 py-1 bg-[#E3F2FD] text-[#1565C0] rounded-full text-sm">
                <span><span className="font-medium">{f.label}:</span> {f.value}</span>
                <button onClick={() => { f.onClear(); setCurrentPage(1); }} className="hover:text-[#D4183D] transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="bg-white rounded-lg border border-[#E0E0E6] flex flex-col items-center justify-center py-20 text-center">
          <Package className="w-12 h-12 text-[#E0E0E6] mb-4" />
          <p className="text-[#030213] font-medium mb-1">No cases found</p>
          <p className="text-sm text-[#717182] mb-4">Try adjusting your search or filters</p>
          <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
        </div>
      )}

      {/* TABLE VIEW */}
      {sorted.length > 0 && viewMode === 'table' && (
        <div className="bg-[#F3F3F5] rounded-xl border border-[#E0E0E6] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-1">
              <thead>
                <tr className="bg-[#F3F3F5] [&>th]:border-b [&>th]:border-[#E0E0E6]">
                  <th className="w-12 px-4 py-3"></th>
                  {visibleCols.status && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">Status</th>
                  )}
                  {visibleCols.caseId && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">Case ID</th>
                  )}
                  {visibleCols.createdAt && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">
                      <button className="inline-flex items-center gap-1 hover:text-[#030213] transition-colors" onClick={() => handleColSort('createdAt')}>
                        Created On
                        <ColSortIcon col="createdAt" />
                      </button>
                    </th>
                  )}
                  {visibleCols.updatedAt && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">
                      <button className="inline-flex items-center gap-1 hover:text-[#030213] transition-colors" onClick={() => handleColSort('updatedAt')}>
                        Updated On
                        <ColSortIcon col="updatedAt" />
                      </button>
                    </th>
                  )}
                  {visibleCols.deliveryDate && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider whitespace-nowrap">Delivery Date</th>
                  )}
                  {visibleCols.patient && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider">Patient</th>
                  )}
                  {visibleCols.service && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider">Service</th>
                  )}
                  {visibleCols.practice && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider">Practice</th>
                  )}
                  {visibleCols.lab && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider">Lab</th>
                  )}
                  {visibleCols.dentist && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#717182] uppercase tracking-wider">Dentist</th>
                  )}
                  {/* Settings / column picker — last column */}
                  <th className="text-right px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block" ref={colMenuRef}>
                      <button
                        onClick={() => setColMenuOpen((v) => !v)}
                        title="Customise columns"
                        className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      {colMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white border border-[#E0E0E6] rounded-xl shadow-2xl py-2">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">Columns</div>
                          <div className="max-h-[260px] overflow-y-auto">
                            {(Object.keys(COL_LABELS) as ColId[]).map((id) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => toggleCol(id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#F8F9FC] transition-colors text-left normal-case"
                              >
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  visibleCols[id] ? 'bg-[#4D8EF7] border-[#4D8EF7]' : 'bg-white border-[#D4CEE1]'
                                }`}>
                                  {visibleCols[id] && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                                </span>
                                <span className="text-sm text-[#030213]">{COL_LABELS[id]}</span>
                              </button>
                            ))}
                          </div>
                          <div className="px-3 pt-2 mt-1 border-t border-[#F0EFF6]">
                            <button
                              type="button"
                              onClick={() => { persistCols(); setColMenuOpen(false); }}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                              Save this preference
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => {
                  const overdue = isOverdue(c.requestedDelivery);
                  const isExpanded = expandedRows.has(c.id);
                  const isMulti = c.serviceItems.length > 1;
                  return (
                    <React.Fragment key={c.id}>
                    {/* ── Parent row ── */}
                    <tr onClick={() => openCase(c)} className="bg-white hover:bg-[#F8F9FC] transition-colors cursor-pointer relative [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px]">
                      <td className="pl-3 pr-2 py-3 relative">
                        <SourceIcon source={c.source} scanner={c.scanner} />
                      </td>
                      {visibleCols.status && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isMulti ? (
                            /* Count chip — replaces status badge; click to expand/collapse */
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleRow(c.id); }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap border bg-[#EEF4FF] text-[#1565C0] border-[#C8D8FC] hover:bg-[#DBEAFE] transition-colors"
                            >
                              <Package className="w-3 h-3" />
                              {c.serviceItems.length} Services
                              {isExpanded
                                ? <ChevronUp   className="w-3 h-3" />
                                : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <StatusBadge status={c.status} />
                          )}
                          {!visibleCols.caseId && (
                            <div className="text-[11px] font-semibold text-[#030213] mt-1">{c.id}</div>
                          )}
                        </td>
                      )}
                      {visibleCols.caseId && (
                        <td className="px-4 py-3 text-xs font-semibold text-[#030213] whitespace-nowrap">{c.id}</td>
                      )}
                      {visibleCols.createdAt && (
                        <td className="px-4 py-3 text-xs text-[#030213] whitespace-nowrap">{c.createdAt}</td>
                      )}
                      {visibleCols.updatedAt && (
                        <td className="px-4 py-3 text-xs text-[#717182] whitespace-nowrap">{c.updatedAt}</td>
                      )}
                      {visibleCols.deliveryDate && (
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {c.requestedDelivery ? (
                            overdue
                              ? <span className="font-semibold text-[#D4183D]">{c.requestedDelivery}</span>
                              : <span className="text-[#030213]">{c.requestedDelivery}</span>
                          ) : <span className="text-[#B0B0C0]">—</span>}
                        </td>
                      )}
                      {visibleCols.patient && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div title={c.patientName} className="text-xs font-medium text-[#030213] truncate max-w-[140px]">{c.patientName}</div>
                        </td>
                      )}
                      {visibleCols.service && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-[#5A5568]">{c.services[0]}</span>
                        </td>
                      )}
                      {visibleCols.practice && (
                        <td className="px-4 py-3">
                          <span title={c.practice} className="block text-xs text-[#030213] truncate max-w-[140px]">{c.practice}</span>
                        </td>
                      )}
                      {visibleCols.lab && (
                        <td className="px-4 py-3">
                          <span title={c.lab} className="block text-xs text-[#030213] truncate max-w-[140px]">{c.lab}</span>
                        </td>
                      )}
                      {visibleCols.dentist && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {c.hasAlert && <AlertTriangle className="w-3.5 h-3.5 text-[#E65100] flex-shrink-0" />}
                            <span className="text-xs text-[#030213]">{c.dentist}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button title="Download" className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          {c.status !== 'draft' && (
                            <button
                              title="View order form"
                              onClick={() => setOrderFormCase(c)}
                              className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* ── Child service rows — visible when expanded ── */}
                    {isExpanded && c.serviceItems.map((si, idx) => (
                      <tr
                        key={`${c.id}-${si.id}`}
                        onClick={() => openCase(c)}
                        className="bg-[#F5F8FF] hover:bg-[#EEF4FF] transition-colors cursor-pointer [&>td:first-child]:rounded-l-[4px] [&>td:last-child]:rounded-r-[4px]"
                      >
                        {/* Left indent — subtle blue left border */}
                        <td className="pl-3 pr-2 py-2">
                          <div className="w-0.5 h-5 bg-gradient-to-b from-[#4D8EF7] to-[#A59DFF] rounded-full mx-auto opacity-50" />
                        </td>
                        {/* Status — service-level badge */}
                        {visibleCols.status && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            <StatusBadge status={si.status} />
                          </td>
                        )}
                        {/* Case ID — sub-case number: CASE-007-1, CASE-007-2 … */}
                        {visibleCols.caseId && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-[11px] font-bold text-[#4D8EF7]">{c.id}-{idx + 1}</span>
                          </td>
                        )}
                        {visibleCols.createdAt    && <td className="px-4 py-2" />}
                        {visibleCols.updatedAt    && <td className="px-4 py-2" />}
                        {/* Delivery date — service-level */}
                        {visibleCols.deliveryDate && (
                          <td className="px-4 py-2 whitespace-nowrap text-xs">
                            {si.deliveryDate
                              ? isOverdue(si.deliveryDate)
                                ? <span className="font-semibold text-[#D4183D]">{si.deliveryDate}</span>
                                : <span className="text-[#030213]">{si.deliveryDate}</span>
                              : <span className="text-[#B0B0C0]">—</span>}
                          </td>
                        )}
                        {visibleCols.patient   && <td className="px-4 py-2" />}
                        {/* Service name in the service column */}
                        {visibleCols.service && (
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-[11px] text-[#5A5568] font-medium">{si.name}</span>
                          </td>
                        )}
                        {visibleCols.practice  && <td className="px-4 py-2" />}
                        {visibleCols.lab       && <td className="px-4 py-2" />}
                        {visibleCols.dentist   && <td className="px-4 py-2" />}
                        <td className="px-4 py-2" />
                      </tr>
                    ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={sorted.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
            />
          )}
        </div>
      )}

      {/* GRID VIEW */}
      {sorted.length > 0 && viewMode === 'grid' && (
        <>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            onClick={() => setGridMenuOpen(null)}
          >
            {paginated.map(c => {
              const overdue = isOverdue(c.requestedDelivery);
              return (
                <div
                  key={c.id}
                  onClick={() => openCase(c)}
                  className="bg-white rounded-xl border border-[#E0E0E6] overflow-hidden hover:shadow-md hover:border-[#C8C0F0] transition-all cursor-pointer relative"
                >

                  {/* Header */}
                  <div className="flex items-start justify-between px-4 pt-4 pb-2">
                    <StatusBadge status={c.status} />
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setGridMenuOpen(gridMenuOpen === c.id ? null : c.id)}
                        className="p-1 rounded-lg text-[#717182] hover:text-[#030213] hover:bg-[#F3F3F5] transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {gridMenuOpen === c.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl border border-[#E0E0E6] shadow-lg py-1 z-20">
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#030213] hover:bg-[#F8F9FC]">
                            <Download className="w-3.5 h-3.5 text-[#717182]" />
                            Download
                          </button>
                          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#030213] hover:bg-[#F8F9FC]">
                            <Eye className="w-3.5 h-3.5 text-[#717182]" />
                            View Case
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Patient name + ID + scanner */}
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <ScannerIcon scanner={c.scanner} size={22} />
                      <h3 title={c.patientName} className="font-semibold text-sm text-[#030213] truncate">
                        {c.patientName}
                      </h3>
                    </div>
                    <div className="text-xs text-[#A0A0B0] mt-0.5">{c.id}</div>
                  </div>

                  {/* Services */}
                  <div className="px-4 pb-3">
                    <div className="flex flex-wrap gap-1">
                      {c.services.slice(0, 2).map((svc, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F3F3F5] text-[#5A5568]">
                          {svc}
                        </span>
                      ))}
                      {c.services.length > 2 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white">
                          +{c.services.length - 2}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats / Meta */}
                  <div className="space-y-2 px-4 pb-3 pt-2 border-t border-[#F0EFF6] text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B8B9E]">Practice</span>
                      <span title={c.practice} className="font-medium text-[#030213] truncate max-w-[140px]">{c.practice}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B8B9E]">Dentist</span>
                      <div className="inline-flex items-center gap-1 max-w-[140px]">
                        {c.hasAlert && <AlertTriangle className="w-3 h-3 text-[#E65100] flex-shrink-0" />}
                        <span title={c.dentist} className="font-medium text-[#030213] truncate">{c.dentist}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8B8B9E]">Created</span>
                      <span className="text-[#5A5568]">{c.createdAt}</span>
                    </div>
                    {c.requestedDelivery && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#8B8B9E]">Delivery Date</span>
                        <span className={overdue ? 'font-semibold text-[#D4183D]' : 'text-[#5A5568]'}>{c.requestedDelivery}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 bg-white rounded-lg border border-[#E0E0E6]">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                totalItems={sorted.length}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {/* Drawer surfaces every meaningful parameter the case listing knows about */}
      <FilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={[
          { label: 'Status',        value: statusFilter,   options: statusOptions,   onChange: (v) => { setStatusFilter(v as CaseStatus | 'all'); setCurrentPage(1); } },
          { label: 'Service',       value: serviceFilter,  options: serviceOptions,  onChange: (v) => { setServiceFilter(v);  setCurrentPage(1); } },
          { label: 'Practice',      value: practiceFilter, options: practiceOptions, onChange: (v) => { setPracticeFilter(v); setCurrentPage(1); } },
          { label: 'Dentist',       value: dentistFilter,  options: dentistOptions,  onChange: (v) => { setDentistFilter(v);  setCurrentPage(1); } },
          { label: 'Scanner',       value: scannerFilter,  options: scannerOptions,  onChange: (v) => { setScannerFilter(v);  setCurrentPage(1); } },
          { label: 'Delivery Date', value: deliveryFilter, options: deliveryOptions, onChange: (v) => { setDeliveryFilter(v as typeof deliveryFilter); setCurrentPage(1); } },
          { label: 'Alerts',        value: alertFilter,    options: alertOptions,    onChange: (v) => { setAlertFilter(v as typeof alertFilter); setCurrentPage(1); } },
        ]}
        onApply={() => setFilterDrawerOpen(false)}
        onReset={() => { clearFilters(); setFilterDrawerOpen(false); }}
      />

      {/* Compact Order Form modal — opens from the Eye icon on a row */}
      {orderFormCase && (
        <OrderFormModal
          caseData={{
            id: orderFormCase.id,
            patientName: orderFormCase.patientName,
            practice: orderFormCase.practice,
            dentist: orderFormCase.dentist,
            services: orderFormCase.services,
            serviceItems: orderFormCase.serviceItems,
            status: orderFormCase.status as Exclude<CaseStatus, 'draft'>,
            createdAt: orderFormCase.createdAt,
            updatedAt: orderFormCase.updatedAt,
            requestedDelivery: orderFormCase.requestedDelivery,
            hasAlert: orderFormCase.hasAlert,
          }}
          onClose={() => setOrderFormCase(null)}
        />
      )}
    </div>
  );
}
