import { useMemo, useState } from 'react';
import {
  User, Mail, Phone, Calendar, ChevronDown, ChevronRight, ChevronUp,
  UserPlus, Filter, Search, Star, FileText, Image as ImageIcon,
  ArrowLeft, ArrowRight, Pencil, X, Check,
  FlaskConical, Stethoscope, Plus,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import ModalPortal from '../components/ModalPortal';
import { mockSuppliers } from '../data/suppliersData';
import { mockStaffMembers } from '../data/clinicsData';

// ─── Create Case — 3-step wizard ─────────────────────────────────────────────
// Mirrors the production flow the clinic team is already using:
//   Step 1 · Patient Details   — name, ID, contact, DOB, gender, with an
//            "Existing Patient" hook for picking a saved record (placeholder).
//   Step 2 · Lab Selection      — searchable lab grid with Favorites tab,
//            persistent favourites in localStorage so the demo feels real.
//   Step 3 · Service Details    — 3-column layout: dentist + service catalogue
//            on the left, tooth chart in the centre, send-to + case source +
//            order summary on the right. The service catalogue is scaffolded
//            with placeholder categories that we'll deepen out together.
//
// On Submit the form toasts success and returns to the Cases list — no
// persistence yet (mockCases is the source of truth); we'll wire backing
// state when the data layer is decided.

// ── Step 1 types ─────────────────────────────────────────────────────────────
type Gender = '' | 'male' | 'female' | 'other' | 'prefer-not';
interface PatientForm {
  name: string;
  patientId: string;
  email: string;
  phoneCountry: string;
  phoneNumber: string;
  dob: string;           // ISO yyyy-mm-dd
  gender: Gender;
}
const EMPTY_PATIENT: PatientForm = {
  name: '', patientId: '', email: '',
  phoneCountry: '+44', phoneNumber: '',
  dob: '', gender: '',
};
const COUNTRY_CODES = ['+44', '+1', '+91', '+92', '+61', '+353', '+49', '+33', '+34', '+39'];
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: '',            label: 'Select Gender' },
  { value: 'male',        label: 'Male' },
  { value: 'female',      label: 'Female' },
  { value: 'other',       label: 'Other' },
  { value: 'prefer-not',  label: 'Prefer not to say' },
];

// ── Step 3 service catalogue ─────────────────────────────────────────────────
// Each category exposes its production-flow types. IDs are namespaced per
// category so e.g. Single Unit > Crown and Bridge > Abutment never collide.
export interface ServiceItem { id: string; label: string }
export interface ServiceCategory { id: string; label: string; items: ServiceItem[] }
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: 'single-unit', label: 'Single Unit', items: [
    { id: 'su-post-and-core-retained-crown', label: 'Post and Core Retained Crown' },
    { id: 'su-screw-retained-crown',          label: 'Screw Retained Crown' },
    { id: 'su-implant-abutment',              label: 'Implant Abutment' },
    { id: 'su-inlay-onlay',                   label: 'Inlay/Onlay' },
    { id: 'su-veneer',                        label: 'Veneer' },
    { id: 'su-crown',                         label: 'Crown' },
  ]},
  { id: 'bridge', label: 'Bridge', items: [
    { id: 'br-post-and-core-retained', label: 'Post and Core Retained' },
    { id: 'br-implant-abutment',        label: 'Implant Abutment' },
    { id: 'br-screw-retained',          label: 'Screw Retained' },
    { id: 'br-pontic',                  label: 'Pontic' },
    { id: 'br-abutment',                label: 'Abutment' },
  ]},
  { id: 'orthodontics', label: 'Orthodontics', items: [
    { id: 'or-retainers',       label: 'Retainers' },
    { id: 'or-clear-aligners',  label: 'Clear Aligners' },
  ]},
  { id: 'denture', label: 'Denture', items: [
    { id: 'de-partial-denture',    label: 'Partial Denture' },
    { id: 'de-full-denture',       label: 'Full Denture' },
    { id: 'de-immediate-denture',  label: 'Immediate Denture' },
  ]},
  { id: 'appliances', label: 'Appliances', items: [
    { id: 'ap-whitening-tray', label: 'Whitening Tray' },
    { id: 'ap-night-guard',    label: 'Night Guard' },
    { id: 'ap-splint',         label: 'Splint' },
  ]},
  { id: 'others', label: 'Others', items: [
    { id: 'ot-other', label: 'Other' },
  ]},
];

// ── Per-selection field option lists ─────────────────────────────────────────
// Placeholder vocabularies modelled on the production flow. The user will
// guide refinements (e.g. nominal-code-driven order types tied to the clinic's
// spend settings) — these stay in the file so they're easy to swap.
// Order Type is the patient billing classification on the lab order — NHS
// (public-funded) or Private — not a turnaround/priority tier.
export const ORDER_TYPES = ['NHS', 'Private'];
export const MATERIAL_TYPES = [
  'Zirconia',
  'Lithium Disilicate (e.max)',
  'Porcelain Fused to Metal (PFM)',
  'Full Cast Metal',
  'Composite Resin',
  'Acrylic',
];
export const TOOTH_SHADES = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4',
  'BL1', 'BL2', 'BL3', 'BL4',
];

// Case Source — how the case data reached the lab. Surfaced as a popup in
// the Quick flow because each method can come with optional file uploads
// (intra-oral scans, impression photos, bite registration, etc.).
export const CASE_SOURCES = [
  'Via Scanner',
  'Impressions (By Post)',
  'SMS',
  'Whatsapp',
  'Email',
  'Other',
];

// Named file slots the Case Source popup exposes. Every slot is optional.
export const CASE_SOURCE_UPLOAD_SLOTS = [
  'Upper Arch',
  'Lower Arch',
  'Bite Scan',
  'Bite Scan 2',
];

// Common intra-oral scanner brands. Surfaced when Case Source = Via Scanner
// so the lab knows which device the STL/PLY files came from. The last entry
// "Other" lets clinics type a custom name when their scanner isn't listed.
export const SCANNER_BRANDS = [
  '3Shape',
  'iTero',
  'Medit',
  'Carestream',
  'Sirona (Cerec)',
  'Planmeca',
  'Shining 3D',
  'DentalWings',
];

// Courier choices when Case Source = Impressions (By Post). Same pattern
// as SCANNER_BRANDS — clinics pick one OR specify "Other" with a name.
export const IMPRESSION_COURIERS = [
  'Royal Mail',
  'DHL',  // user typed "DHS" — assuming DHL; flip back if a different courier is intended
];

// ── Bridge-specific catalogues ───────────────────────────────────────────────
// Implant manufacturer brands. Sourced from the production order form so the
// list stays canonical. The dropdown lets the clinic match the lab's stock —
// brand is required for Bridge services.
export const IMPLANT_BRANDS = [
  'Adin', 'Alfa Gate', 'Alliance', 'Alpha Bio Tec', 'Anthogyr', 'Argon',
  'Avinent', 'B&B Dental', 'Bego', 'Bicon', 'BioComp', 'Biodenta',
  'BioHorizons', 'BIOMET 3i', 'Biotech Dental', 'bredent', 'BTI', 'CAMLOG',
  'Conexao', 'Coretex', 'Cowellmedi', 'C-Tech', 'Dentegis', 'Dentium',
  'DENTSPLY Implants', 'DIO', 'Dyna', 'Euroteknika', 'FMZ', 'GC', 'Geass',
  'Global D', 'Hahn', 'IDI Evolution', 'Implant Direct',
  'Implants Diffusion International', 'Inclusive', 'Intra-Lock', 'IRES',
  'JDental Care', 'Keystone', 'Kyocera', 'Lasak', 'Leone',
  'Little Implant Co.', 'Medentika', 'medentis medical', 'MEGAGEN', 'MIS',
  'NA', 'NEODENT', 'Neoss', 'Nobel Biocare', 'Osstem', 'Paltop', 'Phibo',
  'Ritter Implants', 'Schuetz Dental', 'SDS', 'SIN', 'Singular Implants',
  'Southern Implants', 'Straumann', 'Sweden&Martina', 'Tekka',
  'Thommen Medical', 'TRI', 'URIS', 'Warantec', 'Whitek', 'Zimmer Dental',
  'Z-systems', 'Zuga Medical',
];

// Implant abutment material — Bridge-specific. Different palette from the
// generic crown materials (MATERIAL_TYPES) because the abutment is the
// titanium / zirconia core under the prosthesis.
export const IMPLANT_ABUTMENT_MATERIALS = [
  'Chrome Cobalt',
  'Titanium',
  'Zirconia',
  'Zirconia with Ti-base',
];

// ── Orthodontics ─────────────────────────────────────────────────────────────
// Retainer Type: clinic picks one of three. Essix is thermoformed clear,
// Bonded is fixed lingual wire, Hawley is the acrylic-and-wire classic.
export const RETAINER_TYPES = ['Essix', 'Bonded', 'Hawley'];

// Occlusion → standard Angle's classification used for both the dental
// relationship and the skeletal/dental subclasses surfaced in the drawer.
export const OCCLUSION_CLASSES = ['Class I', 'Class II', 'Class III'];

// Side the occlusion finding applies to.
export const OCCLUSION_SIDES = ['Left', 'Right', 'Both', 'N/A'];

// ── Denture ─────────────────────────────────────────────────────────────────
// Stage of fabrication this case sits at. Multi-select because a single case
// often covers more than one stage (e.g. impression + try-in).
export const DENTURE_STAGES = [
  'Special Tray',
  'Bite Registration',
  'Try In',
  'Finish',
];

// ── Appliances ──────────────────────────────────────────────────────────────
// Per-item choice — different appliances ask for different things, but each
// is a single-select radio of three (or two) options.
export const APPLIANCE_WHITENING_RESERVOIRS = ['Yes', 'No'];
export const APPLIANCE_NIGHT_GUARD_TYPES = ['Hard', 'Soft', 'Dual-Laminate'];
export const APPLIANCE_SPLINT_TYPES = ['Michigan', 'Tanner', 'Other'];

// Lookup helper — pulls the right per-item config for an Appliance service.
// Returns the label that should appear in the drawer + the radio options.
export function getApplianceConfig(itemId: string): { label: string; options: string[] } | null {
  if (itemId === 'ap-whitening-tray') return { label: 'Reservoirs',  options: APPLIANCE_WHITENING_RESERVOIRS };
  if (itemId === 'ap-night-guard')    return { label: 'Type',        options: APPLIANCE_NIGHT_GUARD_TYPES };
  if (itemId === 'ap-splint')         return { label: 'Type',        options: APPLIANCE_SPLINT_TYPES };
  return null;
}

// Look up the category id for a service item id — handy when the per-service
// drawer needs to render category-specific fields (Bridge → Brand, etc.).
export function getCategoryForItem(itemId: string): string | null {
  for (const cat of SERVICE_CATEGORIES) {
    if (cat.items.find(i => i.id === itemId)) return cat.id;
  }
  return null;
}

// ── Per-service-selection shape ──────────────────────────────────────────────
// One of these is created when the clinic ticks a service in the catalogue.
// All fields except itemId are optional until the user fills them in.
export type DetailSection = 'order' | 'teeth' | 'material' | 'shade' | 'additional';
export interface ServiceSelection {
  itemId: string;
  orderType?: string;
  requestedDelivery?: string;  // ISO yyyy-mm-dd
  teeth?: string[];            // FDI codes — UR1, UL3, LL6 etc.
  material?: string;
  shade?: string;
  additional?: string;
  // Per-tooth material + shade. Only populated when the user has unlocked
  // "Same for all teeth" — until then the top-level material/shade apply.
  sameForAllTeeth?: boolean;   // default true; user can toggle off to spec per tooth
  perTooth?: Record<string, { material?: string; shade?: string }>;
  // Bridge-specific fields — captured only when the service belongs to the
  // 'bridge' category. Stay optional on the type so other categories don't
  // have to carry them.
  brand?: string;              // implant manufacturer (Straumann, Nobel, …)
  abutmentMaterial?: string;   // Chrome Cobalt / Titanium / Zirconia / Zirconia with Ti-base
  // Orthodontics-specific
  retainerType?: string;       // Essix / Bonded / Hawley
  anglesClass?: string;        // Angle's Class I / II / III
  anglesSide?: string;         // Left / Right / Both / N/A
  skeletalClass?: string;
  skeletalSide?: string;
  dentalClass?: string;
  dentalSide?: string;
  // Denture-specific
  stages?: string[];           // multi-select: Special Tray, Bite Reg., Try In, Finish
  // Appliances — per item:
  //   Whitening Tray → Reservoirs (Yes/No)
  //   Night Guard    → Type (Hard/Soft/Dual-Laminate)
  //   Splint         → Type (Michigan/Tanner/Other)
  applianceOption?: string;
  // Others — user-typed service name (the catalogue item is just a placeholder)
  customServiceName?: string;
  openSection?: DetailSection | null;  // which detail accordion is open
  expanded?: boolean;          // whether the detail card is open at all
}

// ISO-2 → readable country name for the lab cards. Covers the countries the
// supplier directory uses today; falls back to the raw code for unknowns.
const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  IE: 'Ireland',
  US: 'United States',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  DK: 'Denmark',
  LI: 'Liechtenstein',
  KR: 'South Korea',
  CH: 'Switzerland',
  NL: 'Netherlands',
  SE: 'Sweden',
};

// ─── Component ───────────────────────────────────────────────────────────────
// Single-page case creation with a top stepper. Patient / Lab / Service render
// as separate panes — only the active step is mounted so the form never needs
// to scroll within itself — but the right-hand Case Summary card aggregates
// every selection in real time so the user never loses sight of what they've
// built so far. Steps can be jumped to freely; the stepper highlights the
// current step plus completion state of the others, and the primary Submit
// CTA lives inside the Case Summary card the way "Payment Now" does in the
// checkout reference.
type StepId = 'patient' | 'lab' | 'service';

export default function CreateCasePage({ onCancel, onSubmitted, onUseQuick }: {
  onCancel: () => void;
  onSubmitted: () => void;
  onUseQuick?: () => void;
}) {
  const { toast } = useToast();

  // ── Form state ──
  const [patient, setPatient] = useState<PatientForm>(EMPTY_PATIENT);
  const [labId, setLabId]     = useState<string | null>(null);
  const [dentistId, setDentistId] = useState<string>('');
  const [selections, setSelections] = useState<ServiceSelection[]>([]);
  const [caseSource, setCaseSource] = useState<string>('');
  const [caseInstructions, setCaseInstructions] = useState<string>('');
  // Case-level order metadata — applied to every service in the case so the
  // user doesn't have to repeat it per item.
  const [caseOrderType, setCaseOrderType] = useState<string>('');
  const [caseDeliveryDate, setCaseDeliveryDate] = useState<string>('');

  // Active stepper pane — start at Patient. Free navigation: each step is
  // clickable in the stepper bar, so users can revisit earlier panes without
  // a wizard's forced linear flow.
  const [activeStep, setActiveStep] = useState<StepId>('patient');
  const STEP_ORDER: StepId[] = ['patient', 'lab', 'service'];
  const currentIdx = STEP_ORDER.indexOf(activeStep);
  const goPrev = () => currentIdx > 0 && setActiveStep(STEP_ORDER[currentIdx - 1]);
  const goNext = () => currentIdx < STEP_ORDER.length - 1 && setActiveStep(STEP_ORDER[currentIdx + 1]);

  // Service picker modal — opened from the empty state on the Service step or
  // from the "+ Add another service" button in the Case Summary card. Adds
  // the picked service to selections and makes it the active editor target.
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  // ── Selection helpers used by Service Details ──
  function toggleSelection(itemId: string) {
    setSelections(prev => {
      const exists = prev.find(s => s.itemId === itemId);
      if (exists) return prev.filter(s => s.itemId !== itemId);
      // Collapse any previously-expanded item — only one detail card stays
      // open at a time so the catalogue doesn't become a wall of text.
      const collapsed = prev.map(s => ({ ...s, expanded: false }));
      return [...collapsed, { itemId, expanded: true, openSection: 'order' }];
    });
  }
  function updateSelection(itemId: string, patch: Partial<ServiceSelection>) {
    setSelections(prev => prev.map(s => s.itemId === itemId ? { ...s, ...patch } : s));
  }
  function toggleExpanded(itemId: string) {
    setSelections(prev => prev.map(s =>
      s.itemId === itemId
        ? { ...s, expanded: !s.expanded }
        // Collapse siblings when expanding a new one.
        : (s.expanded && prev.find(x => x.itemId === itemId)?.expanded === false ? { ...s, expanded: false } : s)
    ));
  }
  function setOpenSection(itemId: string, section: DetailSection | null) {
    setSelections(prev => prev.map(s =>
      s.itemId === itemId ? { ...s, openSection: section } : s
    ));
  }
  // Make a selection the active editor target (expands it, collapses all
  // siblings). Used when the user clicks a service chip in the Case Summary.
  function setActiveService(itemId: string) {
    setSelections(prev => prev.map(s => ({ ...s, expanded: s.itemId === itemId })));
  }

  // Lab data — same supplier directory the DSO sees. The clinic books against
  // any supplier on the platform (no clinic-side gating yet), so we keep the
  // full list rather than filtering by a category that doesn't exist in mock.
  const allLabs = useMemo(() => mockSuppliers, []);
  const selectedLab = useMemo(
    () => allLabs.find(l => l.id === labId) ?? null,
    [allLabs, labId]
  );
  // Dentist resolution for the Case Summary card.
  const selectedDentist = useMemo(
    () => mockStaffMembers.find(d => d.id === dentistId && d.staffType === 'Dentist') ?? null,
    [dentistId]
  );

  // Per-section completion gates — drives the right-rail progress card,
  // the section header badges, and the Submit button's enabled state.
  const patientDone = patient.name.trim().length > 0;
  const labDone     = !!labId;
  const serviceDone = !!dentistId && !!caseSource && !!caseOrderType && selections.length > 0;
  const sectionsDone = [patientDone, labDone, serviceDone].filter(Boolean).length;
  const allDone = sectionsDone === 3;

  // Missing-fields helper for the Submit toast — nudges the user to the
  // first incomplete step rather than failing silently.
  function firstMissing(): { step: StepId; label: string } | null {
    if (!patientDone) return { step: 'patient', label: 'Add the patient name' };
    if (!labDone)     return { step: 'lab',     label: 'Pick a lab' };
    if (!serviceDone) return { step: 'service', label: 'Pick a dentist, order type, case source, and at least one service' };
    return null;
  }

  function handleSubmit() {
    const miss = firstMissing();
    if (miss) {
      toast.error(miss.label);
      setActiveStep(miss.step);
      return;
    }
    toast.success(`Case created for ${patient.name}`);
    onSubmitted();
  }
  function handleSaveDraft() {
    toast.success('Draft saved');
  }

  // Stepper metadata — labels + icons + completion flag for the top bar.
  const STEPS: { id: StepId; label: string; subtitle: string; icon: React.ReactNode; done: boolean }[] = [
    { id: 'patient', label: 'Patient Details', subtitle: 'Who the case is for',           icon: <User className="w-3.5 h-3.5" />,        done: patientDone },
    { id: 'lab',     label: 'Lab Selection',   subtitle: 'Pick the fulfilling lab',        icon: <FlaskConical className="w-3.5 h-3.5" />, done: labDone },
    { id: 'service', label: 'Service Details', subtitle: 'Dentist, services, materials',   icon: <Stethoscope className="w-3.5 h-3.5" />,  done: serviceDone },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FC] overflow-hidden">
      {/* Full-screen top bar — replaces the Layout's sidebar + top bar so the
          detailed flow gets the same edge-to-edge canvas as Quick Create. */}
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#F3EEFF] text-[#5B21B6] border-[#DDD6FE]">
            Detailed
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

      <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Body — no top stepper bar; the Case Summary on the right doubles as
          the step progress indicator with numbered rows. */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 pb-28">
        {/* Page header — title only. Case Instructions now lives inside the
            Case Summary panel on the right so the right rail is the single
            "everything you've selected" surface. */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-1">Create Case</h1>
            <p className="text-sm text-[#717182] flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              {STEPS[currentIdx].label} — {STEPS[currentIdx].subtitle.toLowerCase()}.
            </p>
          </div>
          {onUseQuick && (
            <button
              onClick={onUseQuick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-white hover:text-[#030213] transition-colors"
            >
              Use quick flow
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Two-column body — sticky Case Summary on the left, active form pane on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 max-w-[1400px]">
          {/* Right column — only the active step's pane is mounted. Rendered
              second in JSX so the order matches visual placement on lg+. */}
          <div className="min-w-0 lg:order-2">
            {activeStep === 'patient' && (
              <PatientDetailsStep
                value={patient}
                onChange={setPatient}
                onPickExisting={() => toast.success('Existing patient picker coming soon')}
              />
            )}
            {activeStep === 'lab' && (
              <LabSelectionStep
                labs={allLabs}
                selectedId={labId}
                onSelect={setLabId}
              />
            )}
            {activeStep === 'service' && (
              selectedLab ? (
                <ServiceDetailsStep
                  dentistId={dentistId}
                  onDentistChange={setDentistId}
                  caseOrderType={caseOrderType}
                  onCaseOrderTypeChange={setCaseOrderType}
                  caseDeliveryDate={caseDeliveryDate}
                  onCaseDeliveryDateChange={setCaseDeliveryDate}
                  selections={selections}
                  onUpdateSelection={updateSelection}
                  onOpenServicePicker={() => setServicePickerOpen(true)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-[#D4CEE1] py-10 px-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[#F8F9FC] border border-[#E0E0E6] flex items-center justify-center mx-auto mb-3">
                    <FlaskConical className="w-5 h-5 text-[#A0A0B0]" />
                  </div>
                  <p className="text-sm font-semibold text-[#030213] mb-1">Pick a lab first</p>
                  <p className="text-xs text-[#717182] mb-3 max-w-sm mx-auto">
                    Services, materials, and order details depend on the lab's catalogue. Jump back to Lab Selection to choose one.
                  </p>
                  <button
                    onClick={() => setActiveStep('lab')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4D8EF7] hover:text-[#1565C0]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Go to Lab Selection
                  </button>
                </div>
              )
            )}
          </div>

          {/* Left column — sticky Case Summary card with Submit. Also
              doubles as the step progress indicator: the three top rows
              (Patient · Lab · Dentist/Services) carry numbered badges + a
              status sub-label, and clicking a row jumps to that step. */}
          <aside className="lg:sticky lg:top-6 lg:self-start lg:order-1">
            <CaseSummaryCard
              patientName={patient.name}
              patientDone={patientDone}
              lab={selectedLab}
              labDone={labDone}
              dentistName={selectedDentist?.name}
              dentistPractice={selectedDentist?.practiceName}
              serviceDone={serviceDone}
              activeStep={activeStep}
              caseSource={caseSource}
              onCaseSourceChange={setCaseSource}
              caseInstructions={caseInstructions}
              onCaseInstructionsChange={setCaseInstructions}
              selections={selections}
              onRemoveSelection={toggleSelection}
              onActivateSelection={setActiveService}
              onAddAnotherService={() => {
                setActiveStep('service');
                setServicePickerOpen(true);
              }}
              onScrollToPatient={() => setActiveStep('patient')}
              onScrollToLab={() => setActiveStep('lab')}
              onScrollToService={() => setActiveStep('service')}
              sectionsDone={sectionsDone}
              allDone={allDone}
              onSubmit={handleSubmit}
            />
          </aside>
        </div>
      </div>

      {/* Service picker — right-side drawer lives at the page level so both
          the Service step empty state and the Case Summary "+ Add another"
          button share it. The drawer stays open between picks so the user can
          stack multiple services in one go; Done closes it. */}
      {servicePickerOpen && (
        <ServicePickerModal
          selectedIds={selections.map(s => s.itemId)}
          onClose={() => setServicePickerOpen(false)}
          onPick={(itemId) => {
            // Add the service + make it active. Drawer stays open so the
            // user can keep adding others in the same session.
            const exists = selections.find(s => s.itemId === itemId);
            if (!exists) {
              toggleSelection(itemId);
            } else {
              setActiveService(itemId);
            }
          }}
        />
      )}

      {/* Sticky footer — Cancel + Save Draft on the left, Previous + Next on
          the right. Submit lives inside the Case Summary card and stays
          enabled whenever every section is complete. */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-[#E0E0E6] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 z-30 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#F0EFF6] text-[#5A5568] hover:bg-[#E5E3ED] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F8F9FC] transition-colors"
          >
            <FileText className="w-4 h-4" />
            Save as draft
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>
          {currentIdx < STEP_ORDER.length - 1 ? (
            <button
              onClick={goNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!allDone}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              Submit case
            </button>
          )}
        </div>
      </div>
      </div> {/* end middle scrollable */}
    </div>
  );
}

// ─── Summary step row — single row inside CaseSummaryCard that doubles as a
// stepper line. Renders a numbered badge (gradient + check when done, blue
// ring when active, grey when pending), the step's icon, its label + status,
// the captured value, and an edit pencil. Clicking the row jumps to the step.
function SummaryStepRow({
  number, status, label, value, valuePlaceholder, subValue, icon, onClick,
}: {
  number: number;
  status: { label: string; tone: 'done' | 'active' | 'pending' };
  label: string;
  value?: string;
  valuePlaceholder: string;
  subValue?: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const tone = status.tone;
  return (
    <button
      onClick={onClick}
      title={`Edit ${label.toLowerCase()}`}
      className={`w-full px-5 py-3 flex items-center gap-3 text-left border-b border-[#F0EFF6] transition-colors ${
        tone === 'active' ? 'bg-[#F5F8FF] hover:bg-[#EEF4FF]' : 'hover:bg-[#FAFBFF]'
      }`}
    >
      {/* Numbered badge — overlays the step's icon tile */}
      <div className="relative flex-shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all overflow-hidden ${
          tone === 'done'
            ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white'
            : tone === 'active'
              ? 'bg-white border-2 border-[#4D8EF7] text-[#1565C0]'
              : 'bg-[#F3F3F5] text-[#A0A0B0]'
        }`}>
          {tone === 'done' ? <Check className="w-4 h-4" strokeWidth={3} /> : icon}
        </div>
        <span className={`absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full text-[9px] font-bold flex items-center justify-center px-1 border ${
          tone === 'done'
            ? 'bg-white text-[#4D8EF7] border-[#BFDBFE]'
            : tone === 'active'
              ? 'bg-[#4D8EF7] text-white border-white'
              : 'bg-[#030213] text-white border-white'
        }`}>
          {number}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">{label}</p>
          <span className={`text-[9px] font-semibold uppercase tracking-wider ${
            tone === 'done' ? 'text-[#2E7D32]' : tone === 'active' ? 'text-[#1565C0]' : 'text-[#A0A0B0]'
          }`}>
            · {status.label}
          </span>
        </div>
        <p className={`text-sm truncate ${value ? 'font-semibold text-[#030213]' : 'text-[#A0A0B0] italic'}`}>
          {value || valuePlaceholder}
        </p>
        {subValue && (
          <p className="text-[10px] text-[#717182] truncate">{subValue}</p>
        )}
      </div>
      <Pencil className="w-3.5 h-3.5 text-[#A0A0B0] flex-shrink-0" />
    </button>
  );
}

// ─── Stepper bar — top-of-page progress strip ────────────────────────────────
// Horizontal stepper with check marks for completed steps, gradient ring for
// the active step, and dashed connectors between them. Every step is
// clickable so the user can freely revisit panes.
function StepperBar({
  steps, activeStep, onStepClick,
}: {
  steps: { id: StepId; label: string; subtitle: string; icon: React.ReactNode; done: boolean }[];
  activeStep: StepId;
  onStepClick: (id: StepId) => void;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
      {steps.map((step, i) => {
        const isActive = step.id === activeStep;
        const isDone = step.done;
        return (
          <div key={step.id} className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <button
              onClick={() => onStepClick(step.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-[#F8F9FC] ${
                isActive ? 'bg-[#F8F9FC]' : ''
              }`}
              title={`Go to ${step.label}`}
            >
              <div className={`relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isDone
                  ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white'
                  : isActive
                    ? 'bg-white text-[#1565C0] ring-2 ring-[#4D8EF7] ring-offset-2 ring-offset-white'
                    : 'bg-[#F0EFF6] text-[#717182]'
              }`}>
                {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : step.icon}
              </div>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className={`text-xs font-semibold ${
                  isActive ? 'text-[#030213]' : isDone ? 'text-[#030213]' : 'text-[#717182]'
                }`}>
                  {step.label}
                </span>
                <span className={`text-[10px] ${
                  isActive ? 'text-[#4D8EF7] font-medium' : 'text-[#A0A0B0]'
                }`}>
                  {isDone ? 'Completed' : isActive ? 'In progress' : 'Pending'}
                </span>
              </div>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-shrink-0 w-6 sm:w-10 border-t border-dashed border-[#D4CEE1]" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Patient Details ────────────────────────────────────────────────
function PatientDetailsStep({ value, onChange, onPickExisting }: {
  value: PatientForm;
  onChange: (next: PatientForm) => void;
  onPickExisting: () => void;
}) {
  const set = <K extends keyof PatientForm>(k: K, v: PatientForm[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="bg-white rounded-2xl border border-[#E0E0E6] p-5 sm:p-6 max-w-5xl relative">
      {/* Existing Patient action */}
      <button
        onClick={onPickExisting}
        className="absolute top-5 right-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#030213] hover:text-[#4D8EF7] transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Existing Patient
      </button>

      <div className="space-y-5 pt-2">
        <Field label="Patient Name">
          <InputWithIcon
            icon={<User className="w-4 h-4" />}
            placeholder="Enter Name"
            value={value.name}
            onChange={(v) => set('name', v)}
          />
        </Field>

        <Field label="Patient ID">
          <InputWithIcon
            icon={<User className="w-4 h-4" />}
            placeholder="Enter Patient ID"
            value={value.patientId}
            onChange={(v) => set('patientId', v)}
          />
        </Field>

        <Field label="Email">
          <InputWithIcon
            icon={<Mail className="w-4 h-4" />}
            placeholder="Enter Email"
            value={value.email}
            onChange={(v) => set('email', v)}
            type="email"
          />
        </Field>

        <Field label="Phone No.">
          <div className="flex items-stretch border border-[#E0E0E6] rounded-lg overflow-hidden focus-within:border-[#4D8EF7] transition-colors">
            <div className="flex items-center gap-1.5 px-3 border-r border-[#E0E0E6] bg-white">
              <Phone className="w-4 h-4 text-[#A0A0B0]" />
              <select
                value={value.phoneCountry}
                onChange={(e) => set('phoneCountry', e.target.value)}
                className="text-sm font-medium text-[#030213] bg-transparent outline-none cursor-pointer pr-1"
              >
                {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input
              type="tel"
              value={value.phoneNumber}
              onChange={(e) => set('phoneNumber', e.target.value)}
              placeholder="Phone Number"
              className="flex-1 px-3 py-2.5 text-sm text-[#030213] placeholder-[#A0A0B0] outline-none"
            />
          </div>
        </Field>

        <Field label="Date of Birth">
          <div className="flex items-center border border-[#E0E0E6] rounded-lg overflow-hidden focus-within:border-[#4D8EF7] transition-colors">
            <div className="px-3 text-[#A0A0B0]">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={value.dob}
              onChange={(e) => set('dob', e.target.value)}
              className="flex-1 px-1 py-2.5 text-sm text-[#030213] outline-none bg-transparent"
            />
          </div>
        </Field>

        <Field label="Gender">
          <div className="relative">
            <select
              value={value.gender}
              onChange={(e) => set('gender', e.target.value as Gender)}
              className="w-full appearance-none px-3.5 py-2.5 pr-9 text-sm text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] transition-colors cursor-pointer"
            >
              {GENDER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronUp className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none rotate-180" />
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#030213] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InputWithIcon({ icon, value, onChange, placeholder, type = 'text' }: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex items-center border border-[#E0E0E6] rounded-lg overflow-hidden focus-within:border-[#4D8EF7] transition-colors">
      <div className="px-3 text-[#A0A0B0]">{icon}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-1 py-2.5 text-sm text-[#030213] placeholder-[#A0A0B0] outline-none"
      />
    </div>
  );
}

// ─── Step 2 — Lab Selection ──────────────────────────────────────────────────
function LabSelectionStep({ labs, selectedId, onSelect }: {
  labs: typeof mockSuppliers;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'favorites' | 'all'>('all');
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('cases.favoriteLabs') || '[]'); } catch { return []; }
  });
  function toggleFavorite(id: string) {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem('cases.favoriteLabs', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const visibleLabs = useMemo(() => {
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
    <div className="bg-white rounded-2xl border border-[#E0E0E6] p-5 sm:p-6">
      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 flex items-center border border-[#E0E0E6] rounded-lg overflow-hidden focus-within:border-[#4D8EF7] transition-colors">
          <div className="px-3 text-[#A0A0B0]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find the right lab for your needs.."
            className="flex-1 px-1 py-2.5 text-sm text-[#030213] placeholder-[#A0A0B0] outline-none"
          />
        </div>
        <button
          className="p-2.5 rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
          title="Filters"
        >
          <Filter className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[#F0EFF6] mb-5">
        {(['favorites', 'all'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'text-[#030213] border-[#030213]' : 'text-[#717182] border-transparent hover:text-[#030213]'
            }`}
          >
            {t === 'favorites' ? 'Favorite Labs' : 'All Labs'}
          </button>
        ))}
      </div>

      {/* Lab grid */}
      {visibleLabs.length === 0 ? (
        <div className="py-12 text-center text-sm text-[#717182]">
          {tab === 'favorites'
            ? 'No favorite labs yet. Star a lab from All Labs to add it here.'
            : 'No labs match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {visibleLabs.map((lab) => {
            const isSelected = selectedId === lab.id;
            const isFav = favorites.includes(lab.id);
            return (
              <button
                key={lab.id}
                onClick={() => onSelect(lab.id)}
                className={`text-left bg-white border rounded-xl overflow-hidden hover:shadow-md transition-all ${
                  isSelected ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/30' : 'border-[#E0E0E6]'
                }`}
              >
                {/* Logo placeholder — use the supplier's own avatar palette so
                    each lab gets the same visual identity it has in the DSO
                    suppliers list. */}
                <div className={`aspect-[5/3] flex items-center justify-center text-3xl font-bold ${lab.avatarColor || 'bg-[#F0EFF6] text-[#A59DFF]'}`}>
                  {lab.initials || lab.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#030213] truncate" title={lab.name}>
                      {lab.name}
                    </p>
                    <p className="text-[11px] text-[#717182] truncate">
                      {COUNTRY_NAMES[lab.country] || lab.country || 'United Kingdom'}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(lab.id); }}
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    className="p-1 rounded hover:bg-[#F8F9FC] transition-colors flex-shrink-0"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#A0A0B0]'}`} />
                  </button>
                </div>
                <div className="px-3 pb-3">
                  <span className="text-[11px] font-medium text-[#4D8EF7] hover:underline">
                    More Details →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Case Instructions card — sits next to the page title on step 3 ─────────
// Compact pill-style card with an inline edit toggle. Designed to fit beside the
// Create Case heading so step 3 content gets back the full row width.
function CaseInstructionsCard({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hasValue = value.trim().length > 0;
  return (
    <div className="w-full lg:w-[480px] lg:flex-shrink bg-white border border-[#E0E0E6] rounded-2xl px-4 py-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-[#030213]">Case Instructions</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-[#717182] bg-[#F8F9FC] border border-[#E8EAF6] px-1.5 py-0.5 rounded-full">
            <FileText className="w-3 h-3" />
            Order form
          </span>
        </div>
        {editing ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={2}
            placeholder="Add any notes for the lab…"
            className="w-full text-xs text-[#030213] placeholder-[#A0A0B0] border border-[#E0E0E6] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4D8EF7] transition-colors resize-none"
          />
        ) : (
          <p
            className={`text-xs cursor-pointer hover:text-[#030213] transition-colors line-clamp-2 ${hasValue ? 'text-[#030213]' : 'text-[#A0A0B0] italic'}`}
            onClick={() => setEditing(true)}
            title={hasValue ? value : 'Click to add instructions'}
          >
            {hasValue ? value : 'No case instructions. Click to add.'}
          </p>
        )}
      </div>
      <button
        onClick={() => setEditing(e => !e)}
        className="p-1.5 rounded-lg hover:bg-[#F8F9FC] transition-colors text-[#717182] hover:text-[#030213] flex-shrink-0"
        title="Edit instructions"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Service Details section (dentist + active-service editor + tooth chart) ─
// Rebuilt for clarity: instead of a giant category accordion the user picks
// services through a popup picker (triggered from the empty state OR the
// "+ Add another service" button in the Case Summary). Only the active
// service's editor renders on this pane, with its tooth chart sitting beside
// it. Switching between added services is one click in the summary list.
function ServiceDetailsStep({
  dentistId, onDentistChange,
  caseOrderType, onCaseOrderTypeChange,
  caseDeliveryDate, onCaseDeliveryDateChange,
  selections, onUpdateSelection,
  onOpenServicePicker,
}: {
  dentistId: string;
  onDentistChange: (id: string) => void;
  caseOrderType: string;
  onCaseOrderTypeChange: (v: string) => void;
  caseDeliveryDate: string;
  onCaseDeliveryDateChange: (v: string) => void;
  selections: ServiceSelection[];
  onUpdateSelection: (id: string, patch: Partial<ServiceSelection>) => void;
  onOpenServicePicker: () => void;
}) {
  const [chartTab, setChartTab] = useState<'chart' | 'scans'>('chart');

  const dentists = useMemo(
    () => mockStaffMembers.filter(s => s.staffType === 'Dentist'),
    []
  );
  const selectedDentist = dentists.find(d => d.id === dentistId) ?? null;
  const selectionMap = useMemo(
    () => Object.fromEntries(selections.map(s => [s.itemId, s])),
    [selections]
  );
  // The centre tooth chart edits whichever service is currently expanded —
  // i.e. the one the clinician is actively working on. Falls back to the most
  // recently added selection so the chart is never orphaned while at least
  // one service is selected.
  const activeService = useMemo(() => {
    return selections.find(s => s.expanded) ?? selections[selections.length - 1] ?? null;
  }, [selections]);
  const activeServiceLabel = activeService
    ? SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === activeService.itemId)?.label
    : null;

  // Find the catalogue entry + parent category for the active service so we
  // can show a "Crown · Single Unit" breadcrumb above the editor.
  const activeMeta = useMemo(() => {
    if (!activeService) return null;
    for (const cat of SERVICE_CATEGORIES) {
      const item = cat.items.find(i => i.id === activeService.itemId);
      if (item) return { item, cat };
    }
    return null;
  }, [activeService]);

  return (
    <div className="space-y-4">
      {/* ── Case Order Details ── case-level fields applied to every service.
          Dentist on Record + Order Type + Requested Delivery Date all live
          here so the user doesn't repeat them per service. ── */}
      <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white flex items-center justify-center">
            <FileText className="w-3.5 h-3.5" />
          </span>
          <h3 className="text-sm font-semibold text-[#030213]">Case Order Details</h3>
          <span className="text-[10px] text-[#A0A0B0] italic">— applied to all services</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Mini label="Dentist on Record" required>
            <div className="relative">
              <select
                value={dentistId}
                onChange={(e) => onDentistChange(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-9 text-sm text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] transition-colors cursor-pointer"
              >
                <option value="">Select dentist</option>
                {dentists.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Mini>
          <Mini label="Order Type" required>
            <div className="relative">
              <select
                value={caseOrderType}
                onChange={(e) => onCaseOrderTypeChange(e.target.value)}
                className="w-full appearance-none px-3 py-2 pr-9 text-sm text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] transition-colors cursor-pointer"
              >
                <option value="">Select order type</option>
                {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </Mini>
          <Mini label="Requested Delivery Date">
            <input
              type="date"
              value={caseDeliveryDate}
              onChange={(e) => onCaseDeliveryDateChange(e.target.value)}
              className="w-full px-3 py-2 text-sm text-[#030213] border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] transition-colors"
            />
          </Mini>
        </div>
        {selectedDentist && (
          <p className="text-[11px] text-[#717182] mt-3 truncate">
            Practice · <span className="font-medium text-[#030213]">{selectedDentist.practiceName}</span>
          </p>
        )}
      </div>

      {/* ── Active service editor — empty state if no service yet ── */}
      {!activeService || !activeMeta ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#D4CEE1] py-12 px-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center mx-auto mb-3">
            <Stethoscope className="w-5 h-5 text-[#7C3AED]" />
          </div>
          <p className="text-sm font-semibold text-[#030213] mb-1">No services added yet</p>
          <p className="text-xs text-[#717182] mb-4 max-w-sm mx-auto">
            Pick a service type to start filling in the order details. You can add as many services as the case needs.
          </p>
          <button
            onClick={onOpenServicePicker}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add first service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          {/* ── Editor card — material / shade / notes / teeth.
              The chart drops below the editor on anything narrower than xl so
              the editor isn't squeezed when the outer Case Summary column is
              also visible. ── */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-5">
            {/* Breadcrumb + change-type link */}
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F0EFF6]">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-0.5">Editing service</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[#717182] font-medium">{activeMeta.cat.label}</span>
                  <ChevronRight className="w-3 h-3 text-[#D4CEE1]" />
                  <h3 className="text-base font-bold text-[#030213] truncate">{activeMeta.item.label}</h3>
                </div>
              </div>
              <button
                onClick={onOpenServicePicker}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] flex-shrink-0"
                title="Pick a different service type or add another service"
              >
                <Plus className="w-3 h-3" />
                Change / Add
              </button>
            </div>

            {/* Per-service fields — material, shade, notes, teeth.
                Order Type + Delivery Date are case-level (see Case Order
                Details card at the top), so they're not asked here. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Mini label="Material">
                <div className="relative">
                  <select
                    value={activeService.material || ''}
                    onChange={(e) => onUpdateSelection(activeService.itemId, { material: e.target.value })}
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
                  value={activeService.shade}
                  onChange={(v) => onUpdateSelection(activeService.itemId, { shade: v })}
                />
              </Mini>
            </div>

            <div className="mt-4">
              <Mini label="Additional notes">
                <textarea
                  rows={2}
                  value={activeService.additional || ''}
                  onChange={(e) => onUpdateSelection(activeService.itemId, { additional: e.target.value })}
                  placeholder="Any extra instructions for this service…"
                  className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] resize-none"
                />
              </Mini>
            </div>

            {/* Teeth selection summary — read-only summary; editing happens in
                the chart on the right. */}
            <div className="mt-4 pt-3 border-t border-[#F0EFF6]">
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">
                Teeth ({activeService.teeth?.length ?? 0})
              </p>
              {(activeService.teeth?.length ?? 0) === 0 ? (
                <p className="text-[11px] text-[#A0A0B0] italic">Pick teeth from the chart →</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(activeService.teeth ?? []).map(t => (
                    <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Tooth chart / scan files for the active service ── */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between gap-2 border-b border-[#F0EFF6] p-2 px-3">
              <div className="flex items-center gap-1">
                {(['chart', 'scans'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setChartTab(t)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      chartTab === t
                        ? 'text-[#030213] bg-[#F0EFF6]'
                        : 'text-[#717182] hover:bg-[#F8F9FC]'
                    }`}
                  >
                    {t === 'chart' ? <ToothGlyph filled small /> : <ImageIcon className="w-3.5 h-3.5" />}
                    {t === 'chart' ? 'Tooth Chart' : 'Scans'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 p-3 overflow-auto">
              {chartTab === 'chart' ? (
                <InteractiveToothChart
                  activeService={activeService}
                  onToothToggle={(code) => {
                    const current = activeService.teeth ?? [];
                    const next = current.includes(code) ? current.filter(c => c !== code) : [...current, code];
                    onUpdateSelection(activeService.itemId, { teeth: next });
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 rounded-xl bg-[#F8F9FC] border border-[#E0E0E6] flex items-center justify-center mx-auto mb-2">
                      <ImageIcon className="w-4 h-4 text-[#A0A0B0]" />
                    </div>
                    <p className="text-xs font-semibold text-[#030213] mb-0.5">No scans uploaded</p>
                    <p className="text-[11px] text-[#717182] max-w-[200px]">
                      Upload intra-oral scans, X-rays, or references.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Service picker drawer ────────────────────────────────────────────────────
// Right-side slide-in drawer. Opens from the Service step empty state or the
// Case Summary "+ Add another service" button. Lists every service category
// with its items as clickable chips; selecting one keeps the drawer open so
// the user can stack multiple services in a row, with a Done button to close.
export function ServicePickerModal({
  selectedIds, onPick, onClose,
}: {
  selectedIds: string[];
  onPick: (itemId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filteredCats = useMemo(() => {
    if (!q) return SERVICE_CATEGORIES;
    return SERVICE_CATEGORIES
      .map(cat => ({ ...cat, items: cat.items.filter(i => i.label.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)) }))
      .filter(cat => cat.items.length > 0);
  }, [q]);
  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop — full viewport because we're portalled to <body>, so no
          transformed ancestor can clip it. */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      {/* Drawer — slides in from the right edge, full height */}
      <div
        className="relative ml-auto bg-white shadow-2xl w-full max-w-md flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#030213] truncate">Pick a service</h3>
              <p className="text-[11px] text-[#717182] truncate">Choose what the lab will produce.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Search */}
        <div className="px-5 py-3 border-b border-[#F0EFF6] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A0B0]" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search service type…"
              className="w-full text-sm pl-9 pr-3 py-2 rounded-lg border border-[#E0E0E6] outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/20"
            />
          </div>
        </div>
        {/* Categories + items — single-column list inside the drawer */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {filteredCats.length === 0 ? (
            <p className="text-center text-sm text-[#717182] py-8">No service matches "{search}".</p>
          ) : filteredCats.map(cat => (
            <div key={cat.id}>
              <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-2">{cat.label}</p>
              <div className="space-y-1.5">
                {cat.items.map(item => {
                  const already = selectedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onPick(item.id)}
                      disabled={already}
                      title={already ? 'Already added — pick another or close to edit' : `Add ${item.label}`}
                      className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left text-sm font-medium transition-all ${
                        already
                          ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#1A5C2A] cursor-not-allowed'
                          : 'bg-white border-[#E0E0E6] text-[#030213] hover:border-[#4D8EF7] hover:bg-[#F5F8FF]'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        already ? 'border-[#BBF7D0] bg-white' : 'border-[#C8D8FC] bg-white'
                      }`}>
                        <ToothGlyph filled={already} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {already
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#2E7D32] uppercase tracking-wider flex-shrink-0">
                            <Check className="w-3 h-3" strokeWidth={3} />
                            Added
                          </span>
                        : <Plus className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#F0EFF6] bg-[#F8F9FC] flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-[#717182]">
            <span className="font-bold text-[#030213]">{selectedIds.length}</span> service{selectedIds.length === 1 ? '' : 's'} added so far
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

// ─── Shade selector — Vita classical swatches as a chip grid ─────────────────
export function ShadeSelector({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TOOTH_SHADES.map(s => {
        const isActive = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
              isActive
                ? 'bg-[#4D8EF7] border-[#4D8EF7] text-white'
                : 'bg-white border-[#E0E0E6] text-[#5A5568] hover:border-[#4D8EF7] hover:text-[#1565C0]'
            }`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ─── Case Summary card — sticky right-rail aggregator + Submit ──────────────
// Mirrors the "Purchase Summary" pattern from the checkout inspiration: a
// single card on the right that rolls up everything the user has chosen so
// far (patient, lab, dentist, case source, services) and hosts the primary
// "Submit case" action at the bottom. Each row is clickable / editable in
// place: tapping Patient or Lab smooth-scrolls to that section, the Case
// Source dropdown lives here, and individual services can be removed from
// the rolled-up list without scrolling back to the catalogue.
function CaseSummaryCard({
  patientName, patientDone,
  lab, labDone,
  dentistName, dentistPractice,
  serviceDone, activeStep,
  caseSource, onCaseSourceChange,
  caseInstructions, onCaseInstructionsChange,
  selections, onRemoveSelection, onActivateSelection, onAddAnotherService,
  onScrollToPatient, onScrollToLab, onScrollToService,
  sectionsDone, allDone, onSubmit,
}: {
  patientName: string;
  patientDone: boolean;
  lab: typeof mockSuppliers[number] | null;
  labDone: boolean;
  dentistName?: string;
  dentistPractice?: string;
  serviceDone: boolean;
  activeStep: StepId;
  caseSource: string;
  onCaseSourceChange: (v: string) => void;
  caseInstructions: string;
  onCaseInstructionsChange: (v: string) => void;
  selections: ServiceSelection[];
  onRemoveSelection: (id: string) => void;
  /** Click a service chip → make it the active editor target on the Service step. */
  onActivateSelection: (id: string) => void;
  /** "+ Add another service" → open the service picker modal. */
  onAddAnotherService: () => void;
  onScrollToPatient: () => void;
  onScrollToLab: () => void;
  onScrollToService: () => void;
  sectionsDone: number;
  allDone: boolean;
  onSubmit: () => void;
}) {
  const [instructionsEditing, setInstructionsEditing] = useState(false);
  const hasInstructions = caseInstructions.trim().length > 0;
  // Per-row state derivation: every step row gets a number, a "done / active /
  // pending" flag, and a status sub-label so the summary card doubles as the
  // stepper. Active row gets a blue tint + ring; done rows show a check.
  const stepStatus = (id: StepId, done: boolean) => {
    if (done) return { label: 'Completed', tone: 'done' as const };
    if (activeStep === id) return { label: 'In progress', tone: 'active' as const };
    return { label: 'Pending', tone: 'pending' as const };
  };
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(77,142,247,0.04)]">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-[#F0EFF6]">
        <h3 className="text-base font-semibold text-[#030213]">Case Summary</h3>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#F0EFF6] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all"
              style={{ width: `${(sectionsDone / 3) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#5A5568] tabular-nums">{sectionsDone}/3</span>
        </div>
      </div>

      {/* Step rows — Patient (1) · Send to Lab (2) · Service Details (3). Each
          row is the stepper in disguise: numbered badge + label + status. */}
      <SummaryStepRow
        number={1}
        status={stepStatus('patient', patientDone)}
        label="Patient"
        value={patientName}
        valuePlaceholder="Add patient name"
        icon={<User className="w-4 h-4" />}
        onClick={onScrollToPatient}
      />
      <SummaryStepRow
        number={2}
        status={stepStatus('lab', labDone)}
        label="Send to lab"
        value={lab?.name}
        valuePlaceholder="Pick a lab"
        icon={
          lab ? (
            <span className={`w-full h-full rounded-md flex items-center justify-center text-[9px] font-bold ${lab.avatarColor || 'bg-[#030213] text-white'}`}>
              {lab.initials || lab.name.slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <FlaskConical className="w-4 h-4" />
          )
        }
        onClick={onScrollToLab}
      />
      <SummaryStepRow
        number={3}
        status={stepStatus('service', serviceDone)}
        label="Service details"
        value={dentistName}
        valuePlaceholder="Pick a dentist"
        subValue={dentistPractice}
        icon={<Stethoscope className="w-4 h-4" />}
        onClick={onScrollToService}
      />

      {/* Case Source dropdown (always editable inline) */}
      <div className="px-5 py-3 border-b border-[#F0EFF6]">
        <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider mb-1.5">
          Case Source <span className="text-[#D4183D]">*</span>
        </p>
        <div className="relative">
          <select
            value={caseSource}
            onChange={(e) => onCaseSourceChange(e.target.value)}
            className={`w-full appearance-none px-3 py-2 pr-9 text-sm rounded-lg border outline-none focus:border-[#4D8EF7] transition-colors cursor-pointer ${
              caseSource
                ? 'text-[#030213] border-[#E0E0E6] bg-white font-semibold'
                : 'text-[#717182] border-[#E0E0E6] bg-white'
            }`}
          >
            <option value="">Select source…</option>
            {CASE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-[#A0A0B0] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Services list — each row activates that service for editing on the
          Service step; the "+ Add another service" button at the bottom opens
          the service picker so multiple services can be stacked into one case. */}
      <div className="px-5 py-3 border-b border-[#F0EFF6]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Services</p>
          <span className="text-[10px] font-bold text-[#5A5568] tabular-nums">{selections.length}</span>
        </div>
        {selections.length === 0 ? (
          <p className="text-xs italic text-[#A0A0B0] mb-2">No services added yet.</p>
        ) : (
          <div className="space-y-1.5 mb-2">
            {selections.map(sel => {
              const item = SERVICE_CATEGORIES.flatMap(c => c.items).find(i => i.id === sel.itemId);
              if (!item) return null;
              const teethCount = sel.teeth?.length ?? 0;
              const isActive = sel.expanded;
              // A service is "complete enough" once material, shade, AND at
              // least one tooth are set. Missing any of these → show the
              // amber "Add details" prompt so the user knows it needs work.
              const hasDetails = !!sel.material && !!sel.shade && teethCount > 0;
              return (
                <div
                  key={sel.itemId}
                  className={`group rounded-lg border transition-colors flex items-center gap-1 ${
                    isActive
                      ? 'bg-[#EEF4FF] border-[#4D8EF7]'
                      : hasDetails
                        ? 'bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#86EFAC]'
                        : 'bg-[#FFFBEB] border-[#FCD34D] hover:border-[#F59E0B]'
                  }`}
                >
                  <button
                    onClick={() => {
                      onActivateSelection(sel.itemId);
                      onScrollToService();
                    }}
                    className="flex-1 min-w-0 text-left px-2.5 py-1.5 flex items-center justify-between gap-2"
                    title="Edit this service"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium text-xs ${
                        isActive ? 'text-[#1565C0]' : hasDetails ? 'text-[#1A5C2A]' : 'text-[#92400E]'
                      }`}>
                        {item.label}
                      </p>
                      {hasDetails ? (
                        <p className="text-[10px] text-[#5A5568] truncate">
                          {teethCount} {teethCount === 1 ? 'tooth' : 'teeth'}
                          {sel.shade && ` · Shade ${sel.shade}`}
                          {sel.material && ` · ${sel.material}`}
                        </p>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#92400E]">
                          <Plus className="w-2.5 h-2.5" strokeWidth={3} />
                          Add details
                        </span>
                      )}
                    </div>
                    {isActive ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#1565C0] flex-shrink-0">
                        Editing
                      </span>
                    ) : hasDetails ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" strokeWidth={3} />
                    ) : null}
                  </button>
                  <button
                    onClick={() => onRemoveSelection(sel.itemId)}
                    className="p-1 mr-1 text-[#A0A0B0] hover:text-[#C62828] rounded transition-colors flex-shrink-0"
                    title="Remove service"
                  >
                    <X className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={onAddAnotherService}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#BFDBFE] text-[11px] font-semibold text-[#4D8EF7] hover:border-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {selections.length === 0 ? 'Add first service' : 'Add another service'}
        </button>
      </div>

      {/* Case Instructions — moved here from the page header so the right
          rail is the single home for everything the user has chosen. */}
      <div className="px-5 py-3 border-b border-[#F0EFF6]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-wider">Case Instructions</p>
          <button
            onClick={() => setInstructionsEditing(v => !v)}
            className="text-[10px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-1"
            title={hasInstructions ? 'Edit instructions' : 'Add instructions'}
          >
            <Pencil className="w-3 h-3" />
            {instructionsEditing ? 'Done' : hasInstructions ? 'Edit' : 'Add'}
          </button>
        </div>
        {instructionsEditing ? (
          <textarea
            autoFocus
            value={caseInstructions}
            onChange={(e) => onCaseInstructionsChange(e.target.value)}
            onBlur={() => setInstructionsEditing(false)}
            rows={3}
            placeholder="Any notes for the lab — colour matching, occlusion preferences, prior issues…"
            className="w-full text-xs text-[#030213] placeholder-[#A0A0B0] border border-[#E0E0E6] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#4D8EF7] transition-colors resize-none"
          />
        ) : hasInstructions ? (
          <p className="text-xs text-[#030213] leading-relaxed line-clamp-3">
            {caseInstructions}
          </p>
        ) : (
          <button
            onClick={() => setInstructionsEditing(true)}
            className="text-xs text-[#A0A0B0] italic hover:text-[#5A5568] transition-colors text-left"
          >
            No instructions yet. Add notes for the lab.
          </button>
        )}
      </div>

      {/* Submit CTA */}
      <div className="p-5">
        <button
          onClick={onSubmit}
          disabled={!allDone}
          title={allDone ? 'Submit case' : 'Complete every section to submit'}
          className="w-full inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          Submit case
        </button>
        {!allDone && (
          <p className="text-[10px] text-[#A0A0B0] text-center mt-2">
            Finish every section to enable submission.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Service Detail Card — inline panel under a selected service item ───────
// Renders the 5 collapsible sections from the production flow:
//   1. Order Information (Order Type + Requested Delivery Date)
//   2. Teeth Chart      (FDI tooth chip picker)
//   3. Material Type    (single-select dropdown)
//   4. Tooth Shade      (Vita classical swatch picker)
//   5. Additional Items (free-text notes)
// Only one section can be open at a time within a single service card so the
// catalogue stays scannable.
function ServiceDetailCard({ selection, onUpdate, onToggleSection, onCollapse }: {
  selection: ServiceSelection;
  onUpdate: (patch: Partial<ServiceSelection>) => void;
  onToggleSection: (s: DetailSection) => void;
  onCollapse: () => void;
}) {
  const open = selection.openSection;
  const teeth = selection.teeth ?? [];

  return (
    <div className="ml-3 mt-1 mb-2 border border-[#E0E0E6] rounded-xl bg-white overflow-hidden">
      {/* Card-level collapse handle */}
      <div className="flex items-center justify-end px-2 py-1 border-b border-[#F0EFF6] bg-[#FAFBFC]">
        <button
          onClick={onCollapse}
          className="p-1 text-[#717182] hover:text-[#030213] rounded transition-colors"
          title="Collapse"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. Order Information */}
      <DetailSectionRow
        title="1. Order Information"
        required
        isOpen={open === 'order'}
        isDone={!!selection.orderType}
        onToggle={() => onToggleSection('order')}
        summary={selection.orderType ? `${selection.orderType}${selection.requestedDelivery ? ` · ${selection.requestedDelivery}` : ''}` : undefined}
      >
        <Mini label="Order Type" required>
          <select
            value={selection.orderType || ''}
            onChange={(e) => onUpdate({ orderType: e.target.value })}
            className="w-full appearance-none px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
          >
            <option value="">Select order type</option>
            {ORDER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Mini>
        <Mini label="Requested Delivery Date">
          <input
            type="date"
            value={selection.requestedDelivery || ''}
            onChange={(e) => onUpdate({ requestedDelivery: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7]"
          />
        </Mini>
      </DetailSectionRow>

      {/* 2. Teeth Chart */}
      <DetailSectionRow
        title="2. Teeth Chart"
        isOpen={open === 'teeth'}
        isDone={teeth.length > 0}
        onToggle={() => onToggleSection('teeth')}
        summary={teeth.length > 0 ? `${teeth.length} selected · ${teeth.slice(0, 4).join(', ')}${teeth.length > 4 ? '…' : ''}` : undefined}
      >
        <TeethPicker
          value={teeth}
          onChange={(next) => onUpdate({ teeth: next })}
        />
      </DetailSectionRow>

      {/* 3. Material Type */}
      <DetailSectionRow
        title="3. Material Type"
        isOpen={open === 'material'}
        isDone={!!selection.material}
        onToggle={() => onToggleSection('material')}
        summary={selection.material}
      >
        <select
          value={selection.material || ''}
          onChange={(e) => onUpdate({ material: e.target.value })}
          className="w-full appearance-none px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7] cursor-pointer"
        >
          <option value="">Select material</option>
          {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </DetailSectionRow>

      {/* 4. Tooth Shade */}
      <DetailSectionRow
        title="4. Tooth Shade"
        isOpen={open === 'shade'}
        isDone={!!selection.shade}
        onToggle={() => onToggleSection('shade')}
        summary={selection.shade ? `Shade ${selection.shade}` : undefined}
      >
        <div className="grid grid-cols-6 gap-1.5">
          {TOOTH_SHADES.map(s => {
            const isActive = selection.shade === s;
            return (
              <button
                key={s}
                onClick={() => onUpdate({ shade: isActive ? undefined : s })}
                className={`px-1.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                  isActive
                    ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]'
                    : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#C8D8FC]'
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </DetailSectionRow>

      {/* 5. Additional Items — optional, so done when there's any content. */}
      <DetailSectionRow
        title="5. Additional Items"
        isOpen={open === 'additional'}
        isDone={!!selection.additional?.trim()}
        onToggle={() => onToggleSection('additional')}
        summary={selection.additional ? (selection.additional.length > 32 ? selection.additional.slice(0, 32) + '…' : selection.additional) : undefined}
        last
      >
        <textarea
          value={selection.additional || ''}
          onChange={(e) => onUpdate({ additional: e.target.value })}
          rows={2}
          placeholder="Try-in, occlusal records, special instructions…"
          className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg bg-white outline-none focus:border-[#4D8EF7]"
        />
      </DetailSectionRow>
    </div>
  );
}

// ── Section row used inside a service detail card ──
// `isDone` controls the trailing indicator: a check icon when complete,
// otherwise the chevron. When done + closed, the header gets a soft blue
// background so finished sections read at a glance.
function DetailSectionRow({ title, required, isOpen, isDone, onToggle, summary, children, last }: {
  title: string;
  required?: boolean;
  isOpen: boolean;
  isDone?: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const headerTone = !isOpen && isDone
    ? 'bg-[#EEF4FF] hover:bg-[#E0EBFF]'
    : 'hover:bg-[#F8F9FC]';
  return (
    <div className={last ? '' : 'border-b border-[#F0EFF6]'}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors ${headerTone}`}
      >
        <span className="text-xs font-semibold text-[#030213] flex items-center gap-1 min-w-0">
          <span className="truncate">
            {title}
            {required && <span className="text-[#D4183D]"> *</span>}
          </span>
          {summary && !isOpen && (
            <span className="ml-2 text-[11px] font-normal text-[#717182] truncate">— {summary}</span>
          )}
        </span>
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-[#717182] flex-shrink-0" />
        ) : isDone ? (
          <span className="w-4 h-4 rounded-full bg-[#4D8EF7] text-white flex items-center justify-center flex-shrink-0">
            <Check className="w-2.5 h-2.5" strokeWidth={3} />
          </span>
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-[#717182] flex-shrink-0" />
        )}
      </button>
      {isOpen && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Mini labelled field ──
export function Mini({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">
        {label} {required && <span className="text-[#D4183D]">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Interactive Tooth Chart — centre column of Step 3 ──────────────────────
// FDI SVG tooth chart — renders the user-supplied FDI.svg as a static visual
// and overlays an SVG with per-tooth elliptical hit-areas mapped to the exact
// coordinate space of the chart (viewBox 0 0 327 555).
// Hover → light teal tint; Selected → solid teal fill (#59C1E3 / #3FA8CA).
// Targets whichever service is currently being edited (activeService).
export function InteractiveToothChart({ activeService, onToothToggle, width = 170 }: {
  activeService: ServiceSelection | null;
  onToothToggle: (code: string) => void;
  /** Width of the rendered chart. Either a number (treated as px) or a CSS
   *  expression (e.g. "min(240px, calc(100vh - 220px))") so callers can
   *  cap the chart size to the available viewport. Height follows the FDI
   *  viewBox aspect ratio. Defaults to 170px (the original size). */
  width?: number | string;
}) {
  const [hoveredTooth, setHoveredTooth] = useState<string | null>(null);
  const selected = activeService?.teeth ?? [];

  // Hit-area centres and radii in SVG units (viewBox 0 0 327 555). Tuned
  // by measuring path centroids from /public/FDI.svg so the ellipses land
  // ON the tooth shapes (not on the FDI number labels above them).
  // Upper arch: incisors (11/21) at the top-centre near cy≈44, molars
  // (18/28) at the lower outer corners near cy≈247.
  // Lower arch: mirrored downward — incisors (41/31) at the bottom-centre
  // near cy≈520, molars (48/38) at the upper outer corners near cy≈332.
  const TEETH: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
    // Q1 upper-right (patient's right = viewer's left) ──────────────────────
    '11': { cx: 144, cy:  44, rx: 12, ry: 11 },
    '12': { cx: 108, cy:  51, rx: 11, ry: 10 },
    '13': { cx:  81, cy:  67, rx: 14, ry: 13 },
    '14': { cx:  68, cy:  97, rx: 15, ry: 15 },
    '15': { cx:  57, cy: 129, rx: 17, ry: 15 },
    '16': { cx:  46, cy: 166, rx: 22, ry: 22 },
    '17': { cx:  42, cy: 209, rx: 20, ry: 19 },
    '18': { cx:  42, cy: 247, rx: 20, ry: 18 },
    // Q2 upper-left (patient's left = viewer's right) ───────────────────────
    '21': { cx: 184, cy:  44, rx: 12, ry: 11 },
    '22': { cx: 219, cy:  51, rx: 11, ry: 10 },
    '23': { cx: 246, cy:  67, rx: 14, ry: 13 },
    '24': { cx: 259, cy:  97, rx: 15, ry: 15 },
    '25': { cx: 270, cy: 129, rx: 17, ry: 15 },
    '26': { cx: 280, cy: 166, rx: 22, ry: 22 },
    '27': { cx: 284, cy: 209, rx: 20, ry: 19 },
    '28': { cx: 284, cy: 247, rx: 20, ry: 18 },
    // Q4 lower-right (patient's right = viewer's left) ──────────────────────
    '48': { cx:  49, cy: 332, rx: 21, ry: 18 },
    '47': { cx:  57, cy: 370, rx: 22, ry: 21 },
    '46': { cx:  66, cy: 411, rx: 22, ry: 22 },
    '45': { cx:  71, cy: 447, rx: 16, ry: 15 },
    '44': { cx:  83, cy: 474, rx: 15, ry: 14 },
    '43': { cx: 102, cy: 496, rx: 16, ry: 17 },
    '42': { cx: 126, cy: 511, rx: 13, ry: 11 },
    '41': { cx: 151, cy: 520, rx: 11, ry:  6 },
    // Q3 lower-left (patient's left = viewer's right) ───────────────────────
    '31': { cx: 175, cy: 520, rx: 11, ry:  6 },
    '32': { cx: 200, cy: 511, rx: 13, ry: 11 },
    '33': { cx: 224, cy: 496, rx: 16, ry: 17 },
    '34': { cx: 242, cy: 474, rx: 15, ry: 14 },
    '35': { cx: 254, cy: 447, rx: 16, ry: 15 },
    '36': { cx: 260, cy: 412, rx: 22, ry: 22 },
    '37': { cx: 269, cy: 372, rx: 22, ry: 21 },
    '38': { cx: 277, cy: 333, rx: 21, ry: 18 },
  };

  return (
    <div className="space-y-3">
      {/* Selection summary strip */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#717182]">
          {!activeService
            ? 'Pick a service from the left to start selecting teeth.'
            : selected.length === 0
              ? 'Click any tooth to add it to the selection.'
              : <><span className="font-semibold text-[#030213]">{selected.length}</span>{' '}
                  {selected.length === 1 ? 'tooth' : 'teeth'} selected ·{' '}
                  <span className="text-[#030213] font-medium">{selected.slice().sort().join(', ')}</span></>}
        </p>
        {activeService && selected.length > 0 && (
          <button
            onClick={() => selected.forEach(t => onToothToggle(t))}
            className="text-[11px] text-[#717182] hover:text-[#D4183D] flex-shrink-0"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chart — size is caller-controlled via the `width` prop; height
          follows the FDI viewBox ratio so both arches always fit. */}
      <div className="flex justify-center">
      <div
        className="relative select-none"
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          aspectRatio: '327 / 555',
        }}
      >
        {/* Static FDI visual */}
        <img
          src="/FDI.svg"
          alt="FDI dental chart"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          draggable={false}
        />
        {/* Interactive overlay — same viewBox as the SVG file */}
        <svg
          viewBox="0 0 327 555"
          className="absolute inset-0 w-full h-full"
          style={{ cursor: activeService ? 'pointer' : 'default' }}
        >
          {Object.entries(TEETH).map(([id, { cx, cy, rx, ry }]) => {
            const isSel = selected.includes(id);
            const isHov = hoveredTooth === id;
            return (
              <ellipse
                key={id}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fill={
                  isSel
                    ? 'rgba(89,193,227,0.62)'
                    : isHov && activeService
                      ? 'rgba(89,193,227,0.27)'
                      : 'transparent'
                }
                stroke={isSel ? '#3FA8CA' : 'none'}
                strokeWidth={isSel ? 1.5 : 0}
                onMouseEnter={() => activeService && setHoveredTooth(id)}
                onMouseLeave={() => setHoveredTooth(null)}
                onClick={() => activeService && onToothToggle(id)}
              />
            );
          })}
        </svg>
      </div>
      </div>
    </div>
  );
}

// ── Teeth picker — FDI World Dental Federation 2-digit notation ──
// Quadrant 1 (upper right) 18-11 | Quadrant 2 (upper left) 21-28
// Quadrant 4 (lower right) 48-41 | Quadrant 3 (lower left) 31-38
const FDI_UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
const FDI_LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];
function TeethPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter(c => c !== code) : [...value, code]);
  }
  function row(codes: string[], label: string) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#A0A0B0] mb-1">{label}</p>
        <div className="grid grid-cols-8 gap-1">
          {codes.map(c => {
            const isOn = value.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`px-1 py-1 text-[10px] font-semibold rounded border transition-colors ${
                  isOn
                    ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]'
                    : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:border-[#C8D8FC]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {row(FDI_UPPER, 'Upper')}
      {row(FDI_LOWER, 'Lower')}
      {value.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-[11px] text-[#717182] hover:text-[#D4183D]"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

// ── Tiny tooth glyph (SVG) used in step 3 buttons + tab icon ──
export function ToothGlyph({ filled = false, small = false }: { filled?: boolean; small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={filled ? '#4D8EF7' : '#A0A0B0'}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M12 2c-3 0-5 2-5 5 0 2 1 3 1 6 0 4-1 9 1 9 1 0 1-2 2-4 0-1 1-2 1-2s1 1 1 2c1 2 1 4 2 4 2 0 1-5 1-9 0-3 1-4 1-6 0-3-2-5-5-5z" />
    </svg>
  );
}
