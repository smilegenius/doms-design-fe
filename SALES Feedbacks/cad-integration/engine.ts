import type { Case } from '../../src/app/pages/CasesPage';
import { allCases, caseFiles } from '../bulk-actions/caseContent';
import { getBilling } from '../lab-billing/billingStore';
import type { CatalogItem } from '../lab-billing/types';
import type { CadMap, CadOrder, CadSettings, CadSoftware, CadState, DesignedLine, DesignStatus, OrderLine } from './types';

// ── CAD engine: pure rules ───────────────────────────────────────────────────
// Building the CAD order from a case (order mapping), which CAD, whether the
// dentist must approve, what's overdue, and how the finished design differs
// from the case.

export const STATUS_LABEL: Record<DesignStatus, string> = {
  'order-created': 'CAD order created',
  'waiting-scans': 'Waiting for scans',
  'in-design': 'In design',
  'awaiting-dentist': 'Awaiting dentist',
  ready: 'Ready to manufacture',
  manufacturing: 'Manufacturing',
  finishing: 'Finishing',
  dispatched: 'Dispatched',
  'sent-to-partner': 'Sent to partner',
  'design-received': 'Design received',
  'partner-manufacturing': 'Manufactured by partner',
  'received-back': 'Received back',
  cancelled: 'Cancelled',
};

/** Board columns and the statuses each one holds. */
export const COLUMNS: { id: string; label: string; statuses: DesignStatus[]; lab?: boolean }[] = [
  { id: 'created', label: 'CAD order created', statuses: ['order-created', 'waiting-scans'] },
  { id: 'design', label: 'In design', statuses: ['in-design', 'design-received'] },
  { id: 'partner', label: 'With a partner', statuses: ['sent-to-partner', 'partner-manufacturing'] },
  { id: 'dentist', label: 'Awaiting dentist', statuses: ['awaiting-dentist'] },
  { id: 'ready', label: 'Ready to manufacture', statuses: ['ready'], lab: true },
  { id: 'manufacturing', label: 'Manufacturing', statuses: ['manufacturing'], lab: true },
  { id: 'finishing', label: 'Finishing', statuses: ['finishing', 'received-back'], lab: true },
  { id: 'dispatched', label: 'Dispatched', statuses: ['dispatched'], lab: true },
];

export const CAD_LABEL: Record<CadSoftware | 'partner', string> = { exocad: 'exocad', '3shape': '3Shape', partner: 'Partner' };

export const INDICATIONS: Record<CadSoftware, string[]> = {
  exocad: ['Anatomic crown', 'Reduced crown (coping)', 'Pontic', 'Veneer', 'Inlay', 'Onlay', 'Abutment', 'Screw-retained crown', 'Bar', 'Telescope', 'Full denture', 'Partial framework', 'Bite splint'],
  '3shape': ['Anatomical crown', 'Coping', 'Anatomical pontic', 'Veneer', 'Inlay', 'Onlay', 'Customized abutment', 'Screw-retained crown', 'Bar', 'Full denture', 'RPD framework', 'Splint'],
};
export const MATERIALS = ['Zirconia', 'Lithium disilicate (e.max)', 'PMMA', 'Composite', 'Cobalt chrome', 'Titanium', 'Acrylic', 'PEEK'];

/** Departments that don't go through CAD (ortho and aligner software is a non-goal). */
export const NOT_CAD = ['Orthodontics'];

export const TECHNICIANS = ['Mark (CAD)', 'Priya (CAD)', 'Tom (CAD)'];

const DEFAULT_MAP: Record<string, [string, string, string]> = {
  // catalog id: [exocad indication, 3Shape indication, material]
  crn: ['Anatomic crown', 'Anatomical crown', 'Zirconia'],
  ven: ['Veneer', 'Veneer', 'Lithium disilicate (e.max)'],
  inl: ['Inlay', 'Inlay', 'Lithium disilicate (e.max)'],
  pcc: ['Anatomic crown', 'Anatomical crown', 'Zirconia'],
  brg: ['Pontic', 'Anatomical pontic', 'Zirconia'],
  abt: ['Abutment', 'Customized abutment', 'Titanium'],
  src: ['Screw-retained crown', 'Screw-retained crown', 'Zirconia'],
  fden: ['Full denture', 'Full denture', 'Acrylic'],
  pden: ['Partial framework', 'RPD framework', 'Cobalt chrome'],
  iden: ['Full denture', 'Full denture', 'Acrylic'],
  ng: ['Bite splint', 'Splint', 'PMMA'],
  spl: ['Bite splint', 'Splint', 'PMMA'],
};

/** Pre-filled mapping for common items (the admin confirms). Whitening trays and "Other" stay unmapped. */
export function defaultMapping(): CadSettings['mapping'] {
  const out: CadSettings['mapping'] = {};
  for (const [id, [exo, tri, mat]] of Object.entries(DEFAULT_MAP)) out[id] = { exocad: { indication: exo, material: mat }, '3shape': { indication: tri, material: mat } };
  return out;
}

export const cadCases = () => allCases().filter(c => c.status !== 'draft');
export const caseOf = (id: string) => allCases().find(c => c.id === id);

/** The catalog item for a service on the case (the Billing catalog). */
export function catalogItemFor(name: string): CatalogItem | undefined {
  return getBilling().catalog.find(i => !i.archived && i.name.toLowerCase() === name.toLowerCase());
}

/** Is this a case CAD should see? Digital (scans or a scanner source), and not ortho. */
export function isCadCase(c: Case) {
  const digital = c.source === 'scanner' || (c.serviceItems ?? []).some(si => (si.scanFileCount ?? 0) > 0) || caseFiles(c).some(f => f.file.kind === 'mesh');
  const cadWork = (c.serviceItems ?? []).some(si => !NOT_CAD.includes(catalogItemFor(si.name)?.department ?? ''));
  return digital && cadWork;
}

/** Which CAD a case goes to: the lab's only CAD, or the default for its department. */
export function cadFor(s: CadSettings, c: Case): CadSoftware | null {
  if (s.cad === 'none') return null;
  if (s.cad !== 'both') return s.cad;
  const dept = catalogItemFor(c.serviceItems?.[0]?.name ?? '')?.department ?? '';
  return s.cadByDepartment[dept] ?? 'exocad';
}

export const mapFor = (s: CadSettings, itemId: string | null, cad: CadSoftware): CadMap | undefined => (itemId ? s.mapping[itemId]?.[cad] : undefined);

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]?.toUpperCase()).join('');

/** Lines of the CAD order: one per service, indication and material from the mapping. */
export function orderLines(s: CadSettings, c: Case, cad: CadSoftware | 'partner'): OrderLine[] {
  const which: CadSoftware = cad === 'partner' ? 'exocad' : cad;
  return (c.serviceItems ?? []).filter(si => !NOT_CAD.includes(catalogItemFor(si.name)?.department ?? '')).map(si => {
    const item = catalogItemFor(si.name);
    const m = mapFor(s, item?.id ?? null, which);
    return { id: si.id, itemId: item?.id ?? null, itemName: item?.name ?? si.name, fdi: [...(si.fdi ?? [])], indication: m?.indication ?? null, material: si.material && !m ? si.material : m?.material ?? si.material ?? null };
  });
}

/** Scan files for the order folder, with standard names. */
export function scansFor(c: Case): CadOrder['scans'] {
  const n = (c.serviceItems ?? []).reduce((x, si) => x + (si.scanFileCount ?? 0), 0);
  const kinds: CadOrder['scans'][number]['kind'][] = ['prep', 'antagonist', 'bite', 'scanbody'];
  const scans: CadOrder['scans'] = Array.from({ length: Math.min(n, 4) }, (_, i) => ({ name: `${c.id}_${kinds[i]}.stl`, kind: kinds[i] }));
  for (const { file } of caseFiles(c)) scans.push({ name: file.name, kind: file.kind === 'mesh' ? 'file' : file.kind === 'image' ? 'photo' : 'file' });
  return scans;
}

const ANTERIOR = new Set([13, 12, 11, 21, 22, 23, 33, 32, 31, 41, 42, 43]);

/** Does this order need the dentist's sign-off? (Lab setting, by restoration type.) */
export function needsApproval(s: CadSettings, lines: OrderLine[]): boolean {
  if (s.approval === 'always') return true;
  if (s.approval === 'never') return false;
  const t = s.approvalTypes;
  const teeth = lines.flatMap(l => l.fdi);
  const ids = lines.map(l => l.itemId);
  if (t.veneers && ids.includes('ven')) return true;
  if (t.bridges && ids.includes('brg')) return true;
  if (t.implantBars && lines.some(l => /bar/i.test(l.indication ?? '') || l.itemId === 'src' || l.itemId === 'abt')) return true;
  if (t.anterior4 && teeth.filter(x => ANTERIOR.has(x)).length >= 4) return true;
  if (t.smileDesign && lines.some(l => /smile/i.test(l.itemName))) return true;
  return false;
}

export function techFor(st: CadState, c: Case): string | null {
  const s = st.settings;
  if (s.assign === 'manual') return null;
  if (s.assign === 'by-type') return s.techByDepartment[catalogItemFor(c.serviceItems?.[0]?.name ?? '')?.department ?? ''] ?? null;
  return TECHNICIANS[st.rr % TECHNICIANS.length];
}

/** What changed between the case and what was designed: extra or missing units, changed restoration types. */
export function designDiff(order: CadOrder, designed: DesignedLine[]): string[] {
  const name = (id: string | null) => getBilling().catalog.find(i => i.id === id)?.name ?? 'item';
  const want = new Map<number, string | null>();
  order.lines.forEach(l => l.fdi.forEach(t => want.set(t, l.itemId)));
  const got = new Map<number, string>();
  designed.forEach(l => l.fdi.forEach(t => got.set(t, l.itemId)));
  const out: string[] = [];
  for (const [t, id] of got) {
    if (!want.has(t)) out.push(`Extra unit on ${t} (${name(id)})`);
    else if (want.get(t) !== id) out.push(`${t}: ${name(want.get(t) ?? null)} changed to ${name(id)}`);
  }
  for (const t of want.keys()) if (!got.has(t)) out.push(`Not designed: ${t}`);
  const units = (m: Map<number, unknown>) => m.size;
  if (units(got) !== units(want) && out.length) out.unshift(`Designed ${units(got)} unit${units(got) === 1 ? '' : 's'} (case said ${units(want)})`);
  return out;
}

export const hoursSince = (iso: string, now = Date.now()) => (now - new Date(iso).getTime()) / 3_600_000;

export function waitingLabel(iso?: string) {
  if (!iso) return '';
  const h = hoursSince(iso);
  return h < 1 ? 'just now' : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`;
}

/** Due date as ISO (from the case's DD-MMM-YYYY), or null. */
export function dueIso(c: Case): string | null {
  const d = c.requestedDelivery ?? c.serviceItems?.find(si => si.deliveryDate)?.deliveryDate ?? null;
  if (!d) return null;
  const t = Date.parse(d.replace(/-/g, ' '));
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
