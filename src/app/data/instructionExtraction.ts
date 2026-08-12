import { TOOTH_SHADES } from '../pages/CreateCasePage';

// ─── Natural-language case-instruction extraction (mock AI) ──────────────────
// Deterministic regex/keyword engine behind the "Read instructions" action on
// Quick Create: the user types a sentence like
//   "Emax crown on 26, shade A2, patient Sarah Whitfield, deliver by 12 Aug,
//    heavy grinder — reinforce occlusal"
// and this returns the structured entities with per-entity confidence, in the
// spirit of matchScanFile's keyword→confidence pattern (QuickCreateCasePage).
//
// Design rules:
//   • Pure + deterministic — same text in, same entities out; never throws.
//   • The DATE and SHADE rules run first and MASK their matched spans, so
//     "12 Aug" can't leak tooth 12 and a bare "A2" can't collide with FDI 42.
//   • The caller never rewrites the instruction text — anything unmapped
//     simply stays in the textarea verbatim.

export interface ExtractedCase {
  patientName?: { value: string; confidence: number };
  deliveryISO?: { value: string; confidence: number };   // yyyy-mm-dd
  orderType?:   { value: 'NHS' | 'Private'; confidence: number };
  service?:     { itemId: string; label: string; confidence: number };
  teeth?:       { codes: string[]; confidence: number }; // in-app codes: 26 → 'UL6'
  material?:    { value: string; confidence: number };   // exact MATERIAL_TYPES entry
  shade?:       { value: string; confidence: number };   // exact TOOTH_SHADES entry
}

// FDI numeric (16, 26…) → in-app tooth code (UR6, UL6). Duplicated from the
// page helper on purpose — keeps this module dependency-light.
function fdiToCode(fdi: number): string {
  const quadrant = Math.floor(fdi / 10);
  const position = fdi % 10;
  if (quadrant < 1 || quadrant > 4 || position < 1 || position > 8) return '';
  return `${['', 'UR', 'UL', 'LL', 'LR'][quadrant]}${position}`;
}

// Replace a matched span with spaces (same length, so later regex indices
// still line up with the original text).
function mask(text: string, start: number, length: number): string {
  return text.slice(0, start) + ' '.repeat(length) + text.slice(start + length);
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Service keywords, longest/most-specific first so "night guard" wins over
// "guard" and "partial denture" over "denture". Catalogue ids match
// SERVICE_CATEGORIES in CreateCasePage.
const SERVICE_KEYWORDS: { re: RegExp; itemId: string; label: string }[] = [
  { re: /partial\s+denture/i,          itemId: 'de-partial-denture', label: 'Partial Denture' },
  { re: /(?:full|complete)\s+denture/i, itemId: 'de-full-denture',   label: 'Full Denture' },
  { re: /denture/i,                    itemId: 'de-full-denture',    label: 'Full Denture' },
  { re: /night\s?guard/i,              itemId: 'ap-night-guard',     label: 'Night Guard' },
  { re: /whitening\s+tray/i,           itemId: 'ap-whitening-tray',  label: 'Whitening Tray' },
  { re: /splint/i,                     itemId: 'ap-splint',          label: 'Splint' },
  { re: /(?:clear\s+)?aligner/i,       itemId: 'or-clear-aligners',  label: 'Clear Aligners' },
  { re: /retainer/i,                   itemId: 'or-retainers',       label: 'Retainers' },
  { re: /inlay|onlay/i,                itemId: 'su-inlay-onlay',     label: 'Inlay/Onlay' },
  { re: /veneer/i,                     itemId: 'su-veneer',          label: 'Veneer' },
  { re: /bridge/i,                     itemId: 'br-abutment',        label: 'Bridge (Abutment)' },
  { re: /crown/i,                      itemId: 'su-crown',           label: 'Crown' },
];

const MATERIAL_KEYWORDS: { re: RegExp; value: string; confidence: number }[] = [
  { re: /e\.?\s?max|lithium\s+disilicate/i, value: 'Lithium Disilicate (e.max)',        confidence: 95 },
  { re: /zirconia/i,                        value: 'Zirconia',                           confidence: 95 },
  { re: /pfm|porcelain\s+fused/i,           value: 'Porcelain Fused to Metal (PFM)',     confidence: 92 },
  { re: /full\s+cast|cast\s+metal/i,        value: 'Full Cast Metal',                    confidence: 75 },
  { re: /composite/i,                       value: 'Composite Resin',                    confidence: 88 },
  { re: /acrylic/i,                         value: 'Acrylic',                            confidence: 88 },
];

// Words that can start with a capital in a case sentence but are never a
// patient name — used by the last-resort capitalised-pair fallback.
const NAME_STOPWORDS = new Set([
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
  'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'crown', 'veneer', 'bridge', 'aligner', 'aligners', 'retainer', 'retainers',
  'denture', 'night', 'guard', 'splint', 'whitening', 'tray', 'inlay', 'onlay',
  'emax', 'zirconia', 'acrylic', 'composite', 'porcelain', 'lithium', 'shade',
  'nhs', 'private', 'upper', 'lower', 'bite', 'scan', 'smile', 'genius',
  'deliver', 'delivery', 'patient', 'tooth', 'teeth',
]);

export function extractCaseEntities(text: string, today: Date = new Date()): ExtractedCase {
  const result: ExtractedCase = {};
  if (!text || !text.trim()) return result;
  let work = text;

  // ── 1. Delivery date (masked) ──────────────────────────────────────────────
  {
    // Compare date-only: "by 12 Aug" typed ON 12 Aug means today, not next year.
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const kw = '(?:by|due|deliver(?:y|ed)?(?:\\s+by)?|needed?(?:\\s+by)?)';
    const patterns: { re: RegExp; parse: (m: RegExpMatchArray) => Date | null; kwGroup: boolean }[] = [
      // by 2026-08-12 (ISO)
      {
        re: new RegExp(`(${kw}\\s+)?(\\d{4})-(\\d{2})-(\\d{2})`, 'i'),
        parse: m => new Date(Number(m[2]), Number(m[3]) - 1, Number(m[4])),
        kwGroup: true,
      },
      // by 12 Aug / 12th August
      {
        re: new RegExp(`(${kw}\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*`, 'i'),
        parse: m => {
          const day = Number(m[2]);
          const month = MONTHS[m[3].toLowerCase().slice(0, 3)];
          if (day < 1 || day > 31) return null;
          const d = new Date(today.getFullYear(), month, day);
          if (d < todayMid) d.setFullYear(d.getFullYear() + 1); // next occurrence
          return d;
        },
        kwGroup: true,
      },
      // by Aug 12
      {
        re: new RegExp(`(${kw}\\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'),
        parse: m => {
          const day = Number(m[3]);
          const month = MONTHS[m[2].toLowerCase().slice(0, 3)];
          if (day < 1 || day > 31) return null;
          const d = new Date(today.getFullYear(), month, day);
          if (d < todayMid) d.setFullYear(d.getFullYear() + 1);
          return d;
        },
        kwGroup: true,
      },
      // by 12/08 (UK day/month) — keyword REQUIRED so bare fractions don't match
      {
        re: new RegExp(`(${kw}\\s+)(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?`, 'i'),
        parse: m => {
          const day = Number(m[2]);
          const month = Number(m[3]) - 1;
          if (day < 1 || day > 31 || month < 0 || month > 11) return null;
          const year = m[4] ? (Number(m[4]) < 100 ? 2000 + Number(m[4]) : Number(m[4])) : today.getFullYear();
          const d = new Date(year, month, day);
          if (!m[4] && d < todayMid) d.setFullYear(d.getFullYear() + 1);
          return d;
        },
        kwGroup: true,
      },
    ];
    for (const p of patterns) {
      const m = work.match(p.re);
      if (!m || m.index == null) continue;
      const date = p.parse(m);
      if (!date || isNaN(date.getTime())) continue;
      result.deliveryISO = { value: toISO(date), confidence: m[1] ? 92 : 70 };
      work = mask(work, m.index, m[0].length);
      break;
    }
  }

  // ── 2. Shade (masked) ──────────────────────────────────────────────────────
  {
    const shadeToken = '(A[1-4]|A3\\.5|B[1-4]|C[1-4]|D[2-4]|BL[1-4])';
    const prefixed = work.match(new RegExp(`shade\\s*:?\\s*${shadeToken}\\b`, 'i'));
    const bare = prefixed ? null : work.match(new RegExp(`(?<![\\dA-Za-z])${shadeToken}(?![\\d.])`, ''));
    const m = prefixed ?? bare;
    if (m && m.index != null) {
      const token = m[1].toUpperCase();
      if (TOOTH_SHADES.includes(token)) {
        result.shade = { value: token, confidence: prefixed ? 96 : 72 };
        work = mask(work, m.index, m[0].length);
      }
    }
  }

  // ── 3. Material (not masked — "emax" can also imply the service) ──────────
  for (const mat of MATERIAL_KEYWORDS) {
    if (mat.re.test(work)) {
      result.material = { value: mat.value, confidence: mat.confidence };
      break;
    }
  }

  // ── 4. Service — leftmost explicit keyword wins ────────────────────────────
  {
    let best: { index: number; itemId: string; label: string } | null = null;
    for (const svc of SERVICE_KEYWORDS) {
      const m = work.match(svc.re);
      if (m && m.index != null && (best === null || m.index < best.index)) {
        best = { index: m.index, itemId: svc.itemId, label: svc.label };
      }
    }
    if (best) {
      result.service = { itemId: best.itemId, label: best.label, confidence: 95 };
    } else if (result.material) {
      // A restorative material with no service noun ("emax on 26") most
      // plausibly means a crown — inferred, lower confidence.
      result.service = { itemId: 'su-crown', label: 'Crown', confidence: 78 };
    }
  }

  // ── 5. Teeth ───────────────────────────────────────────────────────────────
  {
    const codes: string[] = [];
    let confidence = 0;
    // Cued list: "on 24, 25 and 26" / "tooth 26" / "for 14-16"
    const cued = work.match(/(?:\bon|\btooth|\bteeth|\bfor)\s+((?:[1-4][1-8])(?:\s*(?:,|and|&|-|\s)\s*[1-4][1-8])*)/i);
    if (cued) {
      const listStr = cued[1];
      const nums = listStr.match(/[1-4][1-8]/g) ?? [];
      // Expand simple ranges like "14-16" (adjacent pair joined by '-')
      const rangeM = listStr.match(/([1-4][1-8])\s*-\s*([1-4][1-8])/);
      const expanded = new Set(nums.map(Number));
      if (rangeM) {
        const [a, b] = [Number(rangeM[1]), Number(rangeM[2])];
        if (Math.floor(a / 10) === Math.floor(b / 10) && b > a) {
          for (let n = a; n <= b; n++) expanded.add(n);
        }
      }
      expanded.forEach(n => { const c = fdiToCode(n); if (c) codes.push(c); });
      confidence = 95;
    }
    // Direct in-app codes: UL6, UR4…
    if (codes.length === 0) {
      const direct = work.match(/\b(U[RL]|L[RL])\s?([1-8])\b/gi) ?? [];
      for (const d of direct) codes.push(d.replace(/\s/g, '').toUpperCase());
      if (codes.length) confidence = 95;
    }
    if (codes.length) {
      result.teeth = { codes: [...new Set(codes)], confidence };
    }
  }

  // ── 6. Order type ──────────────────────────────────────────────────────────
  if (/\bNHS\b/i.test(work)) result.orderType = { value: 'NHS', confidence: 97 };
  else if (/\bprivate\b/i.test(work)) result.orderType = { value: 'Private', confidence: 90 };

  // ── 7. Patient name ────────────────────────────────────────────────────────
  {
    const namePart = "[A-Z][a-z'’-]+";
    const explicit = work.match(new RegExp(`patient\\s*:?\\s*((?:${namePart}\\s+){1,2}${namePart})`));
    const forName = explicit ? null : work.match(new RegExp(`\\bfor\\s+(${namePart}\\s+${namePart})\\b`));
    let value: string | undefined;
    let confidence = 0;
    if (explicit) { value = explicit[1]; confidence = 95; }
    else if (forName) { value = forName[1]; confidence = 78; }
    else {
      // Last resort: first capitalised pair that isn't case vocabulary.
      const pairs = work.match(new RegExp(`\\b${namePart}\\s+${namePart}\\b`, 'g')) ?? [];
      for (const p of pairs) {
        const words = p.toLowerCase().split(/\s+/);
        if (words.every(w => !NAME_STOPWORDS.has(w))) { value = p; confidence = 65; break; }
      }
    }
    if (value && value.split(/\s+/).every(w => !NAME_STOPWORDS.has(w.toLowerCase()))) {
      result.patientName = { value, confidence };
    }
  }

  return result;
}
