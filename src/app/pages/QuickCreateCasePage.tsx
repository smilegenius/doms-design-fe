import { useMemo, useState, useEffect, useRef } from 'react';
import {
  User, FlaskConical, Stethoscope, Calendar, FileText, Search,
  Plus, X, Check, ChevronDown, ChevronRight,
  Pencil, Zap, Star, Upload, UploadCloud, Box, Image as ImageIcon,
  AlertCircle, Mail, Paperclip, ArrowLeft, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalPortal from '../components/ModalPortal';
import { mockSuppliers } from '../data/suppliersData';
import { mockStaffMembers } from '../data/clinicsData';
import type { Case, EmailPrescription } from './CasesPage';
import {
  SERVICE_CATEGORIES,
  ORDER_TYPES,
  MATERIAL_TYPES,
  TOOTH_SHADES,
  CASE_SOURCES,
  CASE_SOURCE_UPLOAD_SLOTS,
  SCANNER_BRANDS,
  IMPRESSION_COURIERS,
  IMPLANT_BRANDS,
  IMPLANT_ABUTMENT_MATERIALS,
  RETAINER_TYPES,
  OCCLUSION_CLASSES,
  OCCLUSION_SIDES,
  DENTURE_STAGES,
  ServiceSelection,
  ServicePickerModal,
  Mini,
  ShadeSelector,
  InteractiveToothChart,
  ToothGlyph,
  getCategoryForItem,
  getApplianceConfig,
} from './CreateCasePage';

// ── Per-category visibility + completeness rules ────────────────────────────
// Some categories don't ask for material/shade (Orthodontics, Appliances) —
// those fields would be confusing for a retainer or whitening tray. Others
// add their own required fields on top of the base trio.
function showsMaterialShade(itemId: string): boolean {
  const cat = getCategoryForItem(itemId);
  return cat !== 'orthodontics' && cat !== 'appliances';
}

// Category-aware "complete" check — drives the chip green tick + the
// "Add details" hint banner above the chips row.
function isSelectionComplete(sel: ServiceSelection): boolean {
  const teeth = sel.teeth ?? [];
  if (teeth.length === 0) return false;
  const cat = getCategoryForItem(sel.itemId);

  // Generic base for the categories that use Material + Shade. In per-tooth
  // mode (sameForAllTeeth === false) the user may leave the service-level
  // material/shade blank and only fill them per tooth — so every selected
  // tooth needs an effective material+shade (per-tooth entry OR the
  // service-level fallback). Otherwise the single service-level pair is
  // enough.
  const baseOk = sel.sameForAllTeeth === false
    ? teeth.every(code => {
        const mat   = sel.perTooth?.[code]?.material || sel.material;
        const shade = sel.perTooth?.[code]?.shade    || sel.shade;
        return !!mat && !!shade;
      })
    : (!!sel.material && !!sel.shade);

  if (cat === 'bridge') {
    return baseOk && !!sel.brand && !!sel.abutmentMaterial;
  }
  if (cat === 'orthodontics') {
    return !!sel.retainerType;       // teethOk already checked
  }
  if (cat === 'denture') {
    return baseOk && (sel.stages?.length ?? 0) > 0;
  }
  if (cat === 'appliances') {
    return !!sel.applianceOption;
  }
  if (cat === 'others') {
    return baseOk && !!sel.customServiceName?.trim();
  }
  // single-unit (and any future default)
  return baseOk;
}

// Resolve the user-facing name for a service selection. For "Others", the
// user-typed customServiceName overrides the catalogue label ("Other"); when
// it's blank we fall back to "Other (untitled)" so the gap is obvious. Every
// surface that renders a service name should go through this helper so the
// picker chip, the page card, the legend, the aggregated chart, and the
// order-form preview all agree.
function getServiceDisplayName(sel: ServiceSelection): string {
  const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === sel.itemId);
  const cat = getCategoryForItem(sel.itemId);
  const fallback = item?.label ?? sel.itemId;
  if (cat === 'others') {
    const trimmed = sel.customServiceName?.trim();
    return trimmed || `${fallback} (untitled)`;
  }
  return fallback;
}

// True when the user has filled any field on the selection — used to switch
// the service card from the "Add details" placeholder to a partial detail
// strip, even when the selection isn't fully configured yet.
function hasAnyData(sel: ServiceSelection): boolean {
  if ((sel.teeth?.length ?? 0) > 0) return true;
  if (sel.material || sel.shade) return true;
  if (sel.brand || sel.abutmentMaterial) return true;
  if (sel.retainerType || sel.applianceOption) return true;
  if ((sel.stages?.length ?? 0) > 0) return true;
  if (sel.customServiceName?.trim()) return true;
  if (sel.perTooth && Object.values(sel.perTooth).some(pt => pt?.material || pt?.shade)) return true;
  return false;
}

// Short summary string for the chip subtitle when complete — keeps the chip
// compact while surfacing the most useful detail per category.
function selectionSummary(sel: ServiceSelection): string {
  const teethCount = sel.teeth?.length ?? 0;
  const cat = getCategoryForItem(sel.itemId);
  const parts: string[] = [];
  if (cat === 'orthodontics') {
    if (sel.retainerType) parts.push(sel.retainerType);
  } else if (cat === 'appliances') {
    if (sel.applianceOption) parts.push(sel.applianceOption);
  } else if (cat === 'denture') {
    if (sel.shade)    parts.push(sel.shade);
    if (sel.material) parts.push(sel.material);
    if ((sel.stages?.length ?? 0) > 0) parts.push(`${sel.stages!.length} stage${sel.stages!.length === 1 ? '' : 's'}`);
  } else {
    if (sel.shade)    parts.push(sel.shade);
    if (sel.material) parts.push(sel.material);
    if (cat === 'bridge' && sel.brand) parts.push(sel.brand);
    if (cat === 'others' && sel.customServiceName) parts.unshift(sel.customServiceName);
  }
  parts.push(`${teethCount} ${teethCount === 1 ? 'tooth' : 'teeth'}`);
  return parts.join(' · ');
}

// ─── Quick Create Case ───────────────────────────────────────────────────────
// Stripped-down, single-screen create flow that surfaces the bare essentials
// first — patient name, lab, services — and tucks every other field behind
// "Add additional details" drawers. The dentist, order type, requested
// delivery, and case source are auto-picked at the top with sensible
// defaults; the user can adjust them inline or leave them alone.
//
// Per-service drilldown (material / shade / teeth / notes) opens in a right
// drawer too, so this page stays a single legible card.

type PatientExtras = {
  patientId: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  dob: string;
  gender: '' | 'male' | 'female' | 'other' | 'prefer-not';
};
const EMPTY_EXTRAS: PatientExtras = {
  patientId: '', email: '', phoneCountry: '+44', phoneNumber: '',
  dob: '', gender: '',
};
const COUNTRY_CODES = ['+44', '+1', '+91', '+92', '+61', '+353', '+49', '+33', '+34', '+39'];
const GENDER_OPTIONS: { value: PatientExtras['gender']; label: string }[] = [
  { value: '',           label: 'Prefer not to say' },
  { value: 'male',       label: 'Male' },
  { value: 'female',     label: 'Female' },
  { value: 'other',      label: 'Other' },
  { value: 'prefer-not', label: 'Prefer not to say' },
];

// ── Scan-file → slot auto-matcher ───────────────────────────────────────────
// Powers the Case Source "Bulk upload" flow. Given a filename, returns the
// best Upper Arch / Lower Arch / Bite Scan / Bite Scan 2 slot guess plus a
// confidence band. Anything `high` drops straight into the matching slot;
// `low` / `none` goes to the Needs-review queue so the user picks manually.
function matchScanFile(filename: string): { slot: string | null; confidence: 'high' | 'low' | 'none' } {
  const lower = filename.toLowerCase().replace(/\.[a-z0-9]+$/, ''); // strip extension
  // Bite-registration files — usually labelled bite / occlusion / registration.
  if (/(?:^|[_\-\s.])(bite|occlus|registr|jaw[_\-\s.]?rel|interocc)/.test(lower)) {
    if (/(bite[_\-\s.]?2|bite2|second|^b2[_\-.]|_b2[_\-.])/.test(lower)) {
      return { slot: 'Bite Scan 2', confidence: 'high' };
    }
    return { slot: 'Bite Scan', confidence: 'high' };
  }
  if (/(?:^|[_\-\s.])(upper|maxill|maxilla|ux\b|max[_\-\s.]?arch|upper[_\-\s.]?arch)/.test(lower)) {
    return { slot: 'Upper Arch', confidence: 'high' };
  }
  if (/(?:^|[_\-\s.])(lower|mandib|mandible|mand[_\-\s.]?arch|low[_\-\s.]?arch|lower[_\-\s.]?arch)/.test(lower)) {
    return { slot: 'Lower Arch', confidence: 'high' };
  }
  // Low-confidence — single-letter or numeric patterns the lab sometimes
  // ships. We surface these to the user for confirmation.
  if (/(?:^|[_\-\s.])(up|u)(?=[_\-\s.0-9])/.test(lower)) return { slot: 'Upper Arch', confidence: 'low' };
  if (/(?:^|[_\-\s.])(lo|low|l)(?=[_\-\s.0-9])/.test(lower)) return { slot: 'Lower Arch', confidence: 'low' };
  if (/(?:^|[_\-\s.])(b|bs)(?=[_\-\s.0-9])/.test(lower)) return { slot: 'Bite Scan', confidence: 'low' };
  return { slot: null, confidence: 'none' };
}

// Default delivery date — 14 days out so the form lands with a reasonable
// turnaround pre-filled. ISO format for the native date input.
function defaultDeliveryISO(): string {
  // No Date.now() in workflows, but a regular component renders fine.
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

// ── Draft persistence ───────────────────────────────────────────────────────
// "Save as draft" writes the entire form state to localStorage. When the user
// returns to /clinic/cases/quick-new the page restores that draft so they
// can continue editing. Successful submission clears the draft.
const DRAFT_KEY = 'quickCase.draft';
type SavedDraft = {
  patientName: string;
  patientExtras: PatientExtras;
  labId: string;
  dentistId: string;
  orderType: string;
  deliveryDate: string;
  caseSource: string;
  caseSourceFiles: Record<string, string | null>;
  caseSourceExtraFiles: string[];
  // Scanner brand when caseSource === 'Via Scanner'. One of SCANNER_BRANDS
  // OR a free-text label the user typed under "Other". Empty when not set
  // or when the source isn't Via Scanner.
  caseSourceScanner: string;
  // Courier when caseSource === 'Impressions (By Post)'. One of
  // IMPRESSION_COURIERS or free-text under "Other". Empty otherwise.
  caseSourceCourier: string;
  selections: ServiceSelection[];
  caseInstructions: string;
  caseInstructionsFiles: string[];
  savedAt: string;
};
function loadDraft(): SavedDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) as SavedDraft : null;
  } catch {
    return null;
  }
}
function persistDraft(draft: SavedDraft) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
}
function clearDraft() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

// ── Mock existing patients ───────────────────────────────────────────────────
// Stand-in for the practice's patient database. Each one carries the full
// set of fields the drawer captures so picking an existing patient pre-fills
// every detail (ID, email, phone, DOB, gender). Sorted alphabetically by
// first name so the unfocused dropdown is browsable.
type ExistingPatient = {
  id: string;
  name: string;
  patientId: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  dob: string;
  gender: PatientExtras['gender'];
};
const MOCK_PATIENTS: ExistingPatient[] = [
  { id: 'p01', name: 'Amelia Thompson', patientId: 'PAT-2024-0118', email: 'amelia.t@gmail.com',     phoneCountry: '+44', phoneNumber: '7700 900118', dob: '1985-03-12', gender: 'female' },
  { id: 'p02', name: 'Benjamin Carter',  patientId: 'PAT-2024-0099', email: 'benc@outlook.com',       phoneCountry: '+44', phoneNumber: '7700 900099', dob: '1992-07-04', gender: 'male' },
  { id: 'p03', name: 'Charlotte Lee',    patientId: 'PAT-2025-0023', email: 'charlotte.lee@me.com',    phoneCountry: '+44', phoneNumber: '7700 900023', dob: '1978-11-22', gender: 'female' },
  { id: 'p04', name: 'Daniel Park',      patientId: 'PAT-2023-0567', email: 'd.park@gmail.com',        phoneCountry: '+44', phoneNumber: '7700 900567', dob: '1989-01-30', gender: 'male' },
  { id: 'p05', name: 'Emily Watson',     patientId: 'PAT-2025-0084', email: 'emily.watson@yahoo.com', phoneCountry: '+44', phoneNumber: '7700 900084', dob: '1995-05-15', gender: 'female' },
  { id: 'p06', name: 'Harper Smith',     patientId: 'PAT-2024-0241', email: 'harper@gmail.com',        phoneCountry: '+44', phoneNumber: '7700 900241', dob: '1982-09-08', gender: 'female' },
  { id: 'p07', name: 'Isabella Brown',   patientId: 'PAT-2024-0312', email: 'isabella.b@icloud.com',   phoneCountry: '+44', phoneNumber: '7700 900312', dob: '1990-04-19', gender: 'female' },
  { id: 'p08', name: 'James Wilson',     patientId: 'PAT-2023-0411', email: 'jwilson@hotmail.com',     phoneCountry: '+44', phoneNumber: '7700 900411', dob: '1975-12-02', gender: 'male' },
  { id: 'p09', name: 'Lucas Davies',     patientId: 'PAT-2025-0117', email: 'lucas.d@gmail.com',       phoneCountry: '+44', phoneNumber: '7700 900117', dob: '1998-08-25', gender: 'male' },
  { id: 'p10', name: 'Michael Anderson', patientId: 'PAT-2024-0455', email: 'michael.a@outlook.com',   phoneCountry: '+44', phoneNumber: '7700 900455', dob: '1986-06-11', gender: 'male' },
  { id: 'p11', name: 'Olivia Martin',    patientId: 'PAT-2025-0006', email: 'olivia.m@gmail.com',      phoneCountry: '+44', phoneNumber: '7700 900006', dob: '2001-02-28', gender: 'female' },
  { id: 'p12', name: 'Sarah Patel',      patientId: 'PAT-2026-0118', email: 'sarah.patel@gmail.com',  phoneCountry: '+44', phoneNumber: '7700 900222', dob: '1988-10-17', gender: 'female' },
  { id: 'p13', name: 'Sebastian Rivera', patientId: 'PAT-2024-0789', email: 'seb.rivera@gmail.com',   phoneCountry: '+44', phoneNumber: '7700 900789', dob: '1993-03-21', gender: 'male' },
  { id: 'p14', name: 'Sophia Khan',      patientId: 'PAT-2025-0142', email: 'sophia.k@yahoo.com',     phoneCountry: '+44', phoneNumber: '7700 900142', dob: '1991-12-14', gender: 'female' },
  { id: 'p15', name: 'William Garcia',   patientId: 'PAT-2024-0028', email: 'w.garcia@outlook.com',   phoneCountry: '+44', phoneNumber: '7700 900028', dob: '1980-07-09', gender: 'male' },
];

// Map a Cases-page service name to the in-form service catalogue ID.
// Used when a draft case (email or manual source) is opened — the
// QuickCreate form's service catalogue keys off these IDs, not the display
// names, so we translate before seeding selections.
const SERVICE_NAME_TO_CATALOG_ID: Record<string, string> = {
  'Crown':           'su-crown',
  'Veneers':         'su-veneer',
  'Bridge':          'br-abutment',
  'Clear Aligners':  'or-clear-aligners',
  'Retainer':        'or-retainers',
  'Night Guard':     'ap-night-guard',
  'Partial Denture': 'de-partial-denture',
  'Full Denture':    'de-full-denture',
};

// FDI numeric (16, 26, etc.) → in-app tooth code (UR6, UL6) used by the
// teeth chart + per-tooth field grids. First digit is the quadrant; second
// digit is the tooth position from the midline.
function fdiNumberToCode(fdi: number): string {
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  const prefix = ['', 'UR', 'UL', 'LL', 'LR'][quadrant] ?? '';
  if (!prefix || position < 1 || position > 8) return '';
  return `${prefix}${position}`;
}

// Which view the left preview pane is showing. 'primary' = the flow-specific
// first tab — source email for email drafts, live order form for scanner
// cases, Add-Prescription upload for manual entry — only ever ONE of those.
// 'model' = the 3D scan viewer, which is always available alongside.
type PreviewPaneTab = 'primary' | 'model';

// ─── Prescription upload pane ───────────────────────────────────────────────
// "Source" tab of the left preview pane on every non-email Quick Create
// flow. Mirrors the scrolling behaviour of EmailPreviewPane so the form on
// the right stays the same regardless of source. Empty state nudges the
// user to drop a prescription file (WhatsApp screenshot, posted scan,
// PDF e-mail attachment — anything that landed outside the auto-fetch).
// After "upload" (mocked — no real file picker in the prototype) the
// pane surfaces a stylised Rx preview and an Apply-to-form CTA.
function PrescriptionUploadPane({ onApply }: {
  onApply: (prefill: {
    patientName: string;
    serviceName: string;
    fdi: number[];
    material: string;
    shade: string;
    instructions: string;
  }) => void;
}) {
  const [uploaded, setUploaded] = useState<{
    filename: string;
    size: string;
    receivedVia: string;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hard-coded mock OCR output. In production this would come from the
  // server's extraction service after the file is uploaded.
  const MOCK_DETECTED = {
    patientName: 'John Doe',
    dentistName: 'Dr. Webb',
    practice: 'Smile Genius Manchester',
    serviceName: 'Crown',
    fdi: [16],
    material: 'Zirconia',
    shade: 'A2',
    instructions: 'Single crown UR6, match adjacent shade A2. Patient sensitive to nickel.',
  };

  const handleFakeUpload = (filename: string, source: string) => {
    setProcessing(true);
    setTimeout(() => {
      setUploaded({
        filename,
        size: '184 KB',
        receivedVia: source,
      });
      setProcessing(false);
    }, 700);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Pane title */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#F3EEFF] flex items-center justify-center">
          <UploadCloud className="w-3.5 h-3.5 text-[#7C3AED]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">Add Prescription / Order Form</p>
          <p className="text-[10px] text-[#717182] leading-tight truncate">
            {uploaded ? 'Detected — review and apply' : 'Upload manually — details auto-fetch into the form'}
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Hidden native file input — actual upload is mocked, but we
            wire onChange so the picker UI feels real. */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFakeUpload(f.name, 'Manual upload');
          }}
        />

        {!uploaded ? (
          <>
            {/* Empty-state upload card */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={processing}
              className="w-full bg-gradient-to-br from-[#F5F8FF] to-[#F3EEFF] border-2 border-dashed border-[#C8D8FC] hover:border-[#7C3AED] hover:bg-[#EEF4FF] rounded-xl p-5 text-center transition-all disabled:opacity-60"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm border border-[#E0E0E6] flex items-center justify-center mb-3">
                {processing ? (
                  <Zap className="w-6 h-6 text-[#7C3AED] animate-pulse" />
                ) : (
                  <UploadCloud className="w-6 h-6 text-[#7C3AED]" />
                )}
              </div>
              <p className="text-sm font-bold text-[#030213] leading-tight">
                {processing ? 'Reading prescription…' : 'Upload prescription'}
              </p>
              <p className="text-[11px] text-[#5A5568] leading-snug mt-1">
                Drop a PDF or photo — we'll pull out the patient, service, teeth and material so the form on the right fills itself.
              </p>
              <p className="text-[10px] text-[#A0A0B0] mt-2 font-medium">
                PDF · JPG · PNG · max 10 MB
              </p>
            </button>

            {/* Source-of-Rx quick picks — same idea as Case Source but
                surfaced as one-click "we've got it from X" buttons. */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-3">
              <p className="text-[10px] font-bold text-[#717182] uppercase tracking-wider mb-2">Or quick-add from</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'WhatsApp', file: 'whatsapp_rx_240612.jpg', icon: ImageIcon, tint: 'text-[#25D366]' },
                  { label: 'Posted scan', file: 'post_rx_240612.pdf', icon: FileText, tint: 'text-[#5A5568]' },
                  { label: 'SMS / MMS', file: 'sms_rx_240612.jpg', icon: ImageIcon, tint: 'text-[#1565C0]' },
                  { label: 'Hand-off', file: 'manual_rx_240612.pdf', icon: FileText, tint: 'text-[#7C3AED]' },
                ].map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleFakeUpload(s.file, s.label)}
                      disabled={processing}
                      className="inline-flex items-center gap-1.5 px-2 py-2 rounded-lg border border-[#E0E0E6] hover:border-[#7C3AED] hover:bg-[#FAFBFD] transition-colors text-left disabled:opacity-60"
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${s.tint}`} />
                      <span className="text-[11px] font-semibold text-[#030213] truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer hint */}
            <div className="text-[10px] text-[#717182] text-center leading-relaxed px-2 py-1">
              No prescription handy?
              <br />
              Skip this and fill the form on the right manually.
            </div>
          </>
        ) : (
          <>
            {/* Uploaded file card */}
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-[#15803D]" strokeWidth={3} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-[#030213] leading-tight truncate">{uploaded.filename}</p>
                <p className="text-[10px] text-[#15803D] leading-tight">{uploaded.receivedVia} · {uploaded.size}</p>
              </div>
              <button
                type="button"
                onClick={() => setUploaded(null)}
                className="text-[#717182] hover:text-[#C62828] p-1 rounded transition-colors"
                title="Remove this file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Detected Rx preview — same visual chrome as the
                EmailPreviewPane card so the two paths feel cohesive. */}
            <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-gradient-to-r from-[#F3EEFF] to-[#EEF4FF] border-b border-[#E0E0E6] flex items-center justify-between">
                <p className="text-[10px] font-bold text-[#5B21B6] uppercase tracking-wider">Detected from upload</p>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white border border-[#DDD6FE] text-[8px] font-bold text-[#5B21B6] uppercase tracking-wider">
                  <Zap className="w-2 h-2" /> Auto-read
                </span>
              </div>
              <div className="p-3 space-y-2 text-[10px] text-[#030213]">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Patient</p>
                    <p className="text-[11px] font-bold leading-tight">{MOCK_DETECTED.patientName}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Dentist</p>
                    <p className="text-[11px] font-bold leading-tight">{MOCK_DETECTED.dentistName}</p>
                  </div>
                </div>
                <div className="border-t border-dashed border-[#E0E0E6] pt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Service</p>
                    <p className="text-[10px] font-semibold leading-tight">{MOCK_DETECTED.serviceName}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Material</p>
                    <p className="text-[10px] font-semibold leading-tight">{MOCK_DETECTED.material}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Shade</p>
                    <p className="text-[10px] font-semibold leading-tight">{MOCK_DETECTED.shade}</p>
                  </div>
                </div>
                <div className="border-t border-dashed border-[#E0E0E6] pt-2">
                  <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Tooth (FDI)</p>
                  <p className="text-[10px] font-mono font-semibold leading-tight">
                    {MOCK_DETECTED.fdi.map(fdi => {
                      const q = Math.floor(fdi / 10), p = fdi % 10;
                      const prefix = ['', 'UR', 'UL', 'LL', 'LR'][q] ?? '';
                      return prefix ? `${prefix}${p}` : '';
                    }).filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="border-t border-dashed border-[#E0E0E6] pt-2">
                  <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Notes</p>
                  <p className="text-[10px] leading-snug text-[#5A5568]">{MOCK_DETECTED.instructions}</p>
                </div>
              </div>
            </div>

            {/* Apply-to-form CTA — once clicked, populates the form on
                the right with the detected values via the onApply prop. */}
            <button
              type="button"
              onClick={() => onApply({
                patientName: MOCK_DETECTED.patientName,
                serviceName: MOCK_DETECTED.serviceName,
                fdi: MOCK_DETECTED.fdi,
                material: MOCK_DETECTED.material,
                shade: MOCK_DETECTED.shade,
                instructions: MOCK_DETECTED.instructions,
              })}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#4D8EF7] hover:opacity-95 transition-opacity shadow-[0_4px_12px_rgba(124,58,237,0.3)]"
            >
              <Zap className="w-3.5 h-3.5" />
              Apply to form
            </button>
            <p className="text-[10px] text-[#717182] text-center leading-relaxed px-2">
              Review the detected values above, then apply them to the form on the right.
              You can still edit every field afterwards.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Email preview pane ─────────────────────────────────────────────────────
// "Source" tab of the left preview pane when the case was opened from an
// inbox-fetched email draft. Surfaces the original message + the attached prescription so the
// user can sanity-check the auto-populated form against the source content.
// The prescription is rendered as a stylized HTML mock modelled on the S4S
// London prescription pad (the sample the user provided): green brand bar,
// boxed patient + practice details, ticked appliance type list, materials
// strip, instructions, and a signature line. Drives every value from the
// case data so the preview always lines up with what's in the form on
// the right.
function EmailPreviewPane({ caseData }: { caseData: Case }) {
  const data = caseData.emailPrescription!;
  const primaryService = caseData.serviceItems[0];
  // Map our internal service display names to the S4S-style appliance type
  // list. The matched row gets a green tick + bold label so the user can
  // see which option the email Rx triggered.
  const APPLIANCE_ROWS: { label: string; matches: (svcName: string) => boolean }[] = [
    { label: 'Soft Splint',         matches: s => /night ?guard|soft splint/i.test(s) },
    { label: 'Hard Splint',         matches: s => /hard splint/i.test(s) },
    { label: 'Whitening Tray',      matches: s => /whitening/i.test(s) },
    { label: 'Sports Guard',        matches: s => /sport/i.test(s) },
    { label: 'Snore Guard / MAD',   matches: s => /snore|apnoea|apnea/i.test(s) },
    { label: 'Retainer (Essix)',    matches: s => /retainer/i.test(s) },
    { label: 'Clear Aligner',       matches: s => /aligner/i.test(s) },
    { label: 'Crown / Veneer',      matches: s => /crown|veneer/i.test(s) },
  ];
  const svcName = primaryService?.name ?? '';
  // Format the FDI numbers (16, 26, …) as a comma-separated string of UR/UL/LL/LR
  // codes for the prescription. Matches the form's expected tooth syntax.
  const teethDisplay = (primaryService?.fdi ?? [])
    .map(fdi => {
      const q = Math.floor(fdi / 10), p = fdi % 10;
      const prefix = ['', 'UR', 'UL', 'LL', 'LR'][q] ?? '';
      return prefix ? `${prefix}${p}` : '';
    })
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Pane title */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
          <Mail className="w-3.5 h-3.5 text-[#1565C0]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">Source email</p>
          <p className="text-[10px] text-[#717182] leading-tight truncate">Auto-fetched from practice inbox</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Email header card */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {data.fromName.split(' ').map(p => p[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#030213] leading-tight truncate">{data.fromName}</p>
              <p className="text-[10px] text-[#717182] leading-tight truncate">{data.fromEmail}</p>
            </div>
            <span className="text-[10px] text-[#717182] flex-shrink-0">{data.receivedAt}</span>
          </div>
          <div className="pt-1.5 border-t border-[#F0EFF6]">
            <p className="text-[11px] font-semibold text-[#030213] leading-snug">{data.subject}</p>
            <p className="text-[11px] text-[#5A5568] mt-1 leading-relaxed">{data.bodyPreview}</p>
          </div>
        </div>

        {/* Attachment card */}
        <div className="bg-[#FFF8E1] border border-[#FDE68A] rounded-xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
            <Paperclip className="w-4 h-4 text-[#A16207]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#030213] leading-tight truncate">{data.attachmentName}</p>
            <p className="text-[10px] text-[#A16207] leading-tight">Prescription · PDF · 1 page</p>
          </div>
        </div>

        {/* S4S London prescription mock ─────────────────────────────────
            Stylized to match the layout of the S4S interactive Rx pad
            the user provided as the reference sample. Every value is
            sourced from the case data so the preview tracks the form. */}
        <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden shadow-sm">
          {/* Green brand bar — S4S house style */}
          <div className="px-3 py-2 bg-[#00A88B] text-white flex items-end justify-between">
            <div>
              <p className="text-base font-black leading-none tracking-tight">
                <span className="lowercase">s4s</span>
                <span className="ml-1.5 text-[11px] font-bold tracking-[0.2em]">LONDON</span>
              </p>
              <p className="text-[8px] font-semibold uppercase tracking-[0.18em] opacity-90 mt-1">Dental Laboratory</p>
            </div>
            <div className="text-right text-[8px] leading-snug opacity-95">
              <p>23–25 Beak Street</p>
              <p>London W1F 9RP</p>
              <p>info@s4sdental.com</p>
            </div>
          </div>

          {/* Form title strip */}
          <div className="px-3 py-1.5 bg-[#F0FDF4] border-b border-[#BBF7D0] flex items-center justify-between">
            <p className="text-[9px] font-bold text-[#065F46] uppercase tracking-wider">Lab Prescription · Work Authorisation</p>
            <p className="text-[8px] text-[#0F766E] font-semibold">Ref · {caseData.id.replace('CASE-', 'S4S-')}</p>
          </div>

          {/* Patient + practice grid */}
          <div className="p-2 grid grid-cols-2 gap-1.5 border-b border-[#F0EFF6]">
            <div className="border border-[#E0E0E6] rounded-md p-1.5 bg-[#FAFBFD]">
              <p className="text-[8px] font-bold text-[#0F766E] uppercase tracking-wider mb-1">Patient details</p>
              <div className="space-y-1">
                <div>
                  <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">Name</p>
                  <p className="text-[10px] font-bold text-[#030213] leading-tight">{caseData.patientName}</p>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">DOB</p>
                    <p className="text-[9px] text-[#030213] leading-tight">—</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">Patient Ref</p>
                    <p className="text-[9px] text-[#030213] leading-tight">{caseData.id.replace('CASE-DRAFT-', 'PR-')}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="border border-[#E0E0E6] rounded-md p-1.5 bg-[#FAFBFD]">
              <p className="text-[8px] font-bold text-[#0F766E] uppercase tracking-wider mb-1">Practice / Dentist</p>
              <div className="space-y-1">
                <div>
                  <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">Practice</p>
                  <p className="text-[10px] font-bold text-[#030213] leading-tight truncate">{caseData.practice}</p>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">Dentist</p>
                    <p className="text-[9px] text-[#030213] leading-tight truncate">{caseData.dentist}</p>
                  </div>
                  <div>
                    <p className="text-[8px] text-[#A0A0B0] uppercase tracking-wide">GDC #</p>
                    <p className="text-[9px] text-[#030213] leading-tight">—</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Appliance type list */}
          <div className="p-2 border-b border-[#F0EFF6]">
            <p className="text-[8px] font-bold text-[#0F766E] uppercase tracking-wider mb-1.5">Appliance Type</p>
            <div className="grid grid-cols-2 gap-y-1 gap-x-2.5">
              {APPLIANCE_ROWS.map(row => {
                const checked = row.matches(svcName);
                return (
                  <div key={row.label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                      checked ? 'bg-[#00A88B] border-[#00A88B]' : 'bg-white border-[#D4CEE1]'
                    }`}>
                      {checked && <Check className="w-2 h-2 text-white" strokeWidth={4} />}
                    </span>
                    <span className={`text-[9px] leading-tight ${checked ? 'font-bold text-[#030213]' : 'text-[#5A5568]'}`}>
                      {row.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Materials + delivery strip */}
          <div className="p-2 border-b border-[#F0EFF6] grid grid-cols-3 gap-1.5 bg-[#FAFBFD]">
            <div>
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Material</p>
              <p className="text-[9px] font-bold text-[#030213] leading-tight mt-0.5">{primaryService?.material ?? '—'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Shade</p>
              <p className="text-[9px] font-bold text-[#030213] leading-tight mt-0.5">{primaryService?.shade ?? '—'}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider">Required by</p>
              <p className="text-[9px] font-bold text-[#030213] leading-tight mt-0.5">{caseData.requestedDelivery ?? 'TBC'}</p>
            </div>
          </div>

          {/* Teeth + arch */}
          {teethDisplay && (
            <div className="p-2 border-b border-[#F0EFF6]">
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider mb-0.5">Tooth Notation (FDI)</p>
              <p className="text-[9px] font-mono text-[#030213] leading-tight">{teethDisplay}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="p-2 border-b border-[#F0EFF6]">
            <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider mb-1">Special Instructions</p>
            <p className="text-[9px] text-[#030213] leading-snug">{primaryService?.instructions ?? data.bodyPreview}</p>
          </div>

          {/* Signature row */}
          <div className="p-2 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider mb-1">Dentist Signature</p>
              <div className="h-5 border-b border-[#030213] flex items-end">
                <p className="text-[11px] italic text-[#1565C0] font-bold leading-tight pb-0.5" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                  {data.fromName}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[8px] font-bold text-[#717182] uppercase tracking-wider mb-1">Date</p>
              <div className="h-5 border-b border-[#030213] flex items-end">
                <p className="text-[10px] text-[#030213] leading-tight pb-0.5">{caseData.createdAt}</p>
              </div>
            </div>
          </div>

          {/* Footer hint */}
          <div className="px-2 py-1.5 bg-[#F8F9FC] border-t border-[#F0EFF6] text-center">
            <p className="text-[8px] text-[#A0A0B0]">www.s4sdental.com · 0114 250 0176</p>
          </div>
        </div>

        <div className="text-[10px] text-[#717182] text-center leading-relaxed px-2 py-1">
          The form on the right is auto-populated from this prescription.
          <br />
          Review and edit any field before submitting.
        </div>
      </div>
    </div>
  );
}

export default function QuickCreateCasePage({ onCancel, onSubmitted, prefillDraft }: {
  onCancel: () => void;
  onSubmitted: () => void;
  /** No longer rendered — kept on the parent so the route survives, but
      the in-page switch button has been removed. */
  onUseDetailed?: () => void;
  /** When the user opens an email-fetched or manual draft from the Cases
      list, this is the corresponding draftCases entry. We seed every form
      field from it AND (for email source) render a left preview pane with
      the email + prescription mock. */
  prefillDraft?: Case | null;
}) {
  const { toast } = useToast();

  // Load any pending draft once on mount. If present, every useState below
  // seeds itself with the draft value instead of the bare default.
  // When a prefillDraft is provided (clicked from the Cases list), it
  // takes priority — the localStorage draft is ignored so the user always
  // sees the email/manual-derived form on open.
  const draft = useMemo(() => (prefillDraft ? null : loadDraft()), [prefillDraft]);

  // Seed values derived from prefillDraft. The Cases-page Case shape
  // doesn't match the form state exactly, so we translate fields here
  // once (looking up lab/dentist IDs by name, converting FDI numerics
  // to UR/UL/LL/LR codes, etc.). Used as a fallback chain:
  //   draft (localStorage) → prefillDraftSeed → bare default
  const prefillDraftSeed = useMemo(() => {
    if (!prefillDraft) return null;
    const labMatch = mockSuppliers.find(s => s.name === prefillDraft.lab) ?? null;
    const dentistMatch = mockStaffMembers.find(d =>
      d.staffType === 'Dentist' && (d.name === prefillDraft.dentist || prefillDraft.dentist.includes(d.name.split(' ').slice(-1)[0]))
    ) ?? null;
    const selections: ServiceSelection[] = prefillDraft.serviceItems
      .map(si => {
        const itemId = SERVICE_NAME_TO_CATALOG_ID[si.name];
        if (!itemId) return null;
        const teeth = (si.fdi ?? [])
          .map(fdiNumberToCode)
          .filter(Boolean);
        return {
          itemId,
          orderType: si.orderType,
          teeth,
          material: si.material,
          shade: si.shade,
          additional: si.instructions,
          sameForAllTeeth: true,
        } as ServiceSelection;
      })
      .filter((s): s is ServiceSelection => s !== null);
    return {
      patientName: prefillDraft.patientName,
      labId: labMatch?.id ?? '',
      dentistId: dentistMatch?.id ?? '',
      selections,
      caseInstructions: prefillDraft.emailPrescription?.bodyPreview ?? '',
      // Email-sourced cases default to the Email case source so the lab
      // sees how the data arrived. Manual cases leave it blank for the
      // user to pick.
      caseSource: prefillDraft.source === 'email' ? 'Email' : '',
    };
  }, [prefillDraft]);
  const [isResumedDraft, setIsResumedDraft] = useState(!!draft);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(draft?.savedAt ?? null);

  // Auto-populated defaults — sit in a small strip at the top, all editable.
  const dentists = useMemo(
    () => mockStaffMembers.filter(s => s.staffType === 'Dentist'),
    []
  );
  const [dentistId, setDentistId]       = useState(() => draft?.dentistId ?? prefillDraftSeed?.dentistId ?? dentists[0]?.id ?? '');
  const [orderType, setOrderType]       = useState(draft?.orderType ?? ORDER_TYPES[0]);
  const [deliveryDate, setDeliveryDate] = useState(draft?.deliveryDate ?? defaultDeliveryISO());
  // Case Source — the way the case data reached the lab. Left blank by
  // default so the user explicitly picks Via Scanner / Impressions / SMS
  // / etc. rather than silently committing to "Via Scanner" on every case.
  // Email-sourced drafts default to 'Email' so the lab can see the origin.
  const [caseSource, setCaseSource]                 = useState(draft?.caseSource ?? prefillDraftSeed?.caseSource ?? '');
  const [caseSourceFiles, setCaseSourceFiles]       = useState<Record<string, string | null>>(draft?.caseSourceFiles ?? {});
  const [caseSourceExtraFiles, setCaseSourceExtras] = useState<string[]>(draft?.caseSourceExtraFiles ?? []);
  const [caseSourceScanner, setCaseSourceScanner]   = useState(draft?.caseSourceScanner ?? '');
  const [caseSourceCourier, setCaseSourceCourier]   = useState(draft?.caseSourceCourier ?? '');
  const [caseSourceOpen, setCaseSourceOpen]         = useState(false);

  // Required minimum surface — Patient name, Lab, Services.
  const [patientName, setPatientName] = useState(draft?.patientName ?? prefillDraftSeed?.patientName ?? '');
  const [labId, setLabId]             = useState(draft?.labId ?? prefillDraftSeed?.labId ?? '');
  const [selections, setSelections]   = useState<ServiceSelection[]>(draft?.selections ?? prefillDraftSeed?.selections ?? []);

  // Optional extras kept behind drawers / collapsibles.
  const [patientExtras, setPatientExtras] = useState<PatientExtras>(draft?.patientExtras ?? EMPTY_EXTRAS);
  const [caseInstructions, setCaseInstructions] = useState(draft?.caseInstructions ?? prefillDraftSeed?.caseInstructions ?? '');
  // Files attached to the Case Instructions — separate from Case Source
  // uploads. These are general supporting docs (photos, x-rays, refs).
  const [caseInstructionsFiles, setCaseInstructionsFiles] = useState<string[]>(draft?.caseInstructionsFiles ?? []);

  // Drawer state
  const [patientDrawerOpen, setPatientDrawerOpen] = useState(false);
  const [pickerOpen, setPickerOpen]               = useState(false);
  const [activeDetailsId, setActiveDetailsId]     = useState<string | null>(null);
  // Header preview modals — small screens only; on md+ the same previews
  // live in the left pane tabs.
  const [model3DOpen, setModel3DOpen]             = useState(false);
  const [orderFormOpen, setOrderFormOpen]         = useState(false);
  // Left preview pane tab (md+). The primary tab's content adapts to the
  // flow (see PreviewPaneTab); picking "Via Scanner" mid-flow pulls the pane
  // back to it so the order form is front-and-centre for scanner cases.
  const [previewTab, setPreviewTab] = useState<PreviewPaneTab>('primary');
  useEffect(() => {
    if (caseSource === 'Via Scanner') setPreviewTab('primary');
  }, [caseSource]);
  // Collapse the left preview pane to a slim icon rail pinned at the left
  // edge — gives the form the full width while keeping the previews one
  // click away. Clicking a rail icon expands the pane on that tab.
  const [paneCollapsed, setPaneCollapsed] = useState(false);
  // Removing a service is destructive — drops the user-entered material,
  // shade, teeth, brand, notes, etc. We gate it behind a small confirm
  // modal owned at the page so both the service card X and the drawer
  // Remove button funnel through it.
  const [confirmRemoveId, setConfirmRemoveId]     = useState<string | null>(null);

  const labOptions = mockSuppliers;
  const selectedLab = labOptions.find(l => l.id === labId) ?? null;
  const selectedDentist = dentists.find(d => d.id === dentistId) ?? null;
  const activeDetailsService = activeDetailsId
    ? selections.find(s => s.itemId === activeDetailsId) ?? null
    : null;

  // Has the user filled any optional patient field? Drives the "X details
  // added" pill on the Patient card so they see what's stashed away.
  const patientExtrasCount = useMemo(() => {
    return [
      patientExtras.patientId, patientExtras.email,
      patientExtras.phoneNumber, patientExtras.dob, patientExtras.gender,
    ].filter(v => v && String(v).trim().length > 0).length;
  }, [patientExtras]);

  // Validation gate
  const canSubmit = patientName.trim().length > 0 && !!labId && selections.length > 0;

  function toggleService(itemId: string) {
    setSelections(prev => {
      const exists = prev.find(s => s.itemId === itemId);
      if (exists) return prev.filter(s => s.itemId !== itemId);
      return [...prev, { itemId, expanded: false }];
    });
  }
  function updateService(itemId: string, patch: Partial<ServiceSelection>) {
    setSelections(prev => prev.map(s => s.itemId === itemId ? { ...s, ...patch } : s));
  }
  function removeService(itemId: string) {
    setSelections(prev => prev.filter(s => s.itemId !== itemId));
    if (activeDetailsId === itemId) setActiveDetailsId(null);
  }

  function handleSubmit() {
    if (!canSubmit) {
      toast.error('Add a patient name, pick a lab, and at least one service.');
      return;
    }
    // Successful submission — discard any pending draft and move on.
    clearDraft();
    toast.success(`Case created for ${patientName}`);
    onSubmitted();
  }

  // Snapshot the current form state into localStorage. The next visit to
  // /clinic/cases/quick-new will rehydrate from this draft.
  function handleSaveDraft() {
    const savedAt = new Date().toISOString();
    persistDraft({
      patientName,
      patientExtras,
      labId,
      dentistId,
      orderType,
      deliveryDate,
      caseSource,
      caseSourceFiles,
      caseSourceExtraFiles,
      caseSourceScanner,
      caseSourceCourier,
      selections,
      caseInstructions,
      caseInstructionsFiles,
      savedAt,
    });
    setIsResumedDraft(true);
    setDraftSavedAt(savedAt);
    toast.success(
      patientName.trim()
        ? `Draft saved for ${patientName.trim()}`
        : 'Draft saved'
    );
  }

  // Discard the draft entirely — used by the "Clear draft" button when the
  // user is editing a restored draft and wants to start fresh.
  function handleDiscardDraft() {
    clearDraft();
    setIsResumedDraft(false);
    setDraftSavedAt(null);
    toast.info('Draft discarded — keep editing or cancel to leave.');
  }

  // Full-screen layout: the page is mounted in place of Layout (no sidebar
  // or top bar from the shell). We provide our own minimal top strip + a
  // horizontal flex so the email-source preview pane can sit on the left.
  const sourcePillTone =
    prefillDraft?.source === 'email'
      ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]'
      : prefillDraft?.source === 'manual'
        ? 'bg-[#F3F3F5] text-[#5A5568] border-[#E0E0E6]'
        : 'bg-[#ECFEFF] text-[#0F766E] border-[#A5F3FC]';
  const sourcePillLabel =
    prefillDraft?.source === 'email' ? 'Email draft'
    : prefillDraft?.source === 'manual' ? 'Manual entry'
    : 'Quick create';
  const SourcePillIcon =
    prefillDraft?.source === 'email' ? Mail
    : prefillDraft?.source === 'manual' ? Pencil
    : Zap;

  // Shared by the header action buttons (small screens) and the left pane
  // tabs (md+): how many Case Source slot files are attached, and whether
  // this is an email-fetched draft.
  const isEmailFlow = prefillDraft?.source === 'email' && !!prefillDraft.emailPrescription;
  const scanFileCount = Object.values(caseSourceFiles).filter(Boolean).length;
  const has3DFiles = scanFileCount > 0;

  // Left-pane primary tab — exactly ONE of Order Form / Email / Add
  // Prescription, depending on how the case data arrives:
  //   • Case Source "Via Scanner" → live Order Form preview (no email here)
  //   • email-fetched draft       → the source email + prescription
  //   • manual / everything else  → upload card to auto-fetch the details
  // The 3D Model tab is always available next to it.
  const primaryTab = caseSource === 'Via Scanner'
    ? { label: 'Order Form',       icon: FileText,    hint: 'Preview the order form the lab will receive' }
    : isEmailFlow
      ? { label: 'Email',            icon: Mail,        hint: 'View the source email + prescription' }
      : { label: 'Add Prescription', icon: UploadCloud, hint: 'Add a prescription / order form manually to auto-fetch the details' };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC] overflow-hidden">
      {/* ── Full-screen top bar ───────────────────────────────────────────
          Replaces the Layout's sidebar + top bar. Keeps a compact "Back to
          Cases" button on the left, a source-aware pill in the middle
          (Email draft / Manual entry / Quick create) and a Close button on
          the right. The pill makes the active flow legible at a glance so
          the user knows whether they're looking at an inbox-fetched case
          or starting fresh. */}
      <header className="flex-shrink-0 h-14 bg-white border-b border-[#E0E0E6] flex items-center justify-between px-3 sm:px-4 gap-3">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] hover:bg-[#F0EFF6] hover:text-[#030213] transition-colors"
          title="Back to Cases"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back to Cases</span>
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-sm sm:text-base font-bold text-[#030213] truncate">Create Case</h1>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sourcePillTone}`}>
            <SourcePillIcon className="w-2.5 h-2.5" />
            {sourcePillLabel}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-lg text-[#717182] hover:bg-[#F0EFF6] hover:text-[#030213] flex items-center justify-center transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* ── Main split — same 380px left pane on every flow so the right
          column has a stable width. The pane is tabbed: the primary tab is
          flow-specific (source email for email drafts, live order form for
          scanner cases, an Add-Prescription upload card for manual entry —
          never more than one of those at a time) and "3D Model" is always
          available next to it. Hidden below md — small screens keep the
          header buttons + modals instead. ───────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Collapsed rail — slim icon strip pinned at the left edge. Each
            icon expands the pane straight onto that tab. */}
        {paneCollapsed && (
          <aside className="hidden md:flex w-12 flex-shrink-0 bg-white border-r border-[#E0E0E6] flex-col items-center pt-2 pb-3 gap-1">
            <button
              onClick={() => setPaneCollapsed(false)}
              title="Expand preview panel"
              className="w-8 h-8 rounded-lg text-[#717182] hover:bg-[#F0EFF6] hover:text-[#030213] flex items-center justify-center transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="w-6 h-px bg-[#E0E0E6] my-1" />
            <button
              onClick={() => { setPreviewTab('primary'); setPaneCollapsed(false); }}
              title={primaryTab.hint}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                previewTab === 'primary' ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#5A5568] hover:bg-[#F8F9FC]'
              }`}
            >
              <primaryTab.icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setPreviewTab('model'); setPaneCollapsed(false); }}
              title="View attached scan files in 3D"
              className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                previewTab === 'model' ? 'bg-[#EEF4FF] text-[#1565C0]' : 'text-[#5A5568] hover:bg-[#F8F9FC]'
              }`}
            >
              <Box className="w-4 h-4" />
              {scanFileCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#4D8EF7] text-white text-[8px] font-bold flex items-center justify-center">
                  {scanFileCount}
                </span>
              )}
            </button>
          </aside>
        )}
        {!paneCollapsed && (
        <aside className="hidden md:flex w-[380px] flex-shrink-0 bg-white border-r border-[#E0E0E6] flex-col overflow-hidden">
          {/* Tab strip */}
          <div className="flex-shrink-0 flex items-center gap-1 p-1.5 border-b border-[#E0E0E6]">
            {([
              { id: 'primary', label: primaryTab.label, icon: primaryTab.icon, hint: primaryTab.hint },
              { id: 'model',   label: '3D Model',       icon: Box,             hint: 'View attached scan files in 3D' },
            ] as const).map(t => {
              const TabIcon = t.icon;
              const active = previewTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPreviewTab(t.id)}
                  title={t.hint}
                  className={`flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors min-w-0 ${
                    active
                      ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]'
                      : 'text-[#5A5568] border-transparent hover:bg-[#F8F9FC] hover:text-[#030213]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{t.label}</span>
                  {t.id === 'model' && scanFileCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                      active ? 'bg-white text-[#1565C0] border border-[#BFDBFE]' : 'bg-[#F3EEFF] text-[#5B21B6]'
                    }`}>
                      {scanFileCount}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setPaneCollapsed(true)}
              title="Collapse preview panel"
              className="w-7 h-7 rounded-lg text-[#717182] hover:bg-[#F8F9FC] hover:text-[#030213] flex items-center justify-center flex-shrink-0 transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
          {previewTab === 'primary' && (caseSource === 'Via Scanner' ? (
            <OrderFormPane
              patientName={patientName}
              patientExtras={patientExtras}
              lab={selectedLab}
              dentist={selectedDentist}
              orderType={orderType}
              deliveryDate={deliveryDate}
              caseSource={caseSource}
              caseSourceFiles={caseSourceFiles}
              caseSourceExtraFiles={caseSourceExtraFiles}
              caseSourceScanner={caseSourceScanner}
              caseSourceCourier={caseSourceCourier}
              selections={selections}
              notes={caseInstructions}
            />
          ) : prefillDraft?.source === 'email' && prefillDraft.emailPrescription ? (
          <EmailPreviewPane caseData={prefillDraft} />
        ) : (
          <PrescriptionUploadPane
            onApply={(p) => {
              setPatientName(p.patientName);
              setCaseInstructions(p.instructions);
              // Find a matching service in the catalogue and seed the
              // selection with the detected teeth + material + shade so
              // the right column lights up just like an email-prefilled
              // case would.
              const itemId = SERVICE_NAME_TO_CATALOG_ID[p.serviceName];
              if (itemId) {
                const teeth = p.fdi
                  .map(fdiNumberToCode)
                  .filter(Boolean);
                setSelections([{
                  itemId,
                  teeth,
                  material: p.material,
                  shade: p.shade,
                  additional: p.instructions,
                  sameForAllTeeth: true,
                }]);
              }
              toast.success(`Form auto-filled from ${p.patientName}'s prescription`);
            }}
          />
        ))}
          {previewTab === 'model' && (
            <Model3DPane
              files={caseSourceFiles}
              onUploadScans={() => setCaseSourceOpen(true)}
            />
          )}
        </aside>
        )}
        <div className="flex-1 flex flex-col overflow-y-auto">
      <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-28">
        {/* ── Page header ── compact title row with action buttons on the right.
            • Case Source picks the delivery method + attaches files.
            • View 3D Model / View Order Form only render below md — on md+
              those previews live in the left pane tabs. When scan files are
              attached the 3D button opens the viewer; when no scans yet it
              opens the Case Source popup so the user can upload first. */}
        {(() => {
          return (
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-[#030213] leading-tight">Create Case</h1>
                <p className="text-[11px] text-[#717182] leading-tight">
                  Fill the essentials — everything else has defaults.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Case Source — moved to the header so file uploads sit
                    next to View 3D Model / View Order Form, the other
                    case-level actions. */}
                {/* Case Source — styled as a dropdown trigger. Closed: shows
                    a greyed placeholder + chevron, looks like an unset select.
                    Once a method is picked: switches to the teal accent so the
                    user can see at a glance what's set. Click opens the
                    method-picker popup; if files are attached, a small count
                    badge sits between the value and the chevron. */}
                {(() => {
                  const fileCount = Object.values(caseSourceFiles).filter(Boolean).length + caseSourceExtraFiles.length;
                  return (
                    <button
                      onClick={() => setCaseSourceOpen(true)}
                      className={`inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-lg text-xs font-semibold transition-colors min-w-[160px] ${
                        caseSource
                          ? 'text-[#0F766E] border border-[#A5F3FC] bg-[#ECFEFF] hover:bg-[#CFFAFE] hover:border-[#67E8F9]'
                          : 'text-[#A0A0B0] border border-[#E0E0E6] bg-white hover:border-[#4D8EF7] hover:text-[#1565C0]'
                      }`}
                      title="Choose how the case data is delivered + attach files"
                    >
                      <UploadCloud className={`w-3.5 h-3.5 flex-shrink-0 ${caseSource ? '' : 'text-[#A0A0B0]'}`} />
                      <span className={`flex-1 text-left truncate ${caseSource ? '' : 'font-medium italic'}`}>
                        {caseSource
                          ? (caseSource === 'Via Scanner' && caseSourceScanner
                              ? `Via Scanner · ${caseSourceScanner}`
                              : caseSource === 'Impressions (By Post)' && caseSourceCourier
                                ? `Impressions · ${caseSourceCourier}`
                                : caseSource)
                          : 'Case Source'}
                      </span>
                      {fileCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white text-[9px] font-bold text-[#0F766E] border border-[#A5F3FC] flex-shrink-0">
                          {fileCount}
                        </span>
                      )}
                      <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                    </button>
                  );
                })()}
                <button
                  onClick={() => has3DFiles ? setModel3DOpen(true) : setCaseSourceOpen(true)}
                  className={`md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    has3DFiles
                      ? 'text-[#5B21B6] border-[#DDD6FE] bg-[#F3EEFF] hover:bg-[#E9D5FF] hover:border-[#A78BFA]'
                      : 'text-[#7C3AED] border-dashed border-[#C8D8FC] bg-white hover:border-[#4D8EF7] hover:bg-[#F5F8FF]'
                  }`}
                  title={has3DFiles ? 'View 3D model' : 'No scan files yet — click to upload'}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View 3D Model</span>
                  <span className="sm:hidden">3D</span>
                  {has3DFiles ? (
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white text-[9px] font-bold text-[#5B21B6] border border-[#DDD6FE]">
                      {scanFileCount}
                    </span>
                  ) : (
                    <span className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#A0A0B0]">
                      <Upload className="w-2.5 h-2.5" />
                      Upload
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setOrderFormOpen(true)}
                  className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1565C0] border border-[#BFDBFE] bg-[#EEF4FF] hover:bg-[#DBEAFE] hover:border-[#60A5FA] transition-colors"
                  title="Preview the order form the lab will receive"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View Order Form</span>
                  <span className="sm:hidden">Form</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Draft banner — shown when the page loaded a saved draft, so
            the user can tell they're resuming an in-progress case. Includes
            a Discard action to wipe the draft and start fresh. ── */}
        {isResumedDraft && (
          <div className="max-w-6xl mx-auto mb-3 flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-[#EEF4FF] to-[#F3EEFF] border border-[#BFDBFE]">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 rounded-lg bg-white border border-[#BFDBFE] flex items-center justify-center flex-shrink-0">
                <FileText className="w-3 h-3 text-[#1565C0]" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#030213] leading-tight">Editing saved draft</p>
                {draftSavedAt && (
                  <p className="text-[10px] text-[#717182] leading-tight truncate">
                    Last saved {new Date(draftSavedAt).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleDiscardDraft}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-[#C62828] border border-[#F9DCDC] bg-white hover:bg-[#FFEBEE] transition-colors flex-shrink-0"
              title="Discard the saved draft and reset the form"
            >
              <X className="w-3 h-3" />
              Discard draft
            </button>
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* ── LEFT COLUMN — main form. Uses flex+order so Patient+Lab
              renders first visually while Case Details stays second in
              source, without moving large JSX blocks. ── */}
          <div className="flex flex-col gap-4 min-w-0 lg:order-1">

          {/* ── Case Details — single card that holds EVERY top-of-form field
              (Patient · Lab · Dentist · Order Type · Delivery · Case Source)
              with consistent Mini labels + text-xs inputs so they all read
              at the same altitude. ── */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 order-1">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-5 h-5 rounded-md bg-[#EEF4FF] text-[#4D8EF7] flex items-center justify-center">
                <User className="w-3 h-3" />
              </span>
              <h3 className="text-xs font-bold text-[#030213] uppercase tracking-wider">Case Details</h3>
            </div>
            {/* Row 1 — Patient + Lab (the headline who/where) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <Mini label="Patient" required>
                <PatientSearchSelect
                  value={patientName}
                  onChange={setPatientName}
                  onPickExisting={(p) => {
                    setPatientName(p.name);
                    setPatientExtras({
                      patientId:    p.patientId,
                      email:        p.email,
                      phoneCountry: p.phoneCountry,
                      phoneNumber:  p.phoneNumber,
                      dob:          p.dob,
                      gender:       p.gender,
                    });
                    toast.success(`${p.name} loaded from records`);
                  }}
                />
                <button
                  onClick={() => setPatientDrawerOpen(true)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#4D8EF7] hover:text-[#1565C0]"
                >
                  <Plus className="w-2.5 h-2.5" />
                  {patientExtrasCount > 0
                    ? `Patient details added (${patientExtrasCount})`
                    : 'Add additional details'}
                </button>
              </Mini>
              <Mini label="Lab" required>
                <LabSearchSelect
                  labs={labOptions}
                  selectedId={labId}
                  onSelect={setLabId}
                />
              </Mini>
            </div>
            {/* Row 2 — case-level metadata (Case Source moved to the header
                action bar at the top of the page). */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#F0EFF6]">
              <Mini label="Dentist">
                <DentistSearchSelect
                  dentists={dentists}
                  value={dentistId}
                  onChange={setDentistId}
                />
              </Mini>
              <Mini label="Order Type">
                <div className="relative">
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value)}
                    className="w-full appearance-none px-2.5 py-1.5 pr-7 text-xs text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                  >
                    {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Mini>
              <Mini label="Delivery">
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7]"
                />
              </Mini>
            </div>
          </div>

          {/* ── Services — multi-select with cards. Card background uses the
              same soft pink→teal wash as the sidebar so the SERVICES surface
              feels like the focal panel of the form. ── */}
          <div className="bg-gradient-to-br from-[#F7E2F8]/40 to-[#AEE3E6]/40 border border-[#E0E0E6] rounded-2xl p-4 order-3">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-5 h-5 rounded-md bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white flex items-center justify-center">
                  <Stethoscope className="w-3 h-3" />
                </span>
                <h3 className="text-xs font-bold text-[#030213] uppercase tracking-wider">Services</h3>
                <span className="text-[#D4183D] text-[10px]">*</span>
                {selections.length > 0 && (
                  <span className="ml-1 text-[10px] font-bold text-[#5A5568] tabular-nums">
                    {selections.length} added
                  </span>
                )}
              </div>
              <button
                onClick={() => setPickerOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
              >
                <Plus className="w-3 h-3" />
                Add services
              </button>
            </div>
            {selections.length === 0 ? (
              <button
                onClick={() => setPickerOpen(true)}
                className="w-full py-6 text-center rounded-lg border border-dashed border-[#D4CEE1] text-xs text-[#A0A0B0] hover:border-[#4D8EF7] hover:text-[#1565C0] transition-colors"
              >
                No services yet — click <span className="font-semibold">Add services</span> to pick from the catalogue.
              </button>
            ) : (
              <>
                {/* Hint banner — neutral grey, only appears when at least one
                    service still has no details. Details are optional, so
                    the tone is informational, not warning. */}
                {selections.some(s => !isSelectionComplete(s)) && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5F8FF] border border-[#E8EAF6] text-[11px] text-[#5A5568]">
                    <Pencil className="w-3 h-3 text-[#4D8EF7]" />
                    <span><span className="font-semibold text-[#030213]">Tap any service card</span> below to add material, shade, and teeth.</span>
                  </div>
                )}
                {/* Service cards — full-width rows so each service's details
                    read at a glance. Complete = green tint + summary chips;
                    incomplete = amber tint + "Add details" call-out. */}
                <div className="space-y-2">
                  {selections.map((sel, idx) => {
                    const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === sel.itemId);
                    if (!item) return null;
                    const hasDetails = isSelectionComplete(sel);
                    const partiallyFilled = !hasDetails && hasAnyData(sel);
                    const cat = getCategoryForItem(sel.itemId);
                    const displayName = getServiceDisplayName(sel);
                    const teethCount = sel.teeth?.length ?? 0;
                    const color = SERVICE_PALETTE[idx % SERVICE_PALETTE.length];
                    return (
                      <div
                        key={sel.itemId}
                        className="group rounded-xl border border-[#E8EAF6] bg-white hover:border-[#BFDBFE] hover:shadow-sm overflow-hidden transition-all"
                      >
                        {/* Top row — colored stripe + title + status + remove */}
                        <div className="flex items-stretch">
                          {/* Left colour band — matches the service's swatch in the legend */}
                          <div className="w-1 flex-shrink-0" style={{ background: color }} />
                          {/* Title block */}
                          <button
                            onClick={() => setActiveDetailsId(sel.itemId)}
                            className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left hover:bg-[#FAFBFF] transition-colors min-w-0"
                            title="Tap to edit material, shade, and teeth"
                          >
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                              hasDetails
                                ? 'bg-gradient-to-br from-[#16A34A] to-[#0F766E] text-white'
                                : 'bg-[#EEF4FF] text-[#4D8EF7]'
                            }`}>
                              {hasDetails
                                ? <Check className="w-3 h-3" strokeWidth={3} />
                                : <Pencil className="w-3 h-3" strokeWidth={2.5} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-xs font-bold text-[#030213] truncate">{displayName}</p>
                                <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded-full bg-[#F0EFF6] text-[9px] font-bold text-[#5A5568] uppercase tracking-wider">
                                  {cat}
                                </span>
                              </div>
                              {hasDetails ? (
                                <p className="text-[10px] text-[#1A5C2A] font-medium mt-0.5 truncate">
                                  ✓ Configured · {teethCount} {teethCount === 1 ? 'tooth' : 'teeth'} selected
                                </p>
                              ) : partiallyFilled ? (
                                <p className="text-[10px] text-[#5A5568] font-medium mt-0.5 truncate">
                                  In progress · {teethCount > 0 ? `${teethCount} ${teethCount === 1 ? 'tooth' : 'teeth'} · ` : ''}tap to finish
                                </p>
                              ) : (
                                <p className="text-[10px] text-[#717182] mt-0.5">
                                  <span className="font-semibold text-[#4D8EF7]">Add details</span>
                                  <span> — material, shade, and teeth</span>
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[#A0A0B0] group-hover:text-[#4D8EF7] transition-colors" />
                          </button>
                          {/* Remove button — its own bordered zone */}
                          <div className="w-px bg-[#E8EAF6]" />
                          <button
                            onClick={() => setConfirmRemoveId(sel.itemId)}
                            className="px-2.5 flex items-center justify-center hover:bg-[#FFEBEE] hover:text-[#C62828] text-[#A0A0B0] transition-colors flex-shrink-0"
                            title="Remove service"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </button>
                        </div>
                        {/* Detail strip — small chips showing the spec at a
                            glance. Renders whenever the user has filled at
                            least one field (even partial selections), so
                            half-entered services still show what's there
                            instead of the "Add details" prompt. When
                            sameForAllTeeth === false the material + shade
                            chips collapse into a row per tooth. */}
                        {(hasDetails || partiallyFilled) && (() => {
                          const perTooth = sel.sameForAllTeeth === false && teethCount > 0;
                          // Chips that apply to the whole service regardless
                          // of per-tooth mode (brand, retainer, etc.).
                          const sideChips = (
                            <>
                              {sel.brand && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#1A5C2A]">
                                  <span className="text-[#5A5568] font-normal">Brand:</span>
                                  {sel.brand}
                                </span>
                              )}
                              {sel.retainerType && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#1A5C2A]">
                                  <span className="text-[#5A5568] font-normal">Type:</span>
                                  {sel.retainerType}
                                </span>
                              )}
                              {sel.applianceOption && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#1A5C2A]">
                                  <span className="text-[#5A5568] font-normal">Option:</span>
                                  {sel.applianceOption}
                                </span>
                              )}
                              {(sel.stages?.length ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#1A5C2A]">
                                  <span className="text-[#5A5568] font-normal">Stage:</span>
                                  {sel.stages!.join(', ')}
                                </span>
                              )}
                            </>
                          );
                          if (perTooth) {
                            const sortedTeeth = (sel.teeth ?? []).slice().sort();
                            // Tint the rows + tooth pill with the service's
                            // palette colour so per-tooth specs visually
                            // belong to their parent service (matches the
                            // left band on the card + the legend swatch).
                            // 8-digit hex appends an alpha channel — 12 ≈ 7%
                            // for the row fill, 55 ≈ 33% for the border.
                            const rowBg     = `${color}12`;
                            const rowBorder = `${color}55`;
                            return (
                              <div className="px-2.5 pb-2 pt-0.5 ml-[8px] space-y-1">
                                {/* Per-tooth header — narrow column labels */}
                                <div className="grid grid-cols-[40px_1fr_1fr] gap-2 px-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider">
                                  <span>Tooth</span>
                                  <span>Material</span>
                                  <span>Shade</span>
                                </div>
                                {sortedTeeth.map(code => {
                                  const pt = sel.perTooth?.[code];
                                  const mat = pt?.material || sel.material;
                                  const shade = pt?.shade || sel.shade;
                                  return (
                                    <div
                                      key={code}
                                      className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center px-1.5 py-1 rounded-md border"
                                      style={{ background: rowBg, borderColor: rowBorder }}
                                    >
                                      <span
                                        className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-white border"
                                        style={{ color, borderColor: rowBorder }}
                                      >
                                        {code}
                                      </span>
                                      <span className="text-[10px] font-semibold text-[#030213] truncate">
                                        {mat || <span className="text-[#A0A0B0] italic font-normal">—</span>}
                                      </span>
                                      <span className="text-[10px] font-semibold text-[#030213] truncate">
                                        {shade || <span className="text-[#A0A0B0] italic font-normal">—</span>}
                                      </span>
                                    </div>
                                  );
                                })}
                                {/* Other non-per-tooth chips, if any */}
                                {(sel.brand || sel.retainerType || sel.applianceOption || (sel.stages?.length ?? 0) > 0) && (
                                  <div className="flex flex-wrap items-center gap-1 pt-1">{sideChips}</div>
                                )}
                              </div>
                            );
                          }
                          // Single material+shade across all teeth — same
                          // row layout as the per-tooth grid (Teeth |
                          // Material | Shade) so the card reads
                          // consistently in both modes. Header + data row
                          // share one parent grid + `grid-cols-subgrid`
                          // on the row so the columns line up regardless
                          // of how wide the tooth-pill cell ends up being.
                          const sortedTeeth = (sel.teeth ?? []).slice().sort();
                          const rowBg     = `${color}12`;
                          const rowBorder = `${color}55`;
                          return (
                            <div className="px-2.5 pb-2 pt-0.5 ml-[8px] space-y-1">
                              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-1">
                                {/* Header row — column labels */}
                                <span className="px-1.5 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider">Teeth</span>
                                <span className="text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider">Material</span>
                                <span className="text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider">Shade</span>
                                {/* Data row — spans the 3 parent cols with
                                    subgrid so its cells align to header. */}
                                <div
                                  className="col-span-3 grid grid-cols-subgrid items-center px-1.5 py-1 rounded-md border"
                                  style={{ background: rowBg, borderColor: rowBorder }}
                                >
                                  <div className="flex flex-wrap items-center gap-1">
                                    {sortedTeeth.length > 0 ? sortedTeeth.map(code => (
                                      <span
                                        key={code}
                                        className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-white border"
                                        style={{ color, borderColor: rowBorder }}
                                      >
                                        {code}
                                      </span>
                                    )) : <span className="text-[#A0A0B0] italic text-[10px]">—</span>}
                                  </div>
                                  <span className="text-[10px] font-semibold text-[#030213] truncate">
                                    {sel.material || <span className="text-[#A0A0B0] italic font-normal">—</span>}
                                  </span>
                                  <span className="text-[10px] font-semibold text-[#030213] truncate">
                                    {sel.shade || <span className="text-[#A0A0B0] italic font-normal">—</span>}
                                  </span>
                                </div>
                              </div>
                              {/* Other non-per-tooth chips, if any */}
                              {(sel.brand || sel.retainerType || sel.applianceOption || (sel.stages?.length ?? 0) > 0) && (
                                <div className="flex flex-wrap items-center gap-1 pt-1">{sideChips}</div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Case Instructions — textarea + file uploads, all optional ── */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 order-4">
            <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-[#EEF4FF] text-[#4D8EF7] flex items-center justify-center">
                  <FileText className="w-3 h-3" />
                </span>
                <h3 className="text-xs font-bold text-[#030213] uppercase tracking-wider">Case Instructions</h3>
                <span className="text-[10px] text-[#A0A0B0] italic">— optional</span>
              </div>
              {(caseInstructions.trim().length > 0 || caseInstructionsFiles.length > 0) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#16A34A] uppercase tracking-wider">
                  <Check className="w-3 h-3" strokeWidth={3} />
                  Added
                </span>
              )}
            </div>
            <textarea
              value={caseInstructions}
              onChange={(e) => setCaseInstructions(e.target.value)}
              rows={2}
              placeholder="Write here… (Anything the lab should know)"
              className="w-full px-3 py-2 text-xs text-[#030213] placeholder-[#A0A0B0] border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] resize-none mb-2"
            />
            {/* Upload zone — clicking adds a fake attachment for the demo.
                In production this would open the OS file picker. */}
            <button
              type="button"
              onClick={() => {
                setCaseInstructionsFiles(prev => [...prev, `attachment-${prev.length + 1}.pdf`]);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-[#C8D8FC] bg-white text-[#4D8EF7] hover:border-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Upload additional files</span>
              <span className="text-[10px] text-[#717182]">— photos, x-rays, references</span>
            </button>
            {caseInstructionsFiles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {caseInstructionsFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#EEF4FF] border border-[#BFDBFE] text-[10px] font-semibold text-[#1565C0]">
                    <FileText className="w-3 h-3" />
                    {f}
                    <button
                      onClick={() => setCaseInstructionsFiles(prev => prev.filter((_, j) => j !== i))}
                      className="hover:text-[#C62828]"
                      title="Remove"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          </div>
          {/* ── RIGHT COLUMN — aggregated teeth map across all services ── */}
          <aside className="lg:order-2 lg:sticky lg:top-4 lg:self-start">
            <AggregatedTeethChart selections={selections} />
          </aside>
        </div>
      </div>

      {/* Sticky footer — beefed up with a coloured top accent, upward shadow,
          and a big Create case CTA so the primary action stays visible
          without scrolling. */}
      <div className="sticky bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-[#E8EAF6] shadow-[0_-8px_24px_-12px_rgba(77,142,247,0.18)]">
        {/* Thin gradient accent strip — gives the bar a clear "primary
            action lives here" visual. */}
        <div className="h-0.5 bg-gradient-to-r from-[#4D8EF7] via-[#A59DFF] to-[#4D8EF7]" />
        <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#F0EFF6] text-[#5A5568] hover:bg-[#E5E3ED] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-[#5A5568] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC] hover:border-[#BFDBFE] hover:text-[#1565C0] transition-colors"
              title="Save the current form state so you can finish it later"
            >
              <FileText className="w-4 h-4" />
              Save as draft
            </button>
          </div>
          <div className="flex items-center gap-4 ml-auto flex-wrap">
            {/* Status pills — each essential field gets its own coloured
                indicator. Green when done, grey when pending. Reads as a
                live to-do list at the bottom of the screen. */}
            <div className="hidden sm:flex items-center gap-1.5">
              {[
                { label: 'Patient',  done: !!patientName.trim() },
                { label: 'Lab',      done: !!labId },
                { label: 'Services', done: selections.length > 0 },
              ].map(s => (
                <span
                  key={s.label}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${
                    s.done
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#1A5C2A]'
                      : 'bg-[#F8F9FC] border-[#E0E0E6] text-[#717182]'
                  }`}
                >
                  {s.done
                    ? <Check className="w-3 h-3" strokeWidth={3} />
                    : <span className="w-2.5 h-2.5 rounded-full border border-[#D4CEE1] bg-white" />}
                  {s.label}
                </span>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              title={canSubmit ? 'Submit this case' : 'Fill patient, lab, and at least one service to submit'}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 shadow-[0_4px_12px_rgba(77,142,247,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Create case
            </button>
          </div>
        </div>
      </div>
        </div> {/* end right scrollable column */}
      </div> {/* end horizontal flex */}

      {/* ── Patient extras drawer ── */}
      {patientDrawerOpen && (
        <PatientExtrasDrawer
          value={patientExtras}
          onChange={setPatientExtras}
          onClose={() => setPatientDrawerOpen(false)}
        />
      )}

      {/* ── Combined service picker + details drawer ──
          One drawer with two panes: pick services on the left, fill in
          the active service's details (teeth chart, material, shade,
          category-specific fields) on the right. Opens from "+ Add
          services" and from clicking any service chip on the page. */}
      {(pickerOpen || activeDetailsId) && (
        <ServicePickerWithDetails
          selections={selections}
          initialActiveId={activeDetailsId}
          onToggle={toggleService}
          onUpdate={updateService}
          onRemove={(itemId) => setConfirmRemoveId(itemId)}
          onClose={() => {
            setPickerOpen(false);
            setActiveDetailsId(null);
          }}
        />
      )}

      {/* ── Case Source popup ── method selector + optional file uploads ── */}
      {caseSourceOpen && (
        <CaseSourcePopup
          method={caseSource}
          files={caseSourceFiles}
          extraFiles={caseSourceExtraFiles}
          scanner={caseSourceScanner}
          courier={caseSourceCourier}
          onSave={(next) => {
            setCaseSource(next.method);
            setCaseSourceFiles(next.files);
            setCaseSourceExtras(next.extraFiles);
            // Drop the scanner brand when the user switches away from
            // "Via Scanner" so a stale brand label can't be saved.
            setCaseSourceScanner(next.method === 'Via Scanner' ? next.scanner : '');
            // Same idea for the courier when switching off Impressions.
            setCaseSourceCourier(next.method === 'Impressions (By Post)' ? next.courier : '');
            setCaseSourceOpen(false);
          }}
          onClose={() => setCaseSourceOpen(false)}
        />
      )}

      {/* ── 3D Model preview modal ── only meaningful when Via Scanner files
          have been attached. Renders the case's tooth model so the user can
          eyeball the scan before submitting. */}
      {model3DOpen && (
        <Model3DPreview
          files={caseSourceFiles}
          onClose={() => setModel3DOpen(false)}
        />
      )}

      {/* ── Order Form preview modal ── compiled snapshot of every field for
          the lab. Read-only; the user can close and continue editing or
          submit from the bottom footer. */}
      {orderFormOpen && (
        <OrderFormPreview
          patientName={patientName}
          patientExtras={patientExtras}
          lab={selectedLab}
          dentist={selectedDentist}
          orderType={orderType}
          deliveryDate={deliveryDate}
          caseSource={caseSource}
          caseSourceFiles={caseSourceFiles}
          caseSourceExtraFiles={caseSourceExtraFiles}
          caseSourceScanner={caseSourceScanner}
          caseSourceCourier={caseSourceCourier}
          selections={selections}
          notes={caseInstructions}
          onClose={() => setOrderFormOpen(false)}
        />
      )}

      {/* ── Confirm-remove modal ── the X on a service card and the Remove
          button in the drawer both funnel through here. Surfaces what's
          about to be lost (material / shade / teeth) so the click feels
          deliberate rather than instantly destructive. */}
      {confirmRemoveId && (
        <ConfirmRemoveServiceModal
          selection={selections.find(s => s.itemId === confirmRemoveId) ?? null}
          onCancel={() => setConfirmRemoveId(null)}
          onConfirm={() => {
            removeService(confirmRemoveId);
            setConfirmRemoveId(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Confirm-remove service modal ────────────────────────────────────────────
// A destructive-action confirmation rendered through the page-level modal
// portal so it covers everything (including the picker drawer if it's open).
// Lists the bits of state that will be discarded — material, shade, teeth,
// notes — so the user doesn't lose half-entered data to a stray click.
function ConfirmRemoveServiceModal({ selection, onCancel, onConfirm }: {
  selection: ServiceSelection | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!selection) return null;
  const name = getServiceDisplayName(selection);
  const cat = getCategoryForItem(selection.itemId);
  const teethCount = selection.teeth?.length ?? 0;
  // Which fields actually have data the user would lose. Drives the bullet
  // list under the prompt — we only mention the fields that aren't empty
  // so a barely-touched service shows a short confirmation.
  const lostBits: string[] = [];
  if (teethCount > 0)            lostBits.push(`${teethCount} ${teethCount === 1 ? 'tooth' : 'teeth'} selected`);
  if (selection.material)        lostBits.push(`material (${selection.material})`);
  if (selection.shade)           lostBits.push(`shade (${selection.shade})`);
  if (selection.brand)           lostBits.push(`brand (${selection.brand})`);
  if (selection.abutmentMaterial) lostBits.push(`abutment (${selection.abutmentMaterial})`);
  if (selection.retainerType)    lostBits.push(`retainer (${selection.retainerType})`);
  if (selection.applianceOption) lostBits.push(`type (${selection.applianceOption})`);
  if ((selection.stages?.length ?? 0) > 0) lostBits.push(`${selection.stages!.length} stage${selection.stages!.length === 1 ? '' : 's'}`);
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onCancel} />
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header — red accent strip + warning icon */}
          <div className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="w-10 h-10 rounded-full bg-[#FFEBEE] flex items-center justify-center flex-shrink-0">
              <X className="w-5 h-5 text-[#C62828]" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[#030213]">Remove "{name}"?</h3>
              <p className="text-xs text-[#5A5568] mt-0.5 capitalize">{cat} service</p>
            </div>
          </div>
          {/* Body — list of details that will be lost (if any) */}
          <div className="px-5 pb-4">
            {lostBits.length > 0 ? (
              <>
                <p className="text-xs text-[#5A5568] mb-2">
                  This will permanently discard:
                </p>
                <ul className="space-y-1">
                  {lostBits.map((bit) => (
                    <li key={bit} className="flex items-start gap-1.5 text-[11px] text-[#5A5568]">
                      <span className="text-[#C62828] mt-0.5">•</span>
                      <span className="capitalize">{bit}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#A0A0B0] italic mt-2">You can always add the service back from the catalogue, but its details won't come back.</p>
              </>
            ) : (
              <p className="text-xs text-[#5A5568]">
                No details have been entered yet, but you can also dismiss this if you tapped X by accident.
              </p>
            )}
          </div>
          {/* Footer — Cancel + destructive Remove */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFBFF] border-t border-[#F0EFF6]">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#5A5568] bg-white border border-[#E0E0E6] hover:bg-[#F0EFF6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#C62828] hover:bg-[#B71C1C] transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
              Remove service
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Patient extras drawer — optional patient details ────────────────────────
function PatientExtrasDrawer({ value, onChange, onClose }: {
  value: PatientExtras;
  onChange: (next: PatientExtras) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof PatientExtras>(k: K, v: PatientExtras[K]) =>
    onChange({ ...value, [k]: v });
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative ml-auto bg-white shadow-2xl w-full max-w-md flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-[#4D8EF7]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#030213]">Patient details</h3>
              <p className="text-[11px] text-[#717182]">Optional fields — fill what's available.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <Mini label="Patient ID">
            <input
              type="text"
              value={value.patientId}
              onChange={(e) => set('patientId', e.target.value)}
              placeholder="e.g. PAT-2026-0118"
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
            />
          </Mini>
          <Mini label="Email">
            <input
              type="email"
              value={value.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="patient@example.com"
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
            />
          </Mini>
          <Mini label="Phone">
            <div className="flex gap-2">
              <select
                value={value.phoneCountry}
                onChange={(e) => set('phoneCountry', e.target.value)}
                className="px-2 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7]"
              >
                {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="tel"
                value={value.phoneNumber}
                onChange={(e) => set('phoneNumber', e.target.value)}
                placeholder="Phone number"
                className="flex-1 px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
              />
            </div>
          </Mini>
          <Mini label="Date of birth">
            <input
              type="date"
              value={value.dob}
              onChange={(e) => set('dob', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
            />
          </Mini>
          <Mini label="Gender">
            <div className="relative">
              <select
                value={value.gender}
                onChange={(e) => set('gender', e.target.value as PatientExtras['gender'])}
                className="w-full appearance-none px-3 py-2 pr-9 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
              >
                {GENDER_OPTIONS.map(g => (
                  <option key={g.value || 'none'} value={g.value}>{g.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Mini>
        </div>
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Combined picker + details drawer ────────────────────────────────────────
// Two panes inside one wide drawer:
//   LEFT  — service catalogue (search, categories, items). Clicking an item
//           adds it to the case AND makes it the active detail target on
//           the right. Already-added items show a green "Added" badge and
//           clicking them re-selects them for editing.
//   RIGHT — active service's detail form (Material, Shade, Teeth, Notes,
//           plus the per-category extras). Mirrors the same fields as the
//           standalone ServiceDetailsDrawer.
function ServicePickerWithDetails({
  selections, initialActiveId,
  onToggle, onUpdate, onRemove, onClose,
}: {
  selections: ServiceSelection[];
  initialActiveId: string | null;
  /** Add a service (or remove it if already added). */
  onToggle: (itemId: string) => void;
  /** Patch a selection's fields. */
  onUpdate: (itemId: string, patch: Partial<ServiceSelection>) => void;
  /** Remove a service entirely. */
  onRemove: (itemId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  // Active service in the right pane. Defaults to the explicitly-opened
  // chip's id (when the user tapped a chip on the page), then falls back
  // to the most recently added selection.
  const [activeId, setActiveId] = useState<string | null>(
    initialActiveId ?? selections[selections.length - 1]?.itemId ?? null
  );

  const selectedIds = selections.map(s => s.itemId);
  const activeSel = selections.find(s => s.itemId === activeId) ?? null;

  // If the active selection gets removed (page-level confirm modal), slide
  // focus to the next remaining selection so the right pane keeps something
  // useful in view instead of falling back to the empty placeholder.
  useEffect(() => {
    if (activeId && !selectedIds.includes(activeId)) {
      setActiveId(selections[selections.length - 1]?.itemId ?? null);
    }
  }, [activeId, selectedIds, selections]);

  const q = search.trim().toLowerCase();
  const filteredCats = useMemo(() => {
    if (!q) return SERVICE_CATEGORIES;
    return SERVICE_CATEGORIES
      .map(cat => ({ ...cat, items: cat.items.filter(i => i.label.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [q]);

  function handlePick(itemId: string) {
    const exists = selectedIds.includes(itemId);
    if (!exists) onToggle(itemId);
    setActiveId(itemId);
  }

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative ml-auto bg-white shadow-2xl w-full max-w-5xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#030213] truncate">Pick &amp; configure services</h3>
              <p className="text-[11px] text-[#717182] truncate">Tap a service on the left to add it, then fill its details on the right.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — 2 panes */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-0">
          {/* ── LEFT PANE — catalogue ── */}
          <div className="flex flex-col border-r border-[#F0EFF6] min-h-0">
            <div className="px-4 py-3 border-b border-[#F0EFF6] flex-shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search service…"
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {filteredCats.length === 0 ? (
                <p className="text-center text-xs text-[#A0A0B0] italic py-6">No service matches "{search}".</p>
              ) : filteredCats.map(cat => (
                <div key={cat.id}>
                  <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5 px-1">{cat.label}</p>
                  <div className="space-y-1">
                    {cat.items.map(item => {
                      const sel = selections.find(s => s.itemId === item.id);
                      const added = !!sel;
                      const isActive = activeId === item.id;
                      // For added Others, show the user-typed name (or the
                      // "(untitled)" hint when blank). Catalogue items that
                      // haven't been added always show their generic label.
                      const chipLabel = sel ? getServiceDisplayName(sel) : item.label;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handlePick(item.id)}
                          title={added ? 'Edit this service' : `Add ${item.label}`}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F3EEFF] border border-[#4D8EF7] text-[#1565C0]'
                              : added
                                ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#1A5C2A] hover:border-[#86EFAC]'
                                : 'bg-white border border-[#E0E0E6] text-[#030213] hover:border-[#4D8EF7] hover:bg-[#F5F8FF]'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            added ? 'border-[#BBF7D0] bg-white' : 'border-[#C8D8FC] bg-white'
                          }`}>
                            <ToothGlyph filled={added} />
                          </span>
                          <span className="flex-1 truncate">{chipLabel}</span>
                          {added
                            ? <Check className="w-3 h-3 text-[#16A34A] flex-shrink-0" strokeWidth={3} />
                            : <Plus className="w-3 h-3 text-[#A0A0B0] flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT PANE — details for the active service ── */}
          <div className="flex flex-col min-h-0 bg-[#FAFBFF]">
            {activeSel ? (
              <ServiceDetailsBody
                selection={activeSel}
                onUpdate={(patch) => onUpdate(activeSel.itemId, patch)}
                onRemove={() => onRemove(activeSel.itemId)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center mb-3">
                  <Stethoscope className="w-6 h-6 text-[#7C3AED]" />
                </div>
                <p className="text-sm font-semibold text-[#030213] mb-1">Pick a service to configure</p>
                <p className="text-xs text-[#717182] max-w-sm">
                  Tap any item on the left to add it. Its detail form (teeth, material, shade, and category-specific fields) appears here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-[#717182]">
            <span className="font-bold text-[#030213]">{selections.length}</span>
            {' '}service{selections.length === 1 ? '' : 's'} added so far
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Service details body — shared by both drawers ───────────────────────────
// The set of form fields that render for a single service selection. Used by
// the standalone ServiceDetailsDrawer + the right pane of
// ServicePickerWithDetails.
function ServiceDetailsBody({ selection, onUpdate, onRemove }: {
  selection: ServiceSelection;
  onUpdate: (patch: Partial<ServiceSelection>) => void;
  onRemove?: () => void;
}) {
  const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === selection.itemId);
  const teeth = selection.teeth ?? [];
  const category    = getCategoryForItem(selection.itemId);
  const isBridge    = category === 'bridge';
  const isOrtho     = category === 'orthodontics';
  const isDenture   = category === 'denture';
  const isAppliance = category === 'appliances';
  const isOther     = category === 'others';
  const showMaterialShade = !isOrtho && !isAppliance;
  const applianceConfig = isAppliance ? getApplianceConfig(selection.itemId) : null;
  const displayName = getServiceDisplayName(selection);
  return (
    <>
      {/* Breadcrumb header — name + category + remove */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-[#F0EFF6] flex-shrink-0 bg-white">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{category}</p>
          <h4 className="text-sm font-bold text-[#030213] truncate">{displayName}</h4>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            title="Remove this service from the case"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#C62828] border border-[#F9DCDC] bg-white hover:bg-[#FFEBEE] transition-colors flex-shrink-0"
          >
            <X className="w-3 h-3" strokeWidth={2.5} />
            Remove
          </button>
        )}
      </div>
      {/* Body — 2-column layout. Teeth chart sits on the LEFT so it's the
          first thing the user sees and interacts with (tooth selection is
          step 1 of every service); the form fields scroll on the right. */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden min-h-0">
      {/* ── Left column — teeth chart, the entry point of every service.
          Stays visible while the user scrolls the form on the right.
          Slightly wider than the form's category blocks so the chart can
          render at a readable size without crowding the FDI numbers. ── */}
      <div className="hidden md:flex flex-col border-r border-[#F0EFF6] bg-[#FAFBFF] p-3 overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
            1. Teeth ({teeth.length})
          </p>
          {teeth.length > 0 && (
            <button
              onClick={() => onUpdate({ teeth: [] })}
              className="text-[10px] text-[#717182] hover:text-[#C62828]"
            >
              Clear
            </button>
          )}
        </div>
        <div className="bg-white border border-[#E0E0E6] rounded-xl p-3 flex justify-center">
          {/* Width is viewport-aware: caps at 240px on tall screens, scales
              down to whatever (100vh − drawer chrome) can fit on shorter
              laptops so the chart never forces an internal scrollbar.
              Chrome offset (~250px) covers: drawer header (60) + footer
              (50) + column padding (24) + "1. TEETH" row (30) + chart
              inner padding (24) + 60px breathing room for browser chrome
              / OS taskbar / DPI quirks. The selected-teeth chip strip
              now lives on the right column above the form fields so the
              left column doesn't need to budget vh for it.
              0.589 ≈ 327/555 (FDI viewBox ratio). */}
          <InteractiveToothChart
            activeService={selection}
            width="min(240px, calc((100vh - 250px) * 0.589))"
            onToothToggle={(code) => {
              const next = teeth.includes(code) ? teeth.filter(c => c !== code) : [...teeth, code];
              onUpdate({ teeth: next });
            }}
          />
        </div>
      </div>

      {/* ── Right column — form fields. Pinned at the top: a strip showing
          which teeth are currently selected, so as the user fills in
          material / shade / notes they can see at a glance what those
          values apply to. Numbered "2." cue echoes the "1." on the chart. ── */}
      <div className="overflow-y-auto p-5 space-y-5">
        {/* Selected-teeth summary strip — pinned to the top of the form. */}
        <div className={`rounded-xl px-3 py-2 border ${
          teeth.length > 0
            ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F3EEFF] border-[#BFDBFE]'
            : 'bg-[#FAFBFF] border-dashed border-[#E0E0E6]'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
              2. Selected Teeth ({teeth.length})
            </p>
            {teeth.length > 0 && (
              <button
                onClick={() => onUpdate({ teeth: [] })}
                className="text-[10px] text-[#717182] hover:text-[#C62828]"
              >
                Clear
              </button>
            )}
          </div>
          {teeth.length === 0 ? (
            <p className="text-[11px] text-[#A0A0B0] italic">
              Tap teeth on the chart at left — they'll appear here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {teeth.slice().sort().map(c => (
                <span
                  key={c}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-white text-[#1565C0] border border-[#BFDBFE]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* ── Others — custom service name (required) ── */}
        {isOther && (
          <Mini label="Service Name">
            <input
              type="text"
              value={selection.customServiceName || ''}
              onChange={(e) => onUpdate({ customServiceName: e.target.value })}
              placeholder="e.g. Periodontal Splint, Sleep Appliance…"
              className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
            />
          </Mini>
        )}

        {/* ── Generic Material + Shade — for categories that use them. The
            "Same for all teeth" toggle (default ON) collapses to one
            material + one shade for every selected tooth. Flipping it OFF
            reveals a per-tooth grid so each tooth can have its own. ── */}
        {showMaterialShade && (
          <MaterialShadeBlock selection={selection} onUpdate={onUpdate} />
        )}

        {/* Bridge specifics */}
        {isBridge && (
          <CategoryBlock label="Bridge specifics" tint="purple" icon={<FlaskConical className="w-3 h-3" />}>
            <Mini label="Brand">
              <div className="relative">
                <select
                  value={selection.brand || ''}
                  onChange={(e) => onUpdate({ brand: e.target.value })}
                  className="w-full appearance-none px-3 py-2 pr-9 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                >
                  <option value="">Select brand</option>
                  {IMPLANT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </Mini>
            <Mini label="Implant Abutment Material">
              <RadioGrid value={selection.abutmentMaterial} options={IMPLANT_ABUTMENT_MATERIALS} onChange={(v) => onUpdate({ abutmentMaterial: v })} />
            </Mini>
          </CategoryBlock>
        )}

        {/* Orthodontics specifics */}
        {isOrtho && (
          <CategoryBlock label="Orthodontics specifics" tint="blue" icon={<Stethoscope className="w-3 h-3" />}>
            <Mini label="Retainer Type">
              <RadioGrid value={selection.retainerType} options={RETAINER_TYPES} onChange={(v) => onUpdate({ retainerType: v })} />
            </Mini>
            <div>
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-2">Occlusion</p>
              <div className="space-y-3">
                <OcclusionRow label="Angle's Class" classValue={selection.anglesClass}  sideValue={selection.anglesSide}  onClassChange={(v) => onUpdate({ anglesClass: v })}  onSideChange={(v) => onUpdate({ anglesSide: v })} />
                <OcclusionRow label="Skeletal"      classValue={selection.skeletalClass} sideValue={selection.skeletalSide} onClassChange={(v) => onUpdate({ skeletalClass: v })} onSideChange={(v) => onUpdate({ skeletalSide: v })} />
                <OcclusionRow label="Dental"        classValue={selection.dentalClass}   sideValue={selection.dentalSide}   onClassChange={(v) => onUpdate({ dentalClass: v })}   onSideChange={(v) => onUpdate({ dentalSide: v })} />
              </div>
            </div>
          </CategoryBlock>
        )}

        {/* Denture specifics */}
        {isDenture && (
          <CategoryBlock label="Denture specifics" tint="amber" icon={<Stethoscope className="w-3 h-3" />}>
            <Mini label="Stage">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DENTURE_STAGES.map(stage => {
                  const isActive = (selection.stages ?? []).includes(stage);
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => {
                        const current = selection.stages ?? [];
                        const next = isActive ? current.filter(s => s !== stage) : [...current, stage];
                        onUpdate({ stages: next });
                      }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                        isActive
                          ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0] font-semibold'
                          : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#BFDBFE] hover:bg-[#F5F8FF]'
                      }`}
                    >
                      <span className="truncate">{stage}</span>
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
                      }`}>
                        {isActive && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Mini>
          </CategoryBlock>
        )}

        {/* Appliances specifics */}
        {isAppliance && applianceConfig && (
          <CategoryBlock label="Appliance specifics" tint="teal" icon={<Stethoscope className="w-3 h-3" />}>
            <Mini label={applianceConfig.label}>
              <RadioGrid value={selection.applianceOption} options={applianceConfig.options} onChange={(v) => onUpdate({ applianceOption: v })} />
            </Mini>
          </CategoryBlock>
        )}

      </div>
      </div>
    </>
  );
}

// ─── Per-service details drawer ──────────────────────────────────────────────
// Renders a different field set per category:
//   single-unit  → Material + Shade
//   bridge       → Material + Shade + Brand + Implant Abutment Material
//   orthodontics → Retainer Type + Occlusion (Angle's / Skeletal / Dental)
//   denture      → Material + Shade + Stage (multi-checkbox)
//   appliances   → per-item radio (Reservoirs / Type)
//   others       → free-text Service Name + Material + Shade
// Teeth chart + Notes are common to every category.
function ServiceDetailsDrawer({ selection, onUpdate, onClose }: {
  selection: ServiceSelection;
  onUpdate: (patch: Partial<ServiceSelection>) => void;
  onClose: () => void;
}) {
  const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === selection.itemId);
  const teeth = selection.teeth ?? [];
  const category    = getCategoryForItem(selection.itemId);
  const isBridge    = category === 'bridge';
  const isOrtho     = category === 'orthodontics';
  const isDenture   = category === 'denture';
  const isAppliance = category === 'appliances';
  const isOther     = category === 'others';
  const showMaterialShade = !isOrtho && !isAppliance;
  const applianceConfig = isAppliance ? getApplianceConfig(selection.itemId) : null;

  // Title — single source of truth for the service name. For Others the
  // typed name takes precedence; otherwise the catalogue label is used.
  const displayName = getServiceDisplayName(selection);

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative ml-auto bg-white shadow-2xl w-full max-w-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#030213] truncate">{displayName} details</h3>
              <p className="text-[11px] text-[#717182] capitalize">{category} · all fields optional</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── Teeth chart FIRST — tooth selection is step 1 of every
              service. Sits at the top so the user starts there and the
              rest of the form (material, shade, notes) follows. ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
                1. Teeth ({teeth.length})
              </p>
              {teeth.length > 0 && (
                <button
                  onClick={() => onUpdate({ teeth: [] })}
                  className="text-[10px] text-[#717182] hover:text-[#C62828]"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="bg-white border border-[#E0E0E6] rounded-xl p-3 flex flex-col items-center justify-center">
              {/* Viewport-aware width so the chart never overflows on small
                  laptops. Caps at 260px on tall screens; chrome offset is a
                  bit larger because the Detailed drawer is single-column so
                  it stacks the form + chart vertically and they share vh. */}
              <InteractiveToothChart
                activeService={selection}
                width="min(260px, calc((100vh - 360px) * 0.589))"
                onToothToggle={(code) => {
                  const next = teeth.includes(code) ? teeth.filter(c => c !== code) : [...teeth, code];
                  onUpdate({ teeth: next });
                }}
              />
            </div>
          </div>

          {/* ── Others — custom service name (required) ── */}
          {isOther && (
            <Mini label="Service Name">
              <input
                type="text"
                value={selection.customServiceName || ''}
                onChange={(e) => onUpdate({ customServiceName: e.target.value })}
                placeholder="e.g. Periodontal Splint, Sleep Appliance…"
                className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
              />
            </Mini>
          )}

          {/* ── Generic Material + Shade — for categories that use them ── */}
          {showMaterialShade && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Mini label="Material">
                <div className="relative">
                  <select
                    value={selection.material || ''}
                    onChange={(e) => onUpdate({ material: e.target.value })}
                    className="w-full appearance-none px-3 py-2 pr-9 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                  >
                    <option value="">Select material</option>
                    {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Mini>
              <Mini label="Tooth Shade">
                <ShadeSelector
                  value={selection.shade}
                  onChange={(v) => onUpdate({ shade: v })}
                />
              </Mini>
            </div>
          )}

          {/* ── Bridge specifics ── */}
          {isBridge && (
            <CategoryBlock label="Bridge specifics" tint="purple" icon={<FlaskConical className="w-3 h-3" />}>
              <Mini label="Brand">
                <div className="relative">
                  <select
                    value={selection.brand || ''}
                    onChange={(e) => onUpdate({ brand: e.target.value })}
                    className="w-full appearance-none px-3 py-2 pr-9 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                  >
                    <option value="">Select brand</option>
                    {IMPLANT_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </Mini>
              <Mini label="Implant Abutment Material">
                <RadioGrid
                  value={selection.abutmentMaterial}
                  options={IMPLANT_ABUTMENT_MATERIALS}
                  onChange={(v) => onUpdate({ abutmentMaterial: v })}
                />
              </Mini>
            </CategoryBlock>
          )}

          {/* ── Orthodontics specifics ── */}
          {isOrtho && (
            <CategoryBlock label="Orthodontics specifics" tint="blue" icon={<Stethoscope className="w-3 h-3" />}>
              <Mini label="Retainer Type">
                <RadioGrid
                  value={selection.retainerType}
                  options={RETAINER_TYPES}
                  onChange={(v) => onUpdate({ retainerType: v })}
                />
              </Mini>
              <div>
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-2">Occlusion</p>
                <div className="space-y-3">
                  <OcclusionRow
                    label="Angle's Class"
                    classValue={selection.anglesClass}
                    sideValue={selection.anglesSide}
                    onClassChange={(v) => onUpdate({ anglesClass: v })}
                    onSideChange={(v) => onUpdate({ anglesSide: v })}
                  />
                  <OcclusionRow
                    label="Skeletal"
                    classValue={selection.skeletalClass}
                    sideValue={selection.skeletalSide}
                    onClassChange={(v) => onUpdate({ skeletalClass: v })}
                    onSideChange={(v) => onUpdate({ skeletalSide: v })}
                  />
                  <OcclusionRow
                    label="Dental"
                    classValue={selection.dentalClass}
                    sideValue={selection.dentalSide}
                    onClassChange={(v) => onUpdate({ dentalClass: v })}
                    onSideChange={(v) => onUpdate({ dentalSide: v })}
                  />
                </div>
              </div>
            </CategoryBlock>
          )}

          {/* ── Denture specifics ── multi-select Stage ── */}
          {isDenture && (
            <CategoryBlock label="Denture specifics" tint="amber" icon={<Stethoscope className="w-3 h-3" />}>
              <Mini label="Stage">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DENTURE_STAGES.map(stage => {
                    const isActive = (selection.stages ?? []).includes(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => {
                          const current = selection.stages ?? [];
                          const next = isActive ? current.filter(s => s !== stage) : [...current, stage];
                          onUpdate({ stages: next });
                        }}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
                          isActive
                            ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0] font-semibold'
                            : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#BFDBFE] hover:bg-[#F5F8FF]'
                        }`}
                      >
                        <span className="truncate">{stage}</span>
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isActive ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
                        }`}>
                          {isActive && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Mini>
            </CategoryBlock>
          )}

          {/* ── Appliances specifics ── per-item radio ── */}
          {isAppliance && applianceConfig && (
            <CategoryBlock label="Appliance specifics" tint="teal" icon={<Stethoscope className="w-3 h-3" />}>
              <Mini label={applianceConfig.label}>
                <RadioGrid
                  value={selection.applianceOption}
                  options={applianceConfig.options}
                  onChange={(v) => onUpdate({ applianceOption: v })}
                />
              </Mini>
            </CategoryBlock>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Case Source popup ──────────────────────────────────────────────────────
// Centered modal (not a side drawer) because the file-upload grid + drop
// zone read better as a horizontal layout. Modal stays in a local draft
// state until the user clicks Save — that way Cancel truly discards the
// in-progress edits.
function CaseSourcePopup({
  method, files, extraFiles, scanner, courier, onSave, onClose,
}: {
  method: string;
  files: Record<string, string | null>;
  extraFiles: string[];
  scanner: string;
  courier: string;
  onSave: (next: { method: string; files: Record<string, string | null>; extraFiles: string[]; scanner: string; courier: string }) => void;
  onClose: () => void;
}) {
  // Local draft state — committed on Save, discarded on Cancel.
  const [draftMethod, setDraftMethod]       = useState(method);
  const [draftFiles, setDraftFiles]         = useState<Record<string, string | null>>(files);
  const [draftExtras, setDraftExtras]       = useState<string[]>(extraFiles);
  // Slot confidence + pending-review queue for the bulk upload flow. After
  // a bulk pick, each filename runs through `matchScanFile` — high
  // confidence matches drop straight into the named slots (and we record
  // 'auto' here so we can show a ✓ badge); ambiguous filenames go into
  // `pendingReview` so the user picks a slot manually.
  const [slotConfidence, setSlotConfidence] = useState<Record<string, 'auto' | 'manual'>>({});
  const [pendingReview, setPendingReview]   = useState<Array<{
    id: string;
    name: string;
    suggested: string | null;
    assigned: string | null;
  }>>([]);
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  // Scanner brand picker — only meaningful when method === 'Via Scanner'.
  // Two pieces of state: which row of the dropdown is selected (a brand
  // name OR the literal 'Other' sentinel) + the typed-in custom name used
  // when the user picks 'Other'. We rehydrate from the incoming `scanner`
  // prop so the popup remembers what was previously saved.
  const isKnownBrand = SCANNER_BRANDS.includes(scanner);
  const [draftScannerChoice, setDraftScannerChoice] = useState<string>(
    scanner ? (isKnownBrand ? scanner : 'Other') : ''
  );
  const [draftScannerOther, setDraftScannerOther]   = useState<string>(
    scanner && !isKnownBrand ? scanner : ''
  );
  // Resolves to the value that flows to the parent on save.
  const resolvedScanner =
    draftScannerChoice === 'Other'
      ? draftScannerOther.trim()
      : draftScannerChoice;
  // Courier picker — mirrors the scanner picker, but only shows when the
  // method is "Impressions (By Post)". Same Other-with-free-text pattern.
  const isKnownCourier = IMPRESSION_COURIERS.includes(courier);
  const [draftCourierChoice, setDraftCourierChoice] = useState<string>(
    courier ? (isKnownCourier ? courier : 'Other') : ''
  );
  const [draftCourierOther, setDraftCourierOther]   = useState<string>(
    courier && !isKnownCourier ? courier : ''
  );
  const resolvedCourier =
    draftCourierChoice === 'Other'
      ? draftCourierOther.trim()
      : draftCourierChoice;

  // Mock "upload" — toggle the slot between filled and empty. In production
  // this would open the OS file picker; for the prototype we generate a
  // deterministic fake filename so the UI reads as filled.
  const toggleSlot = (slot: string) => {
    setDraftFiles(prev => ({
      ...prev,
      [slot]: prev[slot] ? null : `${slot.toLowerCase().replace(/\s+/g, '-')}.stl`,
    }));
  };
  const addExtra = () => {
    setDraftExtras(prev => [...prev, `attachment-${prev.length + 1}.pdf`]);
  };
  const removeExtra = (idx: number) => {
    setDraftExtras(prev => prev.filter((_, i) => i !== idx));
  };

  // Bulk file handler — opens the OS picker, then routes each picked file to
  // a slot based on filename keywords. Unambiguous matches drop straight in;
  // the rest land in `pendingReview` for the user to slot manually.
  const handleBulkFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList);
    // Start from current state; track what's been claimed THIS round so a
    // second "Upper" file doesn't overwrite the first — it slides to
    // pending instead.
    const nextFiles: Record<string, string | null> = { ...draftFiles };
    const nextConfidence: Record<string, 'auto' | 'manual'> = { ...slotConfidence };
    const claimedThisRound = new Set<string>();
    const stillPending: Array<{ id: string; name: string; suggested: string | null; assigned: string | null }> = [];

    incoming.forEach((f, i) => {
      const match = matchScanFile(f.name);
      const slot = match.slot;
      const canFill = slot && match.confidence === 'high' && !nextFiles[slot] && !claimedThisRound.has(slot);
      if (canFill) {
        nextFiles[slot!]    = f.name;
        nextConfidence[slot!] = 'auto';
        claimedThisRound.add(slot!);
      } else {
        stillPending.push({
          id: `${Date.now().toString(36)}-${i}`,
          name: f.name,
          suggested: slot,             // may be null if no keyword
          assigned: slot,              // user can change this
        });
      }
    });

    setDraftFiles(nextFiles);
    setSlotConfidence(nextConfidence);
    setPendingReview(prev => [...prev, ...stillPending]);
    // Reset the input so picking the same files again still fires onChange.
    if (bulkInputRef.current) bulkInputRef.current.value = '';
  };

  // Commit a single pending-review row to its assigned slot.
  const acceptPending = (id: string) => {
    const row = pendingReview.find(r => r.id === id);
    if (!row || !row.assigned) return;
    if (draftFiles[row.assigned]) {
      // Slot already filled — refuse to overwrite silently. Could surface a
      // confirm here later; for now ignore so the user re-assigns.
      return;
    }
    setDraftFiles(prev => ({ ...prev, [row.assigned!]: row.name }));
    setSlotConfidence(prev => ({ ...prev, [row.assigned!]: 'manual' }));
    setPendingReview(prev => prev.filter(r => r.id !== id));
  };
  const discardPending = (id: string) => {
    setPendingReview(prev => prev.filter(r => r.id !== id));
  };
  const reassignPending = (id: string, slot: string | null) => {
    setPendingReview(prev => prev.map(r => r.id === id ? { ...r, assigned: slot } : r));
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <h3 className="text-lg font-bold text-[#030213]">Case Source</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F3F5] hover:bg-[#E8E8EC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Method radio row */}
          <div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {CASE_SOURCES.map(m => {
                const isActive = draftMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraftMethod(m)}
                    className="inline-flex items-center gap-2 text-sm text-[#030213]"
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'border-[#4D8EF7] bg-white' : 'border-[#D1D5DB] bg-white'
                    }`}>
                      {isActive && <span className="w-2 h-2 rounded-full bg-[#4D8EF7]" />}
                    </span>
                    <span className={isActive ? 'font-semibold' : ''}>{m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scanner Brand picker — only when method is "Via Scanner". The
              dropdown options are the known brands plus an "Other" sentinel
              that reveals a free-text input so clinics can name an unlisted
              scanner. The label tells the lab which device the STL/PLY
              files came from. */}
          {draftMethod === 'Via Scanner' && (
            <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-2xl px-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                    Scanner brand
                    <span className="text-[10px] font-normal text-[#A0A0B0] ml-1">— so the lab knows the device</span>
                  </label>
                  <div className="relative">
                    <select
                      value={draftScannerChoice}
                      onChange={(e) => setDraftScannerChoice(e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                    >
                      <option value="">Select scanner…</option>
                      {SCANNER_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                      <option value="Other">Other (specify)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                {draftScannerChoice === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                      Scanner name
                      <span className="text-[#D4183D] ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={draftScannerOther}
                      onChange={(e) => setDraftScannerOther(e.target.value)}
                      placeholder="e.g. CS-3700, Aoralscan…"
                      className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Courier picker — only when method is "Impressions (By Post)".
              Mirrors the Scanner Brand block: dropdown of known couriers
              plus "Other (specify)" that reveals a free-text input. */}
          {draftMethod === 'Impressions (By Post)' && (
            <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-2xl px-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                    Courier / Postal service
                    <span className="text-[10px] font-normal text-[#A0A0B0] ml-1">— so the lab can track the parcel</span>
                  </label>
                  <div className="relative">
                    <select
                      value={draftCourierChoice}
                      onChange={(e) => setDraftCourierChoice(e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                    >
                      <option value="">Select courier…</option>
                      {IMPRESSION_COURIERS.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="Other">Other (specify)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                {draftCourierChoice === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#030213] mb-1.5">
                      Courier name
                      <span className="text-[#D4183D] ml-0.5">*</span>
                    </label>
                    <input
                      type="text"
                      value={draftCourierOther}
                      onChange={(e) => setDraftCourierOther(e.target.value)}
                      placeholder="e.g. FedEx, ParcelForce, UPS…"
                      className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk upload (auto-sort) — opens the OS picker so the user can
              drop multiple scan files at once. The system reads each
              filename and routes confident matches (upper/lower/bite) into
              the right slot. Ambiguous filenames fall into the Needs-review
              strip below so the user picks the slot manually. */}
          <div className="bg-gradient-to-r from-[#EEF4FF] to-[#F3EEFF] border border-[#BFDBFE] rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#4D8EF7] flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#030213]">Bulk upload (auto-sort)</p>
              <p className="text-[11px] text-[#5A5568] leading-snug">
                Pick all your scan files at once — we'll route them into the slots below by filename. Anything we can't read goes to <span className="font-semibold">Needs review</span>.
              </p>
            </div>
            <input
              ref={bulkInputRef}
              type="file"
              multiple
              accept=".stl,.ply,.obj,.dcm,.zip,.3oxz,.3dm,.dxd"
              onChange={(e) => handleBulkFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bulkInputRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 flex-shrink-0 inline-flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
              Choose files
            </button>
          </div>

          {/* Needs-review strip — only when ambiguous bulk-uploaded files
              are waiting for a slot. Each row shows the filename, the
              system's best guess (if any), and a slot picker so the user
              can confirm or override. Discard removes the file outright. */}
          {pendingReview.length > 0 && (
            <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-[#B45309]" />
                <p className="text-xs font-bold text-[#92400E] uppercase tracking-wider">
                  Needs review · {pendingReview.length} file{pendingReview.length === 1 ? '' : 's'}
                </p>
              </div>
              <p className="text-[11px] text-[#92400E] mb-3 leading-snug">
                We couldn't tell where these go from the filename. Pick a slot for each, or discard if it doesn't belong.
              </p>
              <div className="space-y-1.5">
                {pendingReview.map(row => {
                  const slotTaken = row.assigned && draftFiles[row.assigned];
                  return (
                    <div key={row.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-white border border-[#FCD34D] rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#030213] truncate" title={row.name}>{row.name}</p>
                        {row.suggested && (
                          <p className="text-[10px] text-[#B45309]">Best guess: {row.suggested}</p>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          value={row.assigned ?? ''}
                          onChange={(e) => reassignPending(row.id, e.target.value || null)}
                          className="appearance-none text-[11px] border border-[#E0E0E6] rounded-md px-2 py-1 pr-6 bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
                        >
                          <option value="">Pick slot…</option>
                          {CASE_SOURCE_UPLOAD_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        disabled={!row.assigned || !!slotTaken}
                        onClick={() => acceptPending(row.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={slotTaken ? `${row.assigned} slot is already filled — clear it first` : 'Drop into the chosen slot'}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => discardPending(row.id)}
                        className="w-6 h-6 rounded-md text-[#A0A0B0] hover:text-[#C62828] hover:bg-[#FFEBEE] flex items-center justify-center"
                        title="Discard this file"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Named upload slots */}
          <div className="bg-[#F8F9FC] border border-[#E0E0E6] rounded-2xl px-4 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CASE_SOURCE_UPLOAD_SLOTS.map(slot => {
                const filled = !!draftFiles[slot];
                const conf = slotConfidence[slot];
                return (
                  <div key={slot} className="text-center">
                    <p className="text-xs font-semibold text-[#030213] mb-2">{slot}</p>
                    <button
                      type="button"
                      onClick={() => {
                        // Toggle off clears the file + its confidence record.
                        if (draftFiles[slot]) {
                          setDraftFiles(prev => ({ ...prev, [slot]: null }));
                          setSlotConfidence(prev => {
                            const next = { ...prev }; delete next[slot]; return next;
                          });
                        } else {
                          toggleSlot(slot);
                        }
                      }}
                      className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                        filled
                          ? 'border-[#16A34A] bg-[#F0FDF4] text-[#1A5C2A]'
                          : 'border-[#C8D8FC] bg-white text-[#4D8EF7] hover:border-[#4D8EF7] hover:bg-[#F5F8FF]'
                      }`}
                    >
                      {filled ? (
                        <>
                          <Check className="w-5 h-5" strokeWidth={3} />
                          <span className="text-[11px] font-semibold">Uploaded</span>
                          <span className="text-[9px] text-[#5A5568] truncate max-w-full px-1">{draftFiles[slot]}</span>
                          {/* Confidence badge — visible once a bulk upload
                              dropped the file here automatically. Manual
                              picks get a neutral "Set" badge. */}
                          {conf === 'auto' && (
                            <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]">
                              Auto-matched
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span className="text-[11px] font-medium">Click to upload files</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional files drop zone */}
          <div>
            <p className="text-sm font-semibold text-[#030213] mb-2">Upload additional files</p>
            <button
              type="button"
              onClick={addExtra}
              className="w-full rounded-2xl border-2 border-dashed border-[#C8D8FC] bg-white py-8 flex flex-col items-center justify-center gap-1.5 hover:border-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-[#EEF4FF] flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-[#4D8EF7]" />
              </div>
              <span className="text-sm font-semibold text-[#030213]">Click to upload files</span>
              <span className="text-[11px] text-[#717182]">Attach your files here</span>
            </button>
            {draftExtras.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {draftExtras.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#EEF4FF] border border-[#BFDBFE] text-[10px] font-semibold text-[#1565C0]">
                    <FileText className="w-3 h-3" />
                    {f}
                    <button onClick={() => removeExtra(i)} className="hover:text-[#C62828]">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F0EFF6] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-[#5A5568] bg-[#F0EFF6] hover:bg-[#E5E3ED] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({
              method: draftMethod,
              files: draftFiles,
              extraFiles: draftExtras,
              scanner: resolvedScanner,
              courier: resolvedCourier,
            })}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Material + Tooth Shade block ───────────────────────────────────────────
// One Material + one Tooth Shade dropdown by default, with a "Same for all
// teeth" toggle. Flipping it OFF reveals a per-tooth table so each selected
// tooth can have its own material and shade — useful when a multi-unit
// service needs different prosthetic materials per position.
// ─── OtherableSelect — dropdown + Other (specify) free-text fallback ───────
// Used by every Material / Shade picker so unlisted materials or special
// shades can still be captured verbatim. The value the consumer receives is
// always a plain string (either a standard option or the user-typed custom
// text). Internal `otherMode` state remembers when the input should stay
// open — even after the user clears it back to empty — so they're not
// kicked back to the dropdown view mid-edit.
function OtherableSelect({ options, value, onChange, placeholder, otherPlaceholder, compact = false }: {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  otherPlaceholder: string;
  compact?: boolean;
}) {
  const isStandard = !value || options.includes(value);
  // Boot in Other mode if the incoming value isn't one of the known options.
  const [otherMode, setOtherMode] = useState<boolean>(!isStandard && !!value);
  // If the parent flips the value to a known option (or clears it via Clear),
  // re-sync so the dropdown re-asserts itself. Keep Other mode when the
  // user is mid-edit (value empty but otherMode set by the user).
  useEffect(() => {
    if (value && options.includes(value)) {
      setOtherMode(false);
    } else if (value && !options.includes(value)) {
      setOtherMode(true);
    }
  }, [value, options]);
  const selectValue = otherMode ? 'Other' : (value || '');
  const baseSize = compact
    ? 'px-2 py-1 pr-6 text-[11px]'
    : 'px-2.5 py-1.5 pr-7 text-xs';
  const inputSize = compact
    ? 'mt-1 px-2 py-1 text-[11px]'
    : 'mt-1.5 px-2.5 py-1.5 text-xs';
  return (
    <div>
      <div className="relative">
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'Other') {
              setOtherMode(true);
              onChange('');  // clear until user types into the input
            } else {
              setOtherMode(false);
              onChange(v);
            }
          }}
          className={`w-full appearance-none border border-[#E0E0E6] rounded-${compact ? 'md' : 'lg'} bg-white outline-none focus:border-[#4D8EF7] cursor-pointer truncate ${baseSize}`}
        >
          <option value="">{placeholder}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
          <option value="Other">Other (specify)</option>
        </select>
        <ChevronDown className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-[#A0A0B0] absolute ${compact ? 'right-1.5' : 'right-2'} top-1/2 -translate-y-1/2 pointer-events-none`} />
      </div>
      {otherMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={otherPlaceholder}
          autoFocus
          className={`w-full border border-[#E0E0E6] rounded-${compact ? 'md' : 'lg'} bg-white outline-none focus:border-[#4D8EF7] ${inputSize}`}
        />
      )}
    </div>
  );
}

function MaterialShadeBlock({ selection, onUpdate }: {
  selection: ServiceSelection;
  onUpdate: (patch: Partial<ServiceSelection>) => void;
}) {
  const sameForAll = selection.sameForAllTeeth !== false; // default true
  const teeth = selection.teeth ?? [];
  const perTooth = selection.perTooth ?? {};
  // Custom "Others" services rarely match any catalogued material / shade,
  // so the dropdown gets in the way. Skip OtherableSelect entirely for that
  // category and render plain text inputs for both fields.
  const isOtherCategory = getCategoryForItem(selection.itemId) === 'others';

  const setPerTooth = (code: string, patch: { material?: string; shade?: string }) => {
    onUpdate({
      perTooth: {
        ...perTooth,
        [code]: { ...perTooth[code], ...patch },
      },
    });
  };

  return (
    <div className="bg-white border border-[#E8EAF6] rounded-xl p-3">
      {/* Toggle row — "Same for all teeth" + small toggle switch */}
      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#F0EFF6]">
        <div>
          <p className="text-[11px] font-bold text-[#030213]">Same material &amp; shade for all teeth</p>
          <p className="text-[10px] text-[#717182] leading-tight">
            {sameForAll
              ? 'Toggle off to pick a different material or shade per tooth.'
              : 'Each selected tooth gets its own dropdowns below.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sameForAll}
          onClick={() => onUpdate({ sameForAllTeeth: !sameForAll })}
          className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            sameForAll ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' : 'bg-[#D4CEE1]'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
            sameForAll ? 'translate-x-4' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {sameForAll ? (
        /* Single Material + Shade pair — applies to every selected tooth.
            Others category drops the dropdowns entirely (custom services
            rarely match the catalogued options). */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Mini label="Material">
            {isOtherCategory ? (
              <input
                type="text"
                value={selection.material || ''}
                onChange={(e) => onUpdate({ material: e.target.value })}
                placeholder="Type the material…"
                className="w-full px-2.5 py-1.5 text-xs border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
              />
            ) : (
              <OtherableSelect
                options={MATERIAL_TYPES}
                value={selection.material || ''}
                onChange={(v) => onUpdate({ material: v })}
                placeholder="Select material"
                otherPlaceholder="Type the material name…"
              />
            )}
          </Mini>
          <Mini label="Tooth Shade">
            {isOtherCategory ? (
              <input
                type="text"
                value={selection.shade || ''}
                onChange={(e) => onUpdate({ shade: e.target.value })}
                placeholder="Type the shade…"
                className="w-full px-2.5 py-1.5 text-xs border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7]"
              />
            ) : (
              <OtherableSelect
                options={TOOTH_SHADES}
                value={selection.shade || ''}
                onChange={(v) => onUpdate({ shade: v })}
                placeholder="Select shade"
                otherPlaceholder="Type the shade name…"
              />
            )}
          </Mini>
        </div>
      ) : (
        /* Per-tooth rows — each selected tooth gets its own dropdowns. */
        <div>
          {teeth.length === 0 ? (
            <p className="text-[11px] text-[#A0A0B0] italic text-center py-4">
              Pick teeth on the chart below first, then set material/shade per tooth here.
            </p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[80px_1fr_1fr] gap-2 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider px-1">
                <span>Tooth</span>
                <span>Material</span>
                <span>Shade</span>
              </div>
              {teeth.slice().sort().map(code => {
                const entry = perTooth[code] ?? {};
                return (
                  <div key={code} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-start">
                    <span className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[#EEF4FF] border border-[#BFDBFE] text-[11px] font-mono font-bold text-[#1565C0] mt-0.5">
                      {code}
                    </span>
                    {isOtherCategory ? (
                      <input
                        type="text"
                        value={entry.material || ''}
                        onChange={(e) => setPerTooth(code, { material: e.target.value })}
                        placeholder="Material…"
                        className="w-full px-2 py-1 text-[11px] border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7]"
                      />
                    ) : (
                      <OtherableSelect
                        compact
                        options={MATERIAL_TYPES}
                        value={entry.material || ''}
                        onChange={(v) => setPerTooth(code, { material: v })}
                        placeholder="Material…"
                        otherPlaceholder="Type material…"
                      />
                    )}
                    {isOtherCategory ? (
                      <input
                        type="text"
                        value={entry.shade || ''}
                        onChange={(e) => setPerTooth(code, { shade: e.target.value })}
                        placeholder="Shade…"
                        className="w-full px-2 py-1 text-[11px] border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7]"
                      />
                    ) : (
                      <OtherableSelect
                        compact
                        options={TOOTH_SHADES}
                        value={entry.shade || ''}
                        onChange={(v) => setPerTooth(code, { shade: v })}
                        placeholder="Shade…"
                        otherPlaceholder="Type shade…"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Per-category section wrapper ───────────────────────────────────────────
// Adds a coloured pill label + top divider so the category-specific fields
// read as a distinct block within the drawer.
function CategoryBlock({ label, tint, icon, children }: {
  label: string;
  tint: 'purple' | 'blue' | 'amber' | 'teal';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const palette = {
    purple: 'bg-[#F3EEFF] border-[#DDD6FE] text-[#5B21B6]',
    blue:   'bg-[#EEF4FF] border-[#BFDBFE] text-[#1565C0]',
    amber:  'bg-[#FFFBEB] border-[#FCD34D] text-[#92400E]',
    teal:   'bg-[#ECFEFF] border-[#A5F3FC] text-[#0F766E]',
  }[tint];
  return (
    <div className="space-y-4 pt-4 border-t border-[#F0EFF6]">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${palette}`}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

// Simple single-select radio grid — used by Bridge abutment, Orthodontics
// retainer type, and Appliances per-item option.
function RadioGrid({ value, options, onChange }: {
  value?: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map(opt => {
        const isActive = value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
              isActive
                ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0] font-semibold'
                : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#BFDBFE] hover:bg-[#F5F8FF]'
            }`}
          >
            <span className="truncate">{opt}</span>
            <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              isActive ? 'border-[#4D8EF7] bg-[#4D8EF7]' : 'border-[#D1D5DB] bg-white'
            }`}>
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Occlusion row — Angle's Class / Skeletal / Dental each have a class
// (Class I/II/III) plus a side (Left/Right/Both/N/A). Compact two-column row.
function OcclusionRow({ label, classValue, sideValue, onClassChange, onSideChange }: {
  label: string;
  classValue?: string;
  sideValue?: string;
  onClassChange: (v: string) => void;
  onSideChange: (v: string) => void;
}) {
  return (
    <div className="bg-[#FAFBFF] border border-[#E8EAF6] rounded-lg p-2.5">
      <p className="text-[11px] font-semibold text-[#030213] mb-1.5">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <select
            value={classValue || ''}
            onChange={(e) => onClassChange(e.target.value)}
            className="w-full appearance-none px-2.5 py-1.5 pr-7 text-xs border border-[#E0E0E6] rounded-md bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
          >
            <option value="">Class</option>
            {OCCLUSION_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={sideValue || ''}
            onChange={(e) => onSideChange(e.target.value)}
            className="w-full appearance-none px-2.5 py-1.5 pr-7 text-xs border border-[#E0E0E6] rounded-md bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
          >
            <option value="">Side</option>
            {OCCLUSION_SIDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 text-[#A0A0B0] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// ─── Aggregated teeth chart ──────────────────────────────────────────────────
// Renders the real FDI dental SVG with per-tooth colored ellipses overlaid.
// Each service in the case gets a colour from a fixed palette; teeth picked
// by multiple services render with a split (linear-gradient) fill that
// includes every service's colour in equal bands. Hover any tooth to see
// which services are using it.
const SERVICE_PALETTE = [
  '#4D8EF7', // blue
  '#7C3AED', // purple
  '#F59E0B', // amber
  '#16A34A', // green
  '#C62828', // red
  '#0F766E', // teal
  '#DB2777', // pink
  '#0EA5E9', // sky
];

// Tooth coordinates on the FDI.svg viewBox — measured from path centroids
// in /public/FDI.svg so the highlight ellipses land on the tooth SHAPES,
// not on the FDI number labels drawn above/outside them. Must stay in
// sync with InteractiveToothChart's TEETH constant in CreateCasePage.tsx
// (the user-facing tooth picker uses the same coords for its hit areas).
const FDI_TEETH: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  // Upper Q1 (patient's right = viewer's left)
  '11': { cx: 144, cy:  44, rx: 12, ry: 11 },
  '12': { cx: 108, cy:  51, rx: 11, ry: 10 },
  '13': { cx:  81, cy:  67, rx: 14, ry: 13 },
  '14': { cx:  68, cy:  97, rx: 15, ry: 15 },
  '15': { cx:  57, cy: 129, rx: 17, ry: 15 },
  '16': { cx:  46, cy: 166, rx: 22, ry: 22 },
  '17': { cx:  42, cy: 209, rx: 20, ry: 19 },
  '18': { cx:  42, cy: 247, rx: 20, ry: 18 },
  // Upper Q2 (patient's left = viewer's right)
  '21': { cx: 184, cy:  44, rx: 12, ry: 11 },
  '22': { cx: 219, cy:  51, rx: 11, ry: 10 },
  '23': { cx: 246, cy:  67, rx: 14, ry: 13 },
  '24': { cx: 259, cy:  97, rx: 15, ry: 15 },
  '25': { cx: 270, cy: 129, rx: 17, ry: 15 },
  '26': { cx: 280, cy: 166, rx: 22, ry: 22 },
  '27': { cx: 284, cy: 209, rx: 20, ry: 19 },
  '28': { cx: 284, cy: 247, rx: 20, ry: 18 },
  // Lower Q4 (patient's right = viewer's left)
  '48': { cx:  49, cy: 332, rx: 21, ry: 18 },
  '47': { cx:  57, cy: 370, rx: 22, ry: 21 },
  '46': { cx:  66, cy: 411, rx: 22, ry: 22 },
  '45': { cx:  71, cy: 447, rx: 16, ry: 15 },
  '44': { cx:  83, cy: 474, rx: 15, ry: 14 },
  '43': { cx: 102, cy: 496, rx: 16, ry: 17 },
  '42': { cx: 126, cy: 511, rx: 13, ry: 11 },
  '41': { cx: 151, cy: 520, rx: 11, ry:  6 },
  // Lower Q3 (patient's left = viewer's right)
  '31': { cx: 175, cy: 520, rx: 11, ry:  6 },
  '32': { cx: 200, cy: 511, rx: 13, ry: 11 },
  '33': { cx: 224, cy: 496, rx: 16, ry: 17 },
  '34': { cx: 242, cy: 474, rx: 15, ry: 14 },
  '35': { cx: 254, cy: 447, rx: 16, ry: 15 },
  '36': { cx: 260, cy: 412, rx: 22, ry: 22 },
  '37': { cx: 269, cy: 372, rx: 22, ry: 21 },
  '38': { cx: 277, cy: 333, rx: 21, ry: 18 },
};

function AggregatedTeethChart({ selections }: { selections: ServiceSelection[] }) {
  // Map FDI code → list of {service color + label} entries that include it.
  const teethMap = useMemo(() => {
    const map = new Map<string, { color: string; label: string }[]>();
    selections.forEach((sel, idx) => {
      const displayName = getServiceDisplayName(sel);
      const color = SERVICE_PALETTE[idx % SERVICE_PALETTE.length];
      (sel.teeth ?? []).forEach(code => {
        const list = map.get(code) ?? [];
        list.push({ color, label: displayName });
        map.set(code, list);
      });
    });
    return map;
  }, [selections]);

  const totalTeeth = teethMap.size;
  // SVG gradient defs for multi-service teeth — one per multi-hit tooth.
  const multiHits = useMemo(() => {
    return Array.from(teethMap.entries()).filter(([, hits]) => hits.length > 1);
  }, [teethMap]);

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5 text-[#4D8EF7]" />
          <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
            Selected Teeth
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#5A5568] tabular-nums">
          {totalTeeth}{totalTeeth === 1 ? ' tooth' : ' teeth'}
        </span>
      </div>

      {selections.length === 0 ? (
        /* Disabled / dimmed FDI chart with a clear "pick a service" prompt
           overlaid so the user knows the chart is here, just inactive. */
        <div className="flex flex-col items-center">
          <div className="relative select-none opacity-40 pointer-events-none w-full max-w-xs" style={{ aspectRatio: '327 / 555' }}>
            <img
              src="/FDI.svg"
              alt="FDI dental chart"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none grayscale"
              draggable={false}
            />
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFBEB] border border-[#FCD34D] text-[11px] font-semibold text-[#92400E]">
            <Stethoscope className="w-3 h-3" />
            Add a service first
          </div>
          <p className="text-[10px] text-[#A0A0B0] mt-1 text-center max-w-[200px]">
            Pick a service from the Services card, then tap teeth on its chart — they'll show up here colour-coded.
          </p>
        </div>
      ) : (
        <>
          {/* Tooth chart — FDI SVG with per-tooth coloured ellipses overlaid */}
          <div className="flex justify-center">
            <div
              className="relative select-none w-full max-w-xs"
              style={{ aspectRatio: '327 / 555' }}
            >
              {/* Static FDI background */}
              <img
                src="/FDI.svg"
                alt="FDI dental chart"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
              {/* Overlay — coloured ellipse per used tooth */}
              <svg
                viewBox="0 0 327 555"
                className="absolute inset-0 w-full h-full"
              >
                {/* Defs — one linear gradient per multi-service tooth so each
                    service's colour gets an equal horizontal band. */}
                <defs>
                  {multiHits.map(([code, hits]) => {
                    const gid = `agg-grad-${code}`;
                    const stops: React.ReactNode[] = [];
                    hits.forEach((hit, i) => {
                      const start = (i / hits.length) * 100;
                      const end   = ((i + 1) / hits.length) * 100;
                      stops.push(
                        <stop key={`${i}-a`} offset={`${start}%`} stopColor={hit.color} stopOpacity={0.85} />,
                        <stop key={`${i}-b`} offset={`${end}%`}   stopColor={hit.color} stopOpacity={0.85} />,
                      );
                    });
                    return (
                      <linearGradient key={gid} id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
                        {stops}
                      </linearGradient>
                    );
                  })}
                </defs>
                {Object.entries(FDI_TEETH).map(([id, { cx, cy, rx, ry }]) => {
                  const hits = teethMap.get(id);
                  if (!hits) return null;
                  const isMulti = hits.length > 1;
                  const fill = isMulti
                    ? `url(#agg-grad-${id})`
                    : hits[0].color;
                  const stroke = isMulti ? '#030213' : hits[0].color;
                  return (
                    <ellipse
                      key={id}
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      fill={fill}
                      fillOpacity={isMulti ? 1 : 0.65}
                      stroke={stroke}
                      strokeWidth={isMulti ? 1.2 : 1.5}
                      strokeOpacity={isMulti ? 0.6 : 1}
                      style={{ cursor: 'help' }}
                    >
                      <title>
                        {`Tooth ${id} — ${hits.map(h => h.label).join(', ')}`}
                      </title>
                    </ellipse>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Multi-service hint */}
          {multiHits.length > 0 && (
            <p className="text-[10px] text-[#717182] italic text-center mt-2">
              {multiHits.length} {multiHits.length === 1 ? 'tooth is' : 'teeth are'} shared across services — hover to see which.
            </p>
          )}
        </>
      )}

      {/* Legend — colour swatch + service name + tooth count */}
      {selections.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#F0EFF6]">
          <p className="text-[9px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">Legend</p>
          <div className="space-y-1">
            {selections.map((sel, idx) => {
              const name = getServiceDisplayName(sel);
              const color = SERVICE_PALETTE[idx % SERVICE_PALETTE.length];
              const teethCount = sel.teeth?.length ?? 0;
              return (
                <div key={sel.itemId} className="flex items-center gap-1.5 text-[10px]">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10"
                    style={{ background: color, opacity: 0.7 }}
                  />
                  <span className="text-[#030213] font-medium truncate flex-1">{name}</span>
                  <span className="text-[#A0A0B0] tabular-nums flex-shrink-0">{teethCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Patient search select — autocomplete over the practice's patient list ───
// Behaves like a combobox: clicking the input opens a dropdown of every
// existing patient, typing filters the list in real time, and picking a row
// fills both the name AND the extra fields (ID, email, phone, DOB, gender).
// Typing a brand-new name that doesn't match any patient is preserved as a
// free-text entry so the user can register a new patient without clicking
// out of the field.
function PatientSearchSelect({ value, onChange, onPickExisting }: {
  value: string;
  onChange: (v: string) => void;
  onPickExisting: (patient: ExistingPatient) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Filter by name (case-insensitive) OR by Patient ID. If the field is
  // empty we show every patient so a focused field reveals the list.
  const q = value.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return MOCK_PATIENTS;
    return MOCK_PATIENTS.filter(p =>
      p.name.toLowerCase().includes(q) || p.patientId.toLowerCase().includes(q)
    );
  }, [q]);
  // Exact-name match → highlights "this patient already exists" in the trigger.
  const exactMatch = useMemo(
    () => MOCK_PATIENTS.find(p => p.name.toLowerCase() === q),
    [q]
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search existing or type new patient name"
          className="w-full px-3 py-2 pr-7 text-xs text-[#030213] placeholder-[#A0A0B0] border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
        />
        {/* Search icon on the right doubles as the dropdown affordance */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md hover:bg-[#F8F9FC] flex items-center justify-center text-[#A0A0B0]"
          title="Browse existing patients"
        >
          <Search className="w-3 h-3" />
        </button>
      </div>
      {/* Status pills under the input — confirm match state */}
      {value.trim().length > 0 && (
        exactMatch ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#1A5C2A]">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
            {exactMatch.patientId}
          </p>
        ) : (
          <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-[#7C3AED]">
            <Plus className="w-2.5 h-2.5" strokeWidth={3} />
            New patient — will be created on submit
          </p>
        )
      )}
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-[#E8EAF6] rounded-xl shadow-[0_10px_30px_rgba(77,142,247,0.15)] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">
              Existing patients
            </span>
            <span className="text-[10px] font-bold text-[#5A5568] tabular-nums">
              {matches.length}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-[#A0A0B0] italic">No matches for "{value}".</p>
                <p className="text-[10px] text-[#7C3AED] font-semibold mt-1">
                  Press Enter to register them as a new patient.
                </p>
              </div>
            ) : matches.map(p => {
              const isHov = hovered === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    onPickExisting(p);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isHov ? 'bg-[#F5F8FF]' : ''
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center text-[10px] font-bold text-[#4D8EF7] flex-shrink-0">
                    {p.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#030213] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#717182] truncate">
                      {p.patientId} · DOB {p.dob}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#F0EFF6] bg-[#F8F9FC]">
            <p className="text-[10px] text-[#717182]">
              Can't find the patient? Just type their name — they'll be created on submit.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dentist search select — searchable dropdown over the practice roster ───
// Native <select> with 100+ dentists is unusable; this lets the user type
// part of a name to narrow the list. Same pattern as LabSearchSelect.
function DentistSearchSelect({ dentists, value, onChange }: {
  dentists: typeof mockStaffMembers;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  const selected = dentists.find(d => d.id === value) ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dentists;
    // Search by dentist name only — the user is already inside their own
    // clinic so matching by practice name would be misleading.
    return dentists.filter(d => d.name.toLowerCase().includes(q));
  }, [dentists, query]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-left border rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 transition-colors ${
          open ? 'border-[#4D8EF7]' : 'border-[#E0E0E6] hover:border-[#BFDBFE]'
        }`}
      >
        <span className={`truncate ${selected ? 'text-[#030213]' : 'text-[#A0A0B0] italic'}`}>
          {selected?.name || 'Pick a dentist…'}
        </span>
        <ChevronDown className={`w-3 h-3 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-[#E8EAF6] rounded-lg shadow-[0_10px_30px_rgba(77,142,247,0.15)] overflow-hidden">
          <div className="px-2 py-1.5 border-b border-[#F0EFF6] bg-[#F8F9FC]">
            <div className="relative">
              <Search className="w-3 h-3 text-[#A0A0B0] absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dentist…"
                className="w-full pl-6 pr-2 py-1 text-[11px] border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7]"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-[#A0A0B0] italic">No matches.</p>
            ) : visible.map(d => {
              const isSelected = d.id === value;
              return (
                <button
                  key={d.id}
                  onClick={() => { onChange(d.id); setOpen(false); setQuery(''); }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors ${
                    isSelected ? 'bg-[#EEF4FF]' : 'hover:bg-[#FAFBFF]'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center text-[9px] font-bold text-[#4D8EF7] flex-shrink-0">
                    {d.name.split(' ').slice(-1)[0]?.[0] || '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[11px] truncate ${isSelected ? 'font-bold text-[#1565C0]' : 'font-semibold text-[#030213]'}`}>
                      {d.name}
                    </p>
                  </div>
                  {isSelected && <Check className="w-3 h-3 text-[#1565C0] flex-shrink-0" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lab search select — searchable dropdown with Favourites tab ─────────────
// Behaves like a native <select> but with three upgrades:
//   1. Search input filters the list as you type.
//   2. Tabs let the user flip between Favourites and All labs.
//   3. Per-row star toggle persists to localStorage so favourites survive
//      reloads (same key the detailed flow uses).
function LabSearchSelect({ labs, selectedId, onSelect }: {
  labs: typeof mockSuppliers;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('cases.favoriteLabs') || '[]'); } catch { return []; }
  });
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus the search input when the panel opens
  useEffect(() => {
    if (open) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem('cases.favoriteLabs', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const selected = labs.find(l => l.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = labs;
    if (tab === 'favorites') list = list.filter(l => favorites.includes(l.id));
    if (q) list = list.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.country || '').toLowerCase().includes(q) ||
      (l.categories || []).some(c => c.toLowerCase().includes(q))
    );
    return list;
  }, [labs, query, tab, favorites]);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger — mimics a select button but renders the lab's logo + meta */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 text-left border rounded-lg bg-white outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 transition-colors ${
          open ? 'border-[#4D8EF7]' : 'border-[#E0E0E6] hover:border-[#BFDBFE]'
        }`}
      >
        {selected ? (
          <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${selected.avatarColor || 'bg-[#030213] text-white'}`}>
            {selected.initials || selected.name.slice(0, 2).toUpperCase()}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-md bg-[#F3F3F5] flex items-center justify-center flex-shrink-0">
            <FlaskConical className="w-3 h-3 text-[#A0A0B0]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {selected ? (
            <>
              <p className="text-xs font-semibold text-[#030213] truncate leading-tight">{selected.name}</p>
              <p className="text-[10px] text-[#717182] truncate leading-tight">
                {(selected.categories?.slice(0, 3).join(' · ')) || selected.country || ''}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#A0A0B0] italic">Search or pick a lab…</p>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Panel — search + tabs + list */}
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 bg-white border border-[#E8EAF6] rounded-xl shadow-[0_10px_30px_rgba(77,142,247,0.15)] overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2.5 border-b border-[#F0EFF6]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search labs by name, country, category…"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#E0E0E6] rounded-md outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
              />
            </div>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 pt-2 border-b border-[#F0EFF6]">
            {(['all', 'favorites'] as const).map(t => {
              const count = t === 'favorites' ? favorites.length : labs.length;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 -mb-px text-[11px] font-semibold border-b-2 transition-colors ${
                    tab === t
                      ? 'text-[#030213] border-[#030213]'
                      : 'text-[#717182] border-transparent hover:text-[#030213]'
                  }`}
                >
                  {t === 'favorites' ? (
                    <Star className={`w-3 h-3 ${tab === 'favorites' ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#A0A0B0]'}`} />
                  ) : null}
                  {t === 'favorites' ? 'Favourites' : 'All labs'}
                  <span className="ml-0.5 text-[9px] font-bold text-[#A0A0B0] tabular-nums">({count})</span>
                </button>
              );
            })}
          </div>
          {/* List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-[#A0A0B0] italic">
                {tab === 'favorites'
                  ? 'No favourites yet — tap the star next to any lab to add it here.'
                  : query
                    ? `No labs match "${query}".`
                    : 'No labs available.'}
              </p>
            ) : (
              visible.map(lab => {
                const isSelected = lab.id === selectedId;
                const isFav = favorites.includes(lab.id);
                return (
                  <div
                    key={lab.id}
                    className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                      isSelected ? 'bg-[#EEF4FF]' : 'hover:bg-[#FAFBFF]'
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelect(lab.id);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${lab.avatarColor || 'bg-[#030213] text-white'}`}>
                        {lab.initials || lab.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs truncate ${isSelected ? 'font-bold text-[#1565C0]' : 'font-semibold text-[#030213]'}`}>
                          {lab.name}
                        </p>
                        <p className="text-[10px] text-[#717182] truncate">
                          {(lab.categories?.slice(0, 3).join(' · ')) || lab.country || ''}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#1565C0] flex-shrink-0" strokeWidth={3} />
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(lab.id); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[#FEF3C7] transition-colors flex-shrink-0"
                      title={isFav ? 'Remove from favourites' : 'Add to favourites'}
                    >
                      <Star className={`w-3.5 h-3.5 transition-colors ${
                        isFav ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#D1D5DB] hover:text-[#F59E0B]'
                      }`} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3D Model preview modal ──────────────────────────────────────────────────
// Mimics the production viewer — format tabs (3D / PLY / STL / OBJ) on the
// left, view-mode tool dock on the right, dental arch render against a grey
// background. The real product mounts a WebGL viewer; the demo uses the
// teeth-3d.png asset.
function Model3DPreview({ files, onClose }: {
  files: Record<string, string | null>;
  onClose: () => void;
}) {
  const filled = Object.entries(files).filter(([, v]) => !!v) as [string, string][];
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] flex items-center justify-center">
              <Box className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#030213]">3D Model Viewer</h3>
              <p className="text-[11px] text-[#717182]">
                {filled.length} scan file{filled.length === 1 ? '' : 's'} attached
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F3F5] hover:bg-[#E8E8EC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewer canvas — shared with the left-pane 3D tab */}
        <Model3DCanvas className="aspect-[4/3] sm:aspect-[16/9]" />

        {/* File list strip */}
        <div className="px-6 py-3 bg-[#F8F9FC] border-t border-[#F0EFF6] flex-shrink-0">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">Attached scans</p>
          <ScanFileChips filled={filled} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-[#F0EFF6] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-[#5A5568] bg-[#F0EFF6] hover:bg-[#E5E3ED] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── 3D viewer canvas ────────────────────────────────────────────────────────
// Grey stage with format tabs (top-left), tool dock (top-right), the mock
// model render and an orbit hint. Shared between the full-size Model3DPreview
// modal and the compact left-pane "3D Model" tab — the caller controls the
// aspect ratio / framing via className.
function Model3DCanvas({ className }: { className: string }) {
  const [activeFormat, setActiveFormat] = useState<'3D' | 'PLY' | 'STL' | 'OBJ'>('3D');
  const [activeTool, setActiveTool] = useState<'view' | 'measure' | 'paint'>('view');
  return (
    <div className={`relative bg-[#BFC4CC] ${className}`}>
      {/* Format tabs (top-left) */}
      <div className="absolute top-3 left-3 flex items-center gap-0.5 bg-white rounded-lg shadow-sm p-1 z-10">
        {(['3D', 'PLY', 'STL', 'OBJ'] as const).map(fmt => (
          <button
            key={fmt}
            onClick={() => setActiveFormat(fmt)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
              activeFormat === fmt
                ? 'text-[#4D8EF7]'
                : 'text-[#5A5568] hover:bg-[#F8F9FC]'
            }`}
          >
            {fmt}
          </button>
        ))}
      </div>
      {/* Tool dock (top-right) */}
      <div className="absolute top-3 right-3 flex items-center gap-0 bg-[#1F2937] rounded-lg shadow-lg p-1 z-10">
        {(
          [
            { id: 'view',    label: 'Orbit',   icon: <Box className="w-3.5 h-3.5" /> },
            { id: 'measure', label: 'Measure', icon: <Pencil className="w-3.5 h-3.5" /> },
            { id: 'paint',   label: 'Paint',   icon: <FlaskConical className="w-3.5 h-3.5" /> },
          ] as const
        ).map((tool, i) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            title={tool.label}
            className={`relative w-8 h-8 rounded-md flex items-center justify-center text-white transition-colors ${
              activeTool === tool.id
                ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]'
                : 'hover:bg-white/10'
            } ${i > 0 ? 'border-l border-white/10' : ''}`}
          >
            {tool.icon}
          </button>
        ))}
      </div>
      {/* Model render */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src="/teeth-3d.png"
          alt="3D dental model"
          className="max-w-[70%] max-h-[80%] object-contain drop-shadow-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      {/* Bottom hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[10px] font-medium text-white whitespace-nowrap">
        <Box className="w-3 h-3" />
        Drag to orbit · scroll to zoom
      </div>
    </div>
  );
}

// Attached-scan chips list — shared by the 3D modal's file strip and the
// left-pane 3D tab.
function ScanFileChips({ filled }: { filled: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {filled.length === 0 ? (
        <span className="text-[11px] italic text-[#A0A0B0]">No scan files attached yet.</span>
      ) : filled.map(([slot, name]) => (
        <span key={slot} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-[#BBF7D0] text-[10px]">
          <Check className="w-2.5 h-2.5 text-[#16A34A]" strokeWidth={3} />
          <span className="font-semibold text-[#030213]">{slot}</span>
          <span className="text-[#717182] font-mono">·</span>
          <span className="text-[#717182] font-mono">{name}</span>
        </span>
      ))}
    </div>
  );
}

// ─── 3D model pane ───────────────────────────────────────────────────────────
// "3D Model" tab of the left preview pane. With scan files attached it shows
// the shared viewer canvas + the file list; with none it nudges the user to
// upload via the Case Source popup (onUploadScans opens it).
function Model3DPane({ files, onUploadScans }: {
  files: Record<string, string | null>;
  onUploadScans: () => void;
}) {
  const filled = Object.entries(files).filter(([, v]) => !!v) as [string, string][];
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Pane title */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#F3EEFF] flex items-center justify-center">
          <Box className="w-3.5 h-3.5 text-[#7C3AED]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">3D Model</p>
          <p className="text-[10px] text-[#717182] leading-tight truncate">
            {filled.length > 0
              ? `${filled.length} scan file${filled.length === 1 ? '' : 's'} attached`
              : 'No scan files yet'}
          </p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filled.length === 0 ? (
          <>
            {/* Empty state — same dashed-CTA chrome as the Rx upload pane */}
            <button
              type="button"
              onClick={onUploadScans}
              className="w-full bg-gradient-to-br from-[#F5F8FF] to-[#F3EEFF] border-2 border-dashed border-[#C8D8FC] hover:border-[#7C3AED] hover:bg-[#EEF4FF] rounded-xl p-5 text-center transition-all"
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white shadow-sm border border-[#E0E0E6] flex items-center justify-center mb-3">
                <Box className="w-6 h-6 text-[#7C3AED]" />
              </div>
              <p className="text-sm font-bold text-[#030213] leading-tight">No scans to render yet</p>
              <p className="text-[11px] text-[#5A5568] leading-snug mt-1">
                Attach Upper / Lower arch and bite scans via Case Source and the 3D model shows up here.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#4D8EF7]">
                <Upload className="w-3 h-3" />
                Upload scan files
              </span>
            </button>
            <div className="text-[10px] text-[#717182] text-center leading-relaxed px-2 py-1">
              Sent from a scanner? Files land here automatically
              <br />
              once the case source is connected.
            </div>
          </>
        ) : (
          <>
            <Model3DCanvas className="aspect-square rounded-xl overflow-hidden border border-[#E0E0E6]" />
            <div>
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">Attached scans</p>
              <ScanFileChips filled={filled} />
            </div>
            <button
              type="button"
              onClick={onUploadScans}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold text-[#7C3AED] border border-dashed border-[#C8D8FC] bg-white hover:border-[#7C3AED] hover:bg-[#F5F8FF] transition-colors"
            >
              <Upload className="w-3 h-3" />
              Manage scan files
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Every field the lab order form snapshot needs — shared by the modal
// (small screens) and the left pane's "Order Form" tab (md+).
type OrderFormData = {
  patientName: string;
  patientExtras: PatientExtras;
  lab: typeof mockSuppliers[number] | null;
  dentist: typeof mockStaffMembers[number] | null;
  orderType: string;
  deliveryDate: string;
  caseSource: string;
  caseSourceFiles: Record<string, string | null>;
  caseSourceExtraFiles: string[];
  caseSourceScanner: string;
  caseSourceCourier: string;
  selections: ServiceSelection[];
  notes: string;
};

// ─── Order form pane ─────────────────────────────────────────────────────────
// "Order Form" tab of the left preview pane — the same compiled snapshot the
// OrderFormPreview modal shows, rendered compact. Reads straight from form
// state so it updates live as the user types.
function OrderFormPane(props: OrderFormData) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Pane title */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#F0EFF6] bg-[#F8F9FC] flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-[#1565C0]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#030213] uppercase tracking-wider leading-tight">Order form</p>
          <p className="text-[10px] text-[#717182] leading-tight truncate">What the lab will receive</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <OrderFormSheet {...props} compact />
        <div className="text-[10px] text-[#717182] text-center leading-relaxed px-2 py-1">
          Updates live as you fill the form on the right.
        </div>
      </div>
    </div>
  );
}

// ─── Order Form preview modal ────────────────────────────────────────────────
// Read-only printable snapshot of every field the user has filled in. Mirrors
// what the lab will see in the order form once the case is submitted.
function OrderFormPreview({ onClose, ...data }: OrderFormData & { onClose: () => void }) {
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#030213]">Order Form Preview</h3>
              <p className="text-[11px] text-[#717182]">Snapshot of what the lab will receive</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-[#F3F3F5] hover:bg-[#E8E8EC] flex items-center justify-center text-[#717182]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-[#F8F9FC]">
          <OrderFormSheet {...data} />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#F0EFF6] flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-[#5A5568] bg-[#F0EFF6] hover:bg-[#E5E3ED] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

// ─── Order form sheet ────────────────────────────────────────────────────────
// The white "Lab Order Form" card itself — compiled from live form state and
// shared by the modal (full-size) and the left pane tab (`compact`, which
// tightens padding + collapses the grids for the 380px column).
function OrderFormSheet({
  patientName, patientExtras,
  lab, dentist,
  orderType, deliveryDate,
  caseSource, caseSourceFiles, caseSourceExtraFiles, caseSourceScanner, caseSourceCourier,
  selections, notes,
  compact = false,
}: OrderFormData & { compact?: boolean }) {
  const fileCount = Object.values(caseSourceFiles).filter(Boolean).length + caseSourceExtraFiles.length;
  return (
          <div className={`bg-white border border-[#E0E0E6] rounded-2xl shadow-sm ${compact ? 'p-4 space-y-4' : 'p-6 space-y-5'}`}>
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#F0EFF6]">
              <div>
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Smile Genius</p>
                <h4 className={`${compact ? 'text-base' : 'text-lg'} font-bold text-[#030213] mt-0.5`}>Lab Order Form</h4>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                orderType === 'NHS' ? 'bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]' : 'bg-[#F0FDF4] text-[#1A5C2A] border border-[#BBF7D0]'
              }`}>
                {orderType}
              </span>
            </div>

            {/* Patient + Lab + Dentist grid */}
            <div className={compact ? 'grid grid-cols-2 gap-3 text-sm' : 'grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm'}>
              <FormField label="Patient" value={patientName || '—'} />
              <FormField label="Lab" value={lab?.name || '—'} />
              <FormField label="Dentist" value={dentist?.name || '—'} />
              <FormField label="Requested Delivery" value={deliveryDate || '—'} />
              <FormField
                label="Case Source"
                value={
                  caseSource === 'Via Scanner' && caseSourceScanner
                    ? `Via Scanner — ${caseSourceScanner}`
                    : caseSource === 'Impressions (By Post)' && caseSourceCourier
                      ? `Impressions (By Post) — ${caseSourceCourier}`
                      : caseSource
                }
                sub={fileCount > 0 ? `${fileCount} file${fileCount === 1 ? '' : 's'} attached` : 'No files attached'}
              />
              <FormField label="Order Type" value={orderType} />
            </div>

            {/* Patient extras */}
            {(patientExtras.email || patientExtras.phoneNumber || patientExtras.dob || patientExtras.patientId) && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-2">Patient Details</p>
                <div className={`${compact ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-3'} text-xs text-[#5A5568]`}>
                  {patientExtras.patientId && <div><span className="font-semibold text-[#030213]">ID:</span> {patientExtras.patientId}</div>}
                  {patientExtras.email && <div><span className="font-semibold text-[#030213]">Email:</span> {patientExtras.email}</div>}
                  {patientExtras.phoneNumber && <div><span className="font-semibold text-[#030213]">Phone:</span> {patientExtras.phoneCountry} {patientExtras.phoneNumber}</div>}
                  {patientExtras.dob && <div><span className="font-semibold text-[#030213]">DOB:</span> {patientExtras.dob}</div>}
                </div>
              </div>
            )}

            {/* Services */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-2">
                Services ({selections.length})
              </p>
              {selections.length === 0 ? (
                <p className="text-xs italic text-[#A0A0B0]">No services added yet.</p>
              ) : (
                <div className="space-y-2">
                  {selections.map(sel => {
                    const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === sel.itemId);
                    if (!item) return null;
                    const teethCount = sel.teeth?.length ?? 0;
                    const cat = getCategoryForItem(sel.itemId);
                    const displayName = getServiceDisplayName(sel);
                    return (
                      <div key={sel.itemId} className="bg-[#FAFBFF] border border-[#E8EAF6] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-xs font-bold text-[#030213] truncate">{displayName}</p>
                          <span className="text-[9px] text-[#A0A0B0] uppercase tracking-wider font-semibold">{cat}</span>
                        </div>
                        <div className={`${compact ? 'grid grid-cols-2' : 'grid grid-cols-2 sm:grid-cols-3'} gap-1.5 text-[10px] text-[#5A5568]`}>
                          {sel.material && <span><span className="text-[#A0A0B0]">Material:</span> {sel.material}</span>}
                          {sel.shade && <span><span className="text-[#A0A0B0]">Shade:</span> {sel.shade}</span>}
                          {teethCount > 0 && <span><span className="text-[#A0A0B0]">Teeth:</span> {teethCount}</span>}
                          {sel.brand && <span><span className="text-[#A0A0B0]">Brand:</span> {sel.brand}</span>}
                          {sel.abutmentMaterial && <span><span className="text-[#A0A0B0]">Abutment:</span> {sel.abutmentMaterial}</span>}
                          {sel.retainerType && <span><span className="text-[#A0A0B0]">Retainer:</span> {sel.retainerType}</span>}
                          {sel.applianceOption && <span><span className="text-[#A0A0B0]">Type:</span> {sel.applianceOption}</span>}
                          {(sel.stages?.length ?? 0) > 0 && <span><span className="text-[#A0A0B0]">Stage:</span> {sel.stages!.join(', ')}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            {notes.trim() && (
              <div className="pt-2 border-t border-[#F0EFF6]">
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1">Notes for the lab</p>
                <p className="text-xs text-[#030213] whitespace-pre-line">{notes}</p>
              </div>
            )}
          </div>
  );
}

// Small data display row for the Order Form preview.
function FormField({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-[#030213] truncate">{value}</p>
      {sub && <p className="text-[10px] text-[#717182] truncate">{sub}</p>}
    </div>
  );
}

// Suppress unused warning on the icon import — kept for parity with the
// detailed flow's drawer header palette in case scans get added here later.
void ImageIcon;
void Calendar;
