// ─── Smile Genius Go — service catalogue ─────────────────────────────────────
// Extracted verbatim from the web portal's Create Case form so the app and the
// portals share one vocabulary. In production, load these from the API instead.
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

// ── Nested implant brand catalog (DUMMY DATA) ────────────────────────────────
// Brand → System → Platform drill-down for the implant-abutment brand picker.
// Real implant catalogs nest this way (e.g. Adin → Touareg → UNP/NP/RP/WP).
// This is a small hand-seeded sample for the prototype — swap for the real
// catalogue when available. A brand with an empty `systems` array (e.g.
// "Other") falls back to flat selection (picking the brand IS the choice).
export type ImplantSystem = { name: string; platforms: string[] };
export type ImplantBrandNode = { brand: string; systems: ImplantSystem[] };
export const IMPLANT_BRAND_CATALOG: ImplantBrandNode[] = [
  { brand: 'Adin', systems: [
    { name: 'Touareg', platforms: ['UNP', 'NP', 'RP', 'WP'] },
    { name: 'CloseFit', platforms: ['NP', 'RP'] },
  ]},
  { brand: 'Alfa Gate', systems: [
    { name: 'Spiral', platforms: ['NP', 'RP', 'WP'] },
    { name: 'Conical', platforms: ['Standard', 'Wide'] },
  ]},
  { brand: 'Alliance', systems: [
    { name: 'In-Kone', platforms: ['Universal'] },
  ]},
  { brand: 'Straumann', systems: [
    { name: 'Bone Level', platforms: ['NC', 'RC'] },
    { name: 'Tissue Level', platforms: ['RN', 'WN'] },
    { name: 'BLX', platforms: ['RB', 'WB'] },
  ]},
  { brand: 'Nobel Biocare', systems: [
    { name: 'NobelActive', platforms: ['NP', 'RP'] },
    { name: 'Brånemark', platforms: ['RP', 'WP'] },
    { name: 'NobelReplace', platforms: ['NP', 'RP', 'WP'] },
  ]},
  { brand: 'MIS', systems: [
    { name: 'C1', platforms: ['Standard'] },
    { name: 'Seven', platforms: ['Standard'] },
  ]},
  { brand: 'Dentium', systems: [
    { name: 'Implantium', platforms: ['Regular'] },
    { name: 'SuperLine', platforms: ['Regular', 'Wide'] },
  ]},
  // Flat fallback example — no systems, so picking the brand is the leaf.
  { brand: 'Other', systems: [] },
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

// ── Clear Aligners ───────────────────────────────────────────────────────────
// Full aligner prescription. Retainers keep the simpler Retainer Type +
// Occlusion block; Clear Aligners get this richer set. Option lists for
// Phasing / IPR / Attachment / Incisal Edge / Crowding / Midline come straight
// from the reference prescription; the remaining movement fields use the
// standard improve / maintain / as-needed pattern and can be tuned later.
export const YES_NO = ['Yes', 'No'];
export const ALIGNER_DURATIONS = ['7 days / aligner', '10 days / aligner', '14 days / aligner', '21 days / aligner'];
export const ALIGNER_INCISAL_EDGE = ['Gingival', 'Incisal', 'As Needed', 'N/A'];
export const ALIGNER_CROWDING = ['Expand', 'Procline', 'As Needed', 'N/A'];
export const ALIGNER_SPACING = ['Close', 'Maintain', 'As Needed', 'N/A'];
export const ALIGNER_OVERJET = ['Improve', 'Maintain', 'As Needed', 'N/A'];
export const ALIGNER_OVERBITE = ['Improve', 'Maintain', 'As Needed', 'N/A'];
export const ALIGNER_OPENBITE = ['Close', 'Maintain', 'As Needed', 'N/A'];
export const ALIGNER_CROSSBITE = ['Correct', 'Maintain', 'As Needed', 'N/A'];
export const ALIGNER_MIDLINE = ['Between Centrals', 'Distal to laterals', 'Distal to Canines', 'Equally around laterals', 'As Needed', 'N/A'];
export const ALIGNER_BIOTYPE = ['Thin', 'Normal', 'Thick', 'N/A'];
export const MILLERS_CLASS = ['Class I', 'Class II', 'Class III', 'Class IV', 'N/A'];

// ── Denture ─────────────────────────────────────────────────────────────────
// Stage of fabrication this case sits at. Multi-select because a single case
// often covers more than one stage (e.g. impression + try-in). Each picked stage
// carries its own requested delivery date — a denture has no service-level date.
export const DENTURE_STAGES = ['Special Tray', 'Bite Registration', 'Try In', 'Retry', 'Finish'];

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
// (The web portal also maps user-created custom services to a 'custom'
// category; the app does not support custom services yet.)
export function getCategoryForItem(itemId: string): string | null {
  for (const cat of SERVICE_CATEGORIES) {
    if (cat.items.find(i => i.id === itemId)) return cat.id;
  }
  return null;
}

