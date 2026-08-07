import { useMemo, useRef, useState } from 'react';
import {
  Search, X, Check, ChevronDown, MoreVertical, Building2, FlaskConical,
  Download, Upload, UploadCloud, Users, Stethoscope, AlertTriangle,
  CheckCircle2, FileSpreadsheet, Loader2, LifeBuoy, Eye,
} from 'lucide-react';
import ModalPortal from '../../components/ModalPortal';
import { useToast } from '../../context/ToastContext';
import { mockPractices, mockStaffMembers, Practice, StaffMember } from '../../data/clinicsData';
import { mockSuppliers } from '../../data/suppliersData';

// ─── Organizations overview (Super Admin) ────────────────────────────────────
// Mirrors the production admin's Organizations screen: one table listing every
// tenant — labs AND dental groups (DSOs) — with type, sub-type, country,
// invitation date and onboarding status. Clicking a row opens the org detail
// modal (gradient header + Invited→Active timeline + info cards). Dental
// groups additionally expose the DSO onboarding tooling: full hierarchy
// visibility (clinics / dentists / users) plus the Export-template and
// Import-favourite-labs flows.

type OrgStatus = 'invited' | 'info-submitted' | 'verification-pending' | 'verified';
type OrgType = 'lab' | 'dental-group';

interface Organization {
  id: string;
  name: string;
  type: OrgType;
  subType?: string;             // labs show 'HP' in production; groups show —
  country: string;
  countryFlag: string;
  city?: string;
  invitedAt: string;            // DD-MMM-YYYY
  invitedTime: string;
  activatedAt?: string;
  activatedTime?: string;
  status: OrgStatus;
  // Primary user shown in the detail modal's User Information card.
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    designation: string;
    employeeId?: string;
    userType: string;
  };
  // Organisation info card (Dental Group / Lab Information).
  info: {
    website?: string;
    contactNo?: string;
    address?: string;
    postalCode?: string;
  };
}

const STATUS_META: Record<OrgStatus, { label: string; dot: string; pillBg: string; pillText: string; pillBorder: string }> = {
  invited:                { label: 'Invited',              dot: '#F59E0B', pillBg: '#FFF7ED', pillText: '#B45309', pillBorder: '#FDE68A' },
  'info-submitted':       { label: 'Lab Info Submitted',   dot: '#4D8EF7', pillBg: '#EEF4FF', pillText: '#1565C0', pillBorder: '#BFDBFE' },
  'verification-pending': { label: 'Verification Pending', dot: '#EF4444', pillBg: '#FFF1F2', pillText: '#BE123C', pillBorder: '#FECDD3' },
  verified:               { label: 'Verified',             dot: '#22C55E', pillBg: '#F0FDF4', pillText: '#15803D', pillBorder: '#BBF7D0' },
};

// ── Mock organizations — labs + DSOs, statuses spanning the onboarding funnel ──
const ORGANIZATIONS: Organization[] = [
  {
    id: 'org-dso-1', name: 'Smile Genius Group', type: 'dental-group',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'London',
    invitedAt: '05-Aug-2026', invitedTime: '02:22 PM', activatedAt: '05-Aug-2026', activatedTime: '02:23 PM',
    status: 'verified',
    contact: { firstName: 'Smile', lastName: 'Genius Group', email: 'admin@smilegeniusgroup.co.uk', designation: 'Administration', userType: 'Super Admin' },
    info: { website: 'smilegeniusgroup.co.uk', contactNo: '+44 20 7946 0958', address: '1 Harley Street', postalCode: 'W1G 9QD' },
  },
  {
    id: 'org-dso-2', name: 'Smile Clinic Group', type: 'dental-group',
    country: 'United Kingdom', countryFlag: '🇬🇧',
    invitedAt: '05-Aug-2026', invitedTime: '02:22 PM', activatedAt: '05-Aug-2026', activatedTime: '02:23 PM',
    status: 'verified',
    contact: { firstName: 'Smile', lastName: 'Clinic Group', email: 'smlclinicgroup@yopmail.com', designation: 'Administration', userType: 'Super Admin' },
    info: {},
  },
  {
    id: 'org-lab-1', name: 'Smile Genius Lab', type: 'lab', subType: 'HP',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'London',
    invitedAt: '28-Jul-2026', invitedTime: '10:04 AM', activatedAt: '29-Jul-2026', activatedTime: '09:12 AM',
    status: 'verified',
    contact: { firstName: 'Amelia', lastName: 'Ford', email: 'amelia@smilegeniuslab.co.uk', designation: 'Lab Manager', userType: 'Lab Admin' },
    info: { website: 'smilegeniuslab.co.uk', contactNo: '+44 20 7099 2210', address: '48 Borough High St', postalCode: 'SE1 1XF' },
  },
  {
    id: 'org-lab-2', name: 'Kingsbridge Dental Lab', type: 'lab', subType: 'HP',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'Belfast',
    invitedAt: '30-Jul-2026', invitedTime: '11:40 AM', activatedAt: '01-Aug-2026', activatedTime: '03:05 PM',
    status: 'verified',
    contact: { firstName: 'Conor', lastName: 'Doyle', email: 'conor@kingsbridgelab.com', designation: 'Owner', userType: 'Lab Admin' },
    info: { website: 'kingsbridgelab.com', contactNo: '+44 28 9066 7788' },
  },
  {
    id: 'org-lab-3', name: 'Eurodontic Ltd', type: 'lab', subType: 'HP',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'Sheffield',
    invitedAt: '01-Aug-2026', invitedTime: '09:15 AM',
    status: 'info-submitted',
    contact: { firstName: 'Priya', lastName: 'Nair', email: 'priya@eurodontic.co.uk', designation: 'Operations', userType: 'Lab Admin' },
    info: { website: 'eurodontic.co.uk' },
  },
  {
    id: 'org-lab-4', name: 'S4S London', type: 'lab', subType: 'HP',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'London',
    invitedAt: '02-Aug-2026', invitedTime: '04:32 PM',
    status: 'info-submitted',
    contact: { firstName: 'Marcus', lastName: 'Bell', email: 'marcus@s4slondon.co.uk', designation: 'Lab Manager', userType: 'Lab Admin' },
    info: {},
  },
  {
    id: 'org-lab-5', name: 'Smile Ceramics Studio', type: 'lab', subType: 'HP',
    country: 'Ireland', countryFlag: '🇮🇪', city: 'Dublin',
    invitedAt: '03-Aug-2026', invitedTime: '10:20 AM',
    status: 'verification-pending',
    contact: { firstName: 'Niamh', lastName: 'Kelly', email: 'niamh@smileceramics.ie', designation: 'Owner', userType: 'Lab Admin' },
    info: { contactNo: '+353 1 555 0142' },
  },
  {
    id: 'org-lab-6', name: 'Dentsply Sirona Lab', type: 'lab', subType: 'HP',
    country: 'Germany', countryFlag: '🇩🇪', city: 'Bensheim',
    invitedAt: '04-Aug-2026', invitedTime: '01:48 PM',
    status: 'verification-pending',
    contact: { firstName: 'Jonas', lastName: 'Weber', email: 'jonas.weber@dentsplysirona.com', designation: 'Regional Lead', userType: 'Lab Admin' },
    info: { website: 'dentsplysirona.com' },
  },
  {
    id: 'org-lab-7', name: 'Precision Denture Works', type: 'lab', subType: 'HP',
    country: 'United Kingdom', countryFlag: '🇬🇧', city: 'Leeds',
    invitedAt: '05-Aug-2026', invitedTime: '08:55 AM',
    status: 'invited',
    contact: { firstName: 'Hannah', lastName: 'Price', email: 'hannah@precisiondentures.co.uk', designation: 'Owner', userType: 'Lab Admin' },
    info: {},
  },
  {
    id: 'org-lab-8', name: 'Aligner Studio Costa Rica', type: 'lab', subType: 'HP',
    country: 'Costa Rica', countryFlag: '🇨🇷', city: 'San José',
    invitedAt: '05-Aug-2026', invitedTime: '03:10 PM',
    status: 'invited',
    contact: { firstName: 'Diego', lastName: 'Rojas', email: 'diego@alignerstudio.cr', designation: 'Lab Manager', userType: 'Lab Admin' },
    info: {},
  },
];

// ── DSO hierarchy — the clinics / dentists / users behind a dental group ─────
// The prototype's one seeded group re-uses the clinic-portal mock directory so
// every name the admin sees here matches what clinic users see in-app (the
// whole point of the export template).
const DSO_CLINICS: Practice[] = mockPractices;
const DSO_DENTISTS: StaffMember[] = mockStaffMembers.filter(s => s.staffType === 'Dentist');
const DSO_USERS: StaffMember[] = mockStaffMembers.filter(s => s.staffType !== 'Dentist');
const VALID_LAB_NAMES = mockSuppliers.map(s => s.name);

// ─── Excel export (SpreadsheetML) ────────────────────────────────────────────
// Multi-sheet workbook generated without any library: SpreadsheetML 2003 XML,
// which Excel/LibreOffice open natively. Sheets: the full hierarchy (AC2) plus
// the two favourite-lab mapping sheets ready for completion (AC3) and a
// reference sheet of valid lab names.
function xmlEscape(v: string | number | undefined | null): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function sheetXml(name: string, headers: string[], rows: (string | number | undefined)[][]): string {
  const headerCells = headers.map(h => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('');
  const bodyRows = rows.map(r =>
    `<Row>${r.map(c => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`).join('')}</Row>`
  ).join('');
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${headerCells}</Row>${bodyRows}</Table></Worksheet>`;
}
function buildDsoWorkbook(orgName: string): string {
  const clinicSheet = sheetXml('Clinics',
    ['Clinic ID', 'Clinic Name', 'Practice Code', 'City', 'Country', 'Status', 'Practice Manager', 'Manager Email'],
    DSO_CLINICS.map(c => [c.id, c.name, c.practiceCode, c.city, c.country, c.status, c.managers[0]?.name, c.managers[0]?.email]));
  const dentistSheet = sheetXml('Dentists',
    ['Dentist Name', 'Performer Code', 'Clinic Name', 'Email', 'Status'],
    DSO_DENTISTS.map(d => [d.name, d.performerCode, d.practiceName, d.email, d.status]));
  const userSheet = sheetXml('Users',
    ['User Name', 'Role', 'Clinic Name', 'Email', 'Status'],
    DSO_USERS.map(u => [u.name, u.staffType, u.practiceName, u.email, u.status]));
  const clinicFavSheet = sheetXml('Clinic Favourite Labs',
    ['Clinic Name', 'Practice Code', 'Favourite Lab 1', 'Favourite Lab 2', 'Favourite Lab 3'],
    DSO_CLINICS.map(c => [c.name, c.practiceCode, '', '', '']));
  const dentistFavSheet = sheetXml('Dentist Favourite Labs',
    ['Dentist Name', 'Performer Code', 'Clinic Name', 'Favourite Lab 1', 'Favourite Lab 2', 'Favourite Lab 3'],
    DSO_DENTISTS.map(d => [d.name, d.performerCode, d.practiceName, '', '', '']));
  const labsSheet = sheetXml('Valid Labs',
    ['Lab Name (use these exact names in the favourite columns)'],
    VALID_LAB_NAMES.map(n => [n]));
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/></Style></Styles>
${clinicSheet}${dentistSheet}${userSheet}${clinicFavSheet}${dentistFavSheet}${labsSheet}
</Workbook>`;
}
function downloadWorkbook(orgName: string) {
  const blob = new Blob([buildDsoWorkbook(orgName)], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${orgName.replace(/\s+/g, '-')}-favourite-labs-template.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import validation (demo) ────────────────────────────────────────────────
// First upload surfaces one of each error class the story calls out (AC5);
// the "corrected" re-upload passes clean so the Save step can be exercised.
interface ImportError { row: number; sheet: string; type: string; detail: string; }
const DEMO_IMPORT_ERRORS: ImportError[] = [
  { row: 14, sheet: 'Clinic Favourite Labs',  type: 'Unknown clinic',  detail: '"Smile Genius Brighton 99" does not match any clinic in this DSO.' },
  { row: 27, sheet: 'Dentist Favourite Labs', type: 'Unknown dentist', detail: '"Dr. A. Kapoor" (DEN-9912) not found under Smile Genius Manchester.' },
  { row: 31, sheet: 'Clinic Favourite Labs',  type: 'Invalid lab',     detail: '"Crown Labz" is not a registered lab — see the Valid Labs sheet.' },
  { row: 22, sheet: 'Clinic Favourite Labs',  type: 'Duplicate',       detail: 'Smile Genius Leeds ↦ "Henry Schein" is already mapped on row 8.' },
  { row: 40, sheet: 'Dentist Favourite Labs', type: 'Missing field',   detail: 'Favourite Lab 1 is mandatory but empty for Dr. Whitfield.' },
];
// Demo mapping applied on save — real lab ids, so the clinic portal's
// favourites (localStorage) genuinely light up after the import (AC6).
const DEMO_FAVOURITE_LAB_IDS = mockSuppliers.slice(0, 3).map(s => s.id);
const DEMO_FAVOURITE_LAB_NAMES = mockSuppliers.slice(0, 3).map(s => s.name);

// ─── Small shared bits ───────────────────────────────────────────────────────
function StatusPill({ status }: { status: OrgStatus }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: '#5A5568' }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}
function TypePill({ type }: { type: OrgType }) {
  return type === 'dental-group' ? (
    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-[#EEF4FF] text-[#1565C0]">Dental Group</span>
  ) : (
    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-[#F3F3F5] text-[#5A5568]">Lab</span>
  );
}
function Field({ label, value }: { label: string; value?: string }) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-[#030213]">{label}:</span>{' '}
      <span className="text-[#5A5568]">{value || '—'}</span>
    </p>
  );
}

// ─── Org detail modal ────────────────────────────────────────────────────────
function OrgDetailModal({ org, onClose }: { org: Organization; onClose: () => void }) {
  const { toast } = useToast();
  const isGroup = org.type === 'dental-group';
  const m = STATUS_META[org.status];
  const active = !!org.activatedAt;

  // Modal-level tabs (dental groups only): Details = the production view;
  // DSO Hierarchy = the onboarding implementation (hierarchy + favourites).
  const [detailTab, setDetailTab] = useState<'details' | 'hierarchy'>('details');
  // DSO hierarchy tab + search
  const [tab, setTab] = useState<'clinics' | 'dentists' | 'users'>('clinics');
  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const clinics  = useMemo(() => DSO_CLINICS.filter(c => !q || c.name.toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q) || (c.practiceCode ?? '').toLowerCase().includes(q)), [q]);
  const dentists = useMemo(() => DSO_DENTISTS.filter(d => !q || d.name.toLowerCase().includes(q) || d.practiceName.toLowerCase().includes(q) || (d.performerCode ?? '').toLowerCase().includes(q)), [q]);
  const users    = useMemo(() => DSO_USERS.filter(u => !q || u.name.toLowerCase().includes(q) || u.practiceName.toLowerCase().includes(q) || u.staffType.toLowerCase().includes(q)), [q]);

  function handleExport() {
    downloadWorkbook(org.name);
    toast.success(`Template exported — ${DSO_CLINICS.length} clinics, ${DSO_DENTISTS.length} dentists and ${DSO_USERS.length} users included.`);
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">

          {/* ── Gradient header + timeline (mirrors production) ── */}
          <div className="bg-gradient-to-br from-[#F7E2F8] via-[#E8ECf8] to-[#AEE3E6] px-6 sm:px-8 pt-6 pb-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-[#030213] truncate">{org.name}</h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#5A5568]">
                  <TypePill type={org.type} />
                  <span>{org.countryFlag} {org.country}{org.city ? ` · ${org.city}` : ''}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white shadow-sm" style={{ color: m.pillText }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.dot }} />
                  {m.label}
                </span>
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-[#5A5568] transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Timeline — Invited ▸ Active */}
            <p className="mt-5 mb-2 text-xs font-bold text-[#030213]">Timeline</p>
            <div className="flex items-center">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={3} />
                </span>
              </div>
              <div className={`flex-1 h-px mx-2 ${active ? 'bg-[#8A8FA3]' : 'bg-[#C9CDD9]'}`} style={{ borderTop: '1px solid transparent' }} />
              <div className="flex flex-col items-center flex-shrink-0">
                {active ? (
                  <span className="w-7 h-7 rounded-full bg-white shadow flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={3} />
                  </span>
                ) : (
                  <span className="w-7 h-7 rounded-full bg-white/70 shadow flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full" style={{ background: m.dot }} />
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-start justify-between mt-1.5">
              <div className="text-center -ml-1">
                <p className="text-xs font-bold text-[#030213]">Invited</p>
                <p className="text-[11px] text-[#5A5568]">{org.invitedAt}, {org.invitedTime}</p>
              </div>
              <div className="text-center -mr-1">
                <p className="text-xs font-bold text-[#030213]">{active ? 'Active' : m.label}</p>
                <p className="text-[11px] text-[#5A5568]">{active ? `${org.activatedAt}, ${org.activatedTime}` : 'In progress'}</p>
              </div>
            </div>
          </div>

          {/* ── Modal tabs (dental groups only): Details ↔ DSO Hierarchy.
              The onboarding actions sit top-right on the tab bar so export /
              import stay reachable from either tab. ── */}
          {isGroup && (
            <div className="px-6 sm:px-8 pt-2 flex items-center gap-1 border-b border-[#F0EFF6] flex-wrap">
              {([
                { id: 'details',   label: 'Details' },
                { id: 'hierarchy', label: 'DSO Hierarchy' },
              ] as const).map(t => (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  className={`px-3 py-2.5 -mb-px text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    detailTab === t.id ? 'text-[#030213] border-[#030213]' : 'text-[#717182] border-transparent hover:text-[#030213]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 py-2 flex-wrap">
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#030213] border-2 border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export to Excel
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Favourite Labs
                </button>
              </div>
            </div>
          )}

          {/* ── Body ── */}
          <div className="px-6 sm:px-8 py-6 space-y-5">
            {(!isGroup || detailTab === 'details') && (<>
            {/* User Information */}
            <div className="border border-[#E0E0E6] rounded-xl p-5">
              <h3 className="text-lg font-bold text-[#030213] mb-4">User Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 pb-4 border-b border-[#F0EFF6]">
                <Field label="First Name" value={org.contact.firstName} />
                <Field label="Last Name" value={org.contact.lastName} />
                <Field label="Email" value={org.contact.email} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 pt-4">
                <Field label="User Designation" value={org.contact.designation} />
                <Field label="Employee ID" value={org.contact.employeeId} />
                <Field label="User Type" value={org.contact.userType} />
              </div>
            </div>

            {/* Org information */}
            <div className="border border-[#E0E0E6] rounded-xl p-5">
              <h3 className="text-lg font-bold text-[#030213] mb-4">{isGroup ? 'Dental Group Information' : 'Lab Information'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <Field label={isGroup ? 'Name of the Dental Group' : 'Name of the Lab'} value={org.name} />
                <Field label="Website" value={org.info.website} />
                <p className="text-sm">
                  <span className="font-semibold text-[#030213]">City/Country:</span>{' '}
                  <span className="text-[#5A5568]">{org.city || '—'} {org.countryFlag} {org.country}</span>
                </p>
                <Field label="Contact No" value={org.info.contactNo} />
                <Field label="Address" value={org.info.address} />
                <Field label="Postal Code" value={org.info.postalCode} />
              </div>
            </div>
            </>)}

            {/* ── DSO Hierarchy tab — the onboarding implementation ── */}
            {isGroup && detailTab === 'hierarchy' && (
              <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
                <div className="px-5 pt-5 pb-4">
                  <h3 className="text-lg font-bold text-[#030213]">DSO Hierarchy</h3>
                  <p className="text-xs text-[#717182] mt-0.5">
                    Every clinic, dentist and user in this group — exactly as named in Smile Genius.
                    Export the template, complete the favourite-lab columns offline, then import it back.
                  </p>
                </div>

                {/* Count chips + tabs + search */}
                <div className="px-5 flex flex-wrap items-center gap-2">
                  {([
                    { id: 'clinics',  label: 'Clinics',  count: DSO_CLINICS.length,  icon: Building2 },
                    { id: 'dentists', label: 'Dentists', count: DSO_DENTISTS.length, icon: Stethoscope },
                    { id: 'users',    label: 'Users',    count: DSO_USERS.length,    icon: Users },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setTab(t.id); setQuery(''); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        tab === t.id
                          ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]'
                          : 'bg-white text-[#5A5568] border-[#E0E0E6] hover:border-[#BFDBFE] hover:text-[#1565C0]'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                      <span className="text-[10px] font-bold tabular-nums opacity-70">({t.count})</span>
                    </button>
                  ))}
                  <div className="relative ml-auto min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder={`Search ${tab}…`}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
                    />
                  </div>
                </div>

                {/* Hierarchy table */}
                <div className="mt-3 max-h-72 overflow-y-auto border-t border-[#F0EFF6]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-[#F8F9FC] z-10">
                      {tab === 'clinics' && (
                        <tr className="text-[10px] font-bold text-[#717182] uppercase tracking-wider">
                          <th className="px-5 py-2.5">Clinic</th><th className="px-3 py-2.5">Code</th><th className="px-3 py-2.5">City</th><th className="px-3 py-2.5">Dentists</th><th className="px-3 py-2.5">Practice Manager</th><th className="px-3 py-2.5">Status</th>
                        </tr>
                      )}
                      {tab === 'dentists' && (
                        <tr className="text-[10px] font-bold text-[#717182] uppercase tracking-wider">
                          <th className="px-5 py-2.5">Dentist</th><th className="px-3 py-2.5">Performer Code</th><th className="px-3 py-2.5">Clinic</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Status</th>
                        </tr>
                      )}
                      {tab === 'users' && (
                        <tr className="text-[10px] font-bold text-[#717182] uppercase tracking-wider">
                          <th className="px-5 py-2.5">User</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Clinic</th><th className="px-3 py-2.5">Email</th><th className="px-3 py-2.5">Status</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-[#F0EFF6]">
                      {tab === 'clinics' && clinics.slice(0, 60).map(c => (
                        <tr key={c.id} className="text-xs text-[#5A5568]">
                          <td className="px-5 py-2 font-medium text-[#030213]">{c.name}</td>
                          <td className="px-3 py-2">{c.practiceCode}</td>
                          <td className="px-3 py-2">{c.city}</td>
                          <td className="px-3 py-2 tabular-nums">{c.dentists.length}</td>
                          <td className="px-3 py-2">{c.managers[0]?.name}</td>
                          <td className="px-3 py-2 capitalize">{c.status}</td>
                        </tr>
                      ))}
                      {tab === 'dentists' && dentists.slice(0, 60).map(d => (
                        <tr key={d.id} className="text-xs text-[#5A5568]">
                          <td className="px-5 py-2 font-medium text-[#030213]">{d.name}</td>
                          <td className="px-3 py-2">{d.performerCode}</td>
                          <td className="px-3 py-2">{d.practiceName}</td>
                          <td className="px-3 py-2">{d.email}</td>
                          <td className="px-3 py-2 capitalize">{d.status}</td>
                        </tr>
                      ))}
                      {tab === 'users' && users.slice(0, 60).map(u => (
                        <tr key={u.id} className="text-xs text-[#5A5568]">
                          <td className="px-5 py-2 font-medium text-[#030213]">{u.name}</td>
                          <td className="px-3 py-2">{u.staffType}</td>
                          <td className="px-3 py-2">{u.practiceName}</td>
                          <td className="px-3 py-2">{u.email}</td>
                          <td className="px-3 py-2 capitalize">{u.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {((tab === 'clinics' && clinics.length > 60) || (tab === 'dentists' && dentists.length > 60) || (tab === 'users' && users.length > 60)) && (
                    <p className="px-5 py-2 text-[11px] text-[#A0A0B0] bg-[#FAFBFF] border-t border-[#F0EFF6]">
                      Showing first 60 — refine the search or use Export to Excel for the complete list.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 sm:px-8 py-4 border-t border-[#F0EFF6]">
            <button
              onClick={() => toast.info('Support flow — demo only')}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold text-[#030213] border-2 border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
            >
              <LifeBuoy className="w-4 h-4" />
              Support
            </button>
          </div>
        </div>

        {importOpen && <ImportFavouritesModal orgName={org.name} onClose={() => setImportOpen(false)} />}
      </div>
    </ModalPortal>
  );
}

// ─── Import Favourite Labs modal ─────────────────────────────────────────────
// upload → validating → results (errors listed BEFORE anything saves — AC5)
// → save (favourites applied, clinic portal reflects immediately — AC4/AC6).
type ImportStep = 'upload' | 'validating' | 'errors' | 'ready' | 'saved';

function ImportFavouritesModal({ orgName, onClose }: { orgName: string; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [fileName, setFileName] = useState('');
  const attemptRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(f: File | null) {
    if (!f) return;
    setFileName(f.name);
    attemptRef.current += 1;
    setStep('validating');
    // Demo validation: first file surfaces every error class; the corrected
    // re-upload passes clean.
    setTimeout(() => setStep(attemptRef.current === 1 ? 'errors' : 'ready'), 900);
  }

  function handleSave() {
    // AC6 — apply the mapping so clinic users genuinely see the favourites on
    // next load: the clinic portal's lab picker reads this localStorage key.
    try { localStorage.setItem('cases.favoriteLabs', JSON.stringify(DEMO_FAVOURITE_LAB_IDS)); } catch {}
    setStep('saved');
    toast.success(`Favourite labs configured for ${DSO_CLINICS.length} clinics and ${DSO_DENTISTS.length} dentists.`);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7]/15 to-[#A59DFF]/15 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-[#4D8EF7]" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#030213]">Import Favourite Labs</h3>
              <p className="text-[11px] text-[#717182]">{orgName} · completed onboarding template</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F3F5] hover:bg-[#E8E8EC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Hidden file input (shared by upload + re-upload) */}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            className="hidden"
            onChange={e => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />

          {step === 'upload' && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 px-6 py-10 rounded-xl border-2 border-dashed border-[#C8D8FC] bg-[#FAFBFF] hover:border-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors"
            >
              <span className="w-12 h-12 rounded-2xl bg-white border border-[#E0E0E6] flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-[#4D8EF7]" />
              </span>
              <p className="text-sm font-semibold text-[#030213]">Upload the completed template</p>
              <p className="text-xs text-[#717182] max-w-sm">
                Use the workbook from <span className="font-semibold">Export to Excel</span> — the Clinic and
                Dentist favourite sheets are validated against this DSO before anything is saved.
              </p>
              <span className="text-[10px] text-[#A0A0B0]">XLS · XLSX · CSV</span>
            </button>
          )}

          {step === 'validating' && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="w-8 h-8 text-[#4D8EF7] animate-spin" />
              <p className="text-sm font-semibold text-[#030213]">Validating {fileName}…</p>
              <p className="text-xs text-[#717182]">Checking clinics, dentists, lab names, duplicates and mandatory fields</p>
            </div>
          )}

          {step === 'errors' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-[#FFF1F2] flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-[#BE123C]" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#030213]">{DEMO_IMPORT_ERRORS.length} issues found — nothing was saved</p>
                  <p className="text-[11px] text-[#717182]">184 rows parsed · 179 valid · fix the rows below and re-upload</p>
                </div>
              </div>
              <div className="border border-[#F9DCDC] rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-[#FFF8F8]">
                    <tr className="text-[10px] font-bold text-[#B4232F] uppercase tracking-wider">
                      <th className="px-3 py-2">Row</th><th className="px-3 py-2">Sheet</th><th className="px-3 py-2">Issue</th><th className="px-3 py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#FBEAEA]">
                    {DEMO_IMPORT_ERRORS.map((e, i) => (
                      <tr key={i} className="text-xs text-[#5A5568] align-top">
                        <td className="px-3 py-2 tabular-nums font-semibold text-[#030213]">{e.row}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{e.sheet}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF1F2] text-[#BE123C] whitespace-nowrap">{e.type}</span>
                        </td>
                        <td className="px-3 py-2">{e.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'ready' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[#030213]">Validation passed — ready to apply</p>
                  <p className="text-[11px] text-[#717182]">{fileName} · 184 rows · 0 issues</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="rounded-xl border border-[#E0E0E6] px-4 py-3">
                  <p className="text-lg font-bold text-[#030213] tabular-nums">{DSO_CLINICS.length}</p>
                  <p className="text-[11px] text-[#717182]">Clinic favourite mappings</p>
                </div>
                <div className="rounded-xl border border-[#E0E0E6] px-4 py-3">
                  <p className="text-lg font-bold text-[#030213] tabular-nums">{DSO_DENTISTS.length}</p>
                  <p className="text-[11px] text-[#717182]">Dentist favourite mappings</p>
                </div>
              </div>
              <p className="text-[11px] text-[#717182]">
                Labs referenced: {DEMO_FAVOURITE_LAB_NAMES.join(' · ')}. Existing favourites are replaced by this file.
              </p>
            </div>
          )}

          {step === 'saved' && (
            <div className="flex flex-col items-center text-center gap-2 py-8">
              <span className="w-12 h-12 rounded-2xl bg-[#F0FDF4] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#15803D]" />
              </span>
              <p className="text-sm font-bold text-[#030213]">Favourite labs configured</p>
              <p className="text-xs text-[#717182] max-w-sm">
                Clinic and dentist favourites are live — users see them the next time they open the
                lab picker. No manual configuration needed.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions per step */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#F0EFF6] bg-[#FAFBFF]">
          {step === 'errors' && (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-white transition-colors">Cancel</button>
              <button
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload corrected file
              </button>
            </>
          )}
          {step === 'ready' && (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-white transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <Check className="w-3.5 h-3.5" />
                Save Configuration
              </button>
            </>
          )}
          {(step === 'upload' || step === 'validating') && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-white transition-colors">Cancel</button>
          )}
          {step === 'saved' && (
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity">Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Overview content (page body) ────────────────────────────────────────────
export default function AdminOrganizationsContent() {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | OrgType>('all');
  const [selected, setSelected] = useState<Organization | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORGANIZATIONS.filter(o =>
      (typeFilter === 'all' || o.type === typeFilter) &&
      (!q || o.name.toLowerCase().includes(q) || o.country.toLowerCase().includes(q) || (o.city ?? '').toLowerCase().includes(q))
    );
  }, [query, typeFilter]);

  const labCount = ORGANIZATIONS.filter(o => o.type === 'lab').length;
  const dsoCount = ORGANIZATIONS.filter(o => o.type === 'dental-group').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8" onClick={() => setMenuFor(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#030213] mb-1">Overview</h1>
          <p className="text-sm text-[#717182]">Every organisation on the platform — labs and dental groups.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-2.5">
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Labs</p>
            <p className="text-lg font-bold text-[#030213] tabular-nums leading-tight">{labCount}</p>
          </div>
          <div className="rounded-xl border border-[#E0E0E6] bg-white px-4 py-2.5">
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Dental Groups</p>
            <p className="text-lg font-bold text-[#030213] tabular-nums leading-tight">{dsoCount}</p>
          </div>
        </div>
      </div>

      {/* Type tabs + search */}
      <div className="flex items-center gap-2 mb-5 p-1 bg-[#F3F3F5] rounded-xl w-fit">
        {([
          { id: 'all',          label: 'All',           count: ORGANIZATIONS.length },
          { id: 'lab',          label: 'Labs',          count: labCount },
          { id: 'dental-group', label: 'Dental Groups', count: dsoCount },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTypeFilter(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              typeFilter === t.id ? 'bg-white text-[#030213] shadow-sm border border-[#E0E0E6]' : 'text-[#717182] hover:text-[#030213]'
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${typeFilter === t.id ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#E8E8EC] text-[#717182]'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-5">
        <Search className="w-4 h-4 text-[#A0A0B0] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search organisations, countries…"
          className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-[#E0E0E6] rounded-xl outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[860px]">
            <thead className="bg-[#F8F9FC]">
              <tr className="text-[11px] font-semibold text-[#717182] uppercase tracking-wider">
                <th className="px-5 py-3">Organization Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Sub Type</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Invitation date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFF6]">
              {visible.map(o => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer hover:bg-[#FAFBFF] transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${o.type === 'dental-group' ? 'bg-[#EEF4FF] text-[#1565C0]' : 'bg-[#F3F3F5] text-[#5A5568]'}`}>
                        {o.type === 'dental-group' ? <Building2 className="w-3.5 h-3.5" /> : <FlaskConical className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-sm font-medium text-[#030213]">{o.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><TypePill type={o.type} /></td>
                  <td className="px-4 py-3.5 text-sm text-[#5A5568]">{o.subType ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-[#5A5568]">{o.country}</td>
                  <td className="px-4 py-3.5 text-sm text-[#5A5568]">{o.city ?? '—'}</td>
                  <td className="px-4 py-3.5 text-sm text-[#5A5568] tabular-nums">{o.invitedAt}</td>
                  <td className="px-4 py-3.5"><StatusPill status={o.status} /></td>
                  <td className="px-4 py-3.5">
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === o.id ? null : o.id); }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[#A0A0B0] hover:bg-[#F3F3F5] hover:text-[#030213] transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuFor === o.id && (
                        <div className="absolute right-0 top-8 z-20 bg-white border border-[#E0E0E6] rounded-lg shadow-lg py-1 min-w-[140px]">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(o); setMenuFor(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#030213] hover:bg-[#F8F9FC] text-left"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#717182]" />
                            View details
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-[#A0A0B0] italic">
                    No organisations match "{query}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <OrgDetailModal org={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
