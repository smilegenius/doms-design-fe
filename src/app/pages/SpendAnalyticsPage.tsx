import { useState, useEffect, useRef } from 'react';
import {
  FileText, Zap, BarChart3, ShieldCheck,
  AlertTriangle, TrendingUp, TrendingDown, Building2,
  Users, UserCheck, ChevronRight, ArrowUpRight, Calendar, X,
  CheckCircle2, Send, XCircle, Download,
  Sparkles, PiggyBank, ChevronDown, ArrowRight,
} from 'lucide-react';
import { INVOICES } from './InvoicesPage';
import { mockCases } from './CasesPage';
import { AiSparkle } from '../components/AiSparkle';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { useToast } from '../context/ToastContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

// KPIs — pipeline-focused: received → approved → extracted → not approved
const KPI = {
  totalInvoices:  148,  // received
  approved:       89,
  extracted:      14,   // exported for payment
  notApproved:    6,    // rejected/disputed
  // Left-over = invoices still un-approved past the pay-period extraction date
  // (e.g. invoice arrived before the 25th but wasn't approved in time)
  leftOver:       18,
  leftOverAmount: 14620,
  extractionDay:  '25th',
};

// Invoice pipeline by status — sorted high → low by count so the chart reads
// as a clean descending ranking. Palette stays green-leads (green for the
// biggest bar, down to red) regardless of which status that is.
const PIPELINE = [
  { label: 'Approved',             count: 89, color: '#34D399' },  // green-400
  { label: 'Payment Processed',    count: 21, color: '#4D8EF7' },  // brand blue
  { label: 'Awaiting Approval',    count: 18, color: '#A59DFF' },  // brand purple
  { label: 'Exported for Payment', count: 14, color: '#FB923C' },  // orange-400
  { label: 'Disputed',             count: 6,  color: '#F87171' },  // red-400
];
const PIPELINE_MAX = Math.max(...PIPELINE.map(p => p.count));

// Score distribution — low-score buckets carry supplier names for hover tooltip
const SCORE_DIST: { range: string; count: number; suppliers?: string[] }[] = [
  { range: '0–19',  count: 3,  suppliers: ['FreshSmile Supplies', 'Unverified Vendor Ltd', 'New Dental Co'] },
  { range: '20–39', count: 8,  suppliers: ['Medit Ireland', 'Dental Direct UK', 'Euro Pharma', 'SmileBright Ltd', 'UK Lab Services', 'Global Dent', 'ArtSmile', 'ProDent UK'] },
  { range: '40–59', count: 14, suppliers: ['Straumann UK', 'Planmeca', 'Carestream Dental', 'GC Corp', 'Kerr Dental', 'Kulzer GmbH', 'Shofu', 'SDI Ltd', 'Ultradent', 'Coltene', 'BISCO Inc', 'Patterson NI', 'EMS Dental', 'Dentsply IE'] },
  { range: '60–79', count: 31 },
  { range: '80–100',count: 92 },
];
const SCORE_MAX = Math.max(...SCORE_DIST.map(s => s.count));

// Invoices needing attention, grouped by supplier. Counts roll up to the
// "Not Approved" (6) and "Deferred to Next Cycle" (18) KPIs above — so the
// team can see which suppliers the stuck invoices belong to.
const NOT_APPROVED_BY_SUPPLIER: { supplier: string; count: number }[] = [
  { supplier: 'FreshSmile Supplies', count: 3 },
  { supplier: 'DD Group',            count: 2 },
  { supplier: 'Eurodontic Ltd',      count: 1 },
];
const DEFERRED_BY_SUPPLIER: { supplier: string; count: number }[] = [
  { supplier: 'Dentsply Sirona',     count: 6 },
  { supplier: 'Eurodontic Ltd',      count: 5 },
  { supplier: 'Medit Ireland',       count: 4 },
  { supplier: 'FreshSmile Supplies', count: 2 },
  { supplier: 'New Dental Co',       count: 1 },
];

// Suppliers whose invoices carry active flags — grouped by source so the
// team chases the supplier, not individual documents. `flagged` of `total`
// invoices this period; `worst` is the highest severity among the flags.
const SUPPLIER_ISSUES = [
  { supplier: 'FreshSmile Supplies', flagged: 5, total: 12, worst: 'Critical', flags: ['Duplicate Invoice', 'Supplier Not Approved'] },
  { supplier: 'Eurodontic Ltd',      flagged: 3, total: 18, worst: 'High',     flags: ['Amount Above Norm', 'PO Number Missing'] },
  { supplier: 'Dentsply Sirona',     flagged: 2, total: 31, worst: 'High',     flags: ['High-value — dual sign-off'] },
  { supplier: 'Medit Ireland',       flagged: 2, total: 9,  worst: 'Medium',   flags: ['VAT Number Missing'] },
  { supplier: 'New Dental Co',       flagged: 1, total: 4,  worst: 'Medium',   flags: ['Dentist Mismatch'] },
];

// Monthly spend by category (last 6 months)
const SPEND_CATEGORIES = [
  // Shared 5-color dashboard palette, green-led order.
  // Sequence: Green · Blue · Purple · Orange · Red · Light Green.
  { key: 'clinical',   label: 'Clinical',          color: '#34D399' },  // green-400
  { key: 'equipment',  label: 'Equipment',         color: '#4D8EF7' },  // brand blue
  { key: 'dentalLabs', label: 'Dental Labs',       color: '#A59DFF' },  // brand purple
  { key: 'implants',   label: 'Implant Suppliers', color: '#FB923C' },  // orange-400
  { key: 'software',   label: 'Software',          color: '#F87171' },  // red-400
  { key: 'raw',        label: 'Raw Materials',     color: '#6EE7B7' },  // emerald-300 (light green)
] as const;

const MONTHLY_SPEND = [
  { month: 'Dec', clinical: 5800,  equipment: 4200, dentalLabs: 6200, implants: 2400, software: 1400, raw: 1300 },
  { month: 'Jan', clinical: 6400,  equipment: 4900, dentalLabs: 7100, implants: 2800, software: 1500, raw: 1100 },
  { month: 'Feb', clinical: 6100,  equipment: 5300, dentalLabs: 5900, implants: 2600, software: 1700, raw: 1400 },
  { month: 'Mar', clinical: 7200,  equipment: 5900, dentalLabs: 7800, implants: 3100, software: 1600, raw: 1400 },
  { month: 'Apr', clinical: 6800,  equipment: 5100, dentalLabs: 6950, implants: 2700, software: 1500, raw: 650  },
  { month: 'May', clinical: 4500,  equipment: 3300, dentalLabs: 4600, implants: 1900, software: 1100, raw: 900  },
];
const SPEND_MAX = Math.max(...MONTHLY_SPEND.map(m =>
  m.clinical + m.equipment + m.dentalLabs + m.implants + m.software + m.raw
));

// Spend by clinic — full list (12 clinics); display is capped at 10 in UI with PDF for all
const SPEND_BY_CLINIC = [
  // Shared dashboard palette — green leads. Order: Green · Blue · Purple · Orange · Red,
  // then lighter variants of each in the same order.
  { name: 'Belfast',            value: 32400, color: '#34D399' },  // green-400
  { name: 'Manchester',         value: 27800, color: '#4D8EF7' },  // brand blue
  { name: 'London Central',     value: 24100, color: '#A59DFF' },  // brand purple
  { name: 'Birmingham 1',       value: 19600, color: '#FB923C' },  // orange-400
  { name: 'Leeds',              value: 16800, color: '#F87171' },  // red-400
  { name: 'Dublin',             value: 13400, color: '#6EE7B7' },  // emerald-300 (light green)
  { name: 'Glasgow',            value: 11200, color: '#93C5FD' },  // blue-300 (light blue)
  { name: 'Cardiff',            value:  8900, color: '#C4B5FD' },  // purple-300 (light purple)
  { name: 'Birmingham 2',       value:  7600, color: '#FDBA74' },  // orange-300 (light orange)
  { name: 'Edinburgh',          value:  5800, color: '#FCA5A5' },  // red-300 (light red)
  { name: 'Liverpool',          value:  4200, color: '#A7F3D0' },  // emerald-200 (soft green)
  { name: 'Bristol',            value:  3120, color: '#BFDBFE' },  // blue-200 (soft blue)
];
const SPEND_BY_CLINIC_DISPLAY = SPEND_BY_CLINIC.slice(0, 10);

const GL_CATEGORIES = [
  { label: 'Lab & Prosthetics',    amount: 41200, pct: 38 },
  { label: 'Consumables',          amount: 29800, pct: 27 },
  { label: 'Equipment & Repairs',  amount: 18700, pct: 17 },
  { label: 'Sterilisation',        amount: 9400,  pct: 9  },
  { label: 'PPE & Infection Ctrl', amount: 6200,  pct: 6  },
  { label: 'Other',                amount: 3400,  pct: 3  },
];

// Category spend (Suppliers tab — donut/bar chart)
const CATEGORY_SPEND = [
  // Shared dashboard palette — green leads. Order: Green · Blue · Purple · Orange · Red · Light Green.
  { label: 'Dental Labs',        amount: 38800, color: '#34D399' },  // green-400
  { label: 'Clinical',           amount: 26400, color: '#4D8EF7' },  // brand blue
  { label: 'Equipment',          amount: 22300, color: '#A59DFF' },  // brand purple
  { label: 'Implant Suppliers',  amount: 10400, color: '#FB923C' },  // orange-400
  { label: 'Software',           amount: 6800,  color: '#F87171' },  // red-400
  { label: 'Raw Materials',      amount: 4000,  color: '#6EE7B7' },  // emerald-300 (light green)
];

// Colors for top suppliers donut/legend
// Shared dashboard palette — green leads. Order: Green · Blue · Purple · Orange · Red · Light Green.
const TOP_SUPPLIER_COLORS = ['#34D399', '#4D8EF7', '#A59DFF', '#FB923C', '#F87171', '#6EE7B7'];

// Top suppliers
const TOP_SUPPLIERS = [
  { name: 'Dentsply Sirona',        category: 'Non-Lab', invoices: 14, spend: 24600, trend: 'up'   },
  { name: 'Henry Schein Dental',    category: 'Non-Lab', invoices: 22, spend: 18900, trend: 'down' },
  { name: 'Kingsbridge Dental Lab', category: 'Lab',     invoices: 31, spend: 16200, trend: 'up'   },
  { name: 'Patterson Dental UK',    category: 'Non-Lab', invoices: 18, spend: 14100, trend: 'up'   },
  { name: 'Eurodontic Ltd',         category: 'Lab',     invoices: 12, spend: 11800, trend: 'down' },
  { name: 'Smile Ceramics Studio',  category: 'Lab',     invoices: 27, spend: 9200,  trend: 'up'   },
];

// ─── Severity badge ────────────────────────────────────────────────────────────
function SeverityBadge({ s }: { s: string }) {
  const cls =
    s === 'Critical' ? 'bg-[#FFF1F2] text-[#D4183D]' :
    s === 'High'     ? 'bg-[#FFF7ED] text-[#E65100]' :
                       'bg-[#FFF7ED] text-[#E65100]';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
}

// ─── Per-supplier count list ──────────────────────────────────────────────────
// A mini horizontal-bar ranking: suppliers sorted by how many of their invoices
// are not-approved / deferred, each row a proportional tinted bar. Rows are
// clickable (→ that supplier's filtered invoices); the list caps at `maxVisible`
// with a "View all" footer that opens the full filtered list. Empty → "all clear".
function SupplierCountSection({ title, total, items, tone, icon, maxVisible = 4, onSelect, onViewAll }: {
  title: string;
  total: number;
  items: { supplier: string; count: number }[];
  tone: 'red' | 'amber';
  icon: React.ReactNode;
  maxVisible?: number;
  onSelect: (supplier: string) => void;
  onViewAll: () => void;
}) {
  const p = tone === 'red'
    ? { text: '#D4183D', soft: '#FFF1F2', border: '#FECACA', track: '#FEE2E2', barFrom: '#F87171', barTo: '#FB7185' }
    : { text: '#C2410C', soft: '#FFF7ED', border: '#FED7AA', track: '#FFEDD5', barFrom: '#FB923C', barTo: '#F59E0B' };
  const max = Math.max(1, ...items.map(i => i.count));
  const ranked = [...items].sort((a, b) => b.count - a.count);
  const visible = ranked.slice(0, maxVisible);
  const hiddenCount = ranked.length - visible.length;
  const empty = ranked.length === 0 || total === 0;
  return (
    <div>
      {/* Section header — icon chip + title + total */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: p.soft, color: p.text }}>
            {icon}
          </span>
          <p className="text-xs font-bold text-[#030213] truncate">{title}</p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums whitespace-nowrap flex-shrink-0"
          style={{ background: p.soft, color: p.text, borderColor: p.border }}
        >
          {total} invoice{total === 1 ? '' : 's'}
        </span>
      </div>
      {empty ? (
        <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
          <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0" />
          <span className="text-xs text-[#15803D] font-medium">All clear — none right now</span>
        </div>
      ) : (
        <>
          <div className="space-y-0.5">
            {visible.map((s, i) => {
              const pct = Math.round((s.count / max) * 100);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(s.supplier)}
                  title={`View ${s.supplier}'s ${title.toLowerCase()} invoices`}
                  className="group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                    style={{ background: p.soft, color: p.text }}
                  >
                    {s.supplier.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#030213] truncate group-hover:text-[#1565C0] transition-colors">{s.supplier}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-sm font-bold tabular-nums" style={{ color: p.text }}>{s.count}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#C8C8D0] group-hover:text-[#4D8EF7] transition-colors" />
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: p.track }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${p.barFrom}, ${p.barTo})` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {/* View-all — opens the full filtered list (covers overflow too) */}
          <button
            type="button"
            onClick={onViewAll}
            className="w-full mt-1.5 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] hover:bg-[#EEF4FF] transition-colors"
          >
            {hiddenCount > 0 ? `View all ${ranked.length} suppliers` : 'View all in Invoices'}
            <ChevronRight className="w-3 h-3" />
          </button>
        </>
      )}
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, alert, accent = '#4D8EF7', onClick }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; alert?: boolean; accent?: string;
  onClick?: () => void;
}) {
  const color = alert ? '#D4183D' : accent;
  const baseClasses = `bg-white rounded-lg border p-3 transition-all w-full text-left ${alert ? 'border-[#FECACA]' : 'border-[#E0E0E6]'} ${onClick ? 'cursor-pointer hover:shadow-md hover:border-current' : ''}`;
  const inner = (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-[#717182] mb-1">{label}</div>
        <div className={`text-xl font-semibold ${alert ? 'text-[#D4183D]' : 'text-[#030213]'}`}>{value}</div>
        {sub && <div className={`text-[10px] mt-0.5 ${alert ? 'text-[#D4183D]' : 'text-[#A0A0B0]'}`}>{sub}</div>}
      </div>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: color + '1A' }}
      >
        {icon}
      </div>
    </div>
  );
  return onClick ? (
    <button onClick={onClick} className={baseClasses} style={alert ? { color: '#D4183D' } : undefined}>{inner}</button>
  ) : (
    <div className={baseClasses}>{inner}</div>
  );
}

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────
function Donut({ data, size = 180, thickness = 28 }: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F3F5" strokeWidth={thickness} />
      {data.map(d => {
        const len = (d.value / total) * c;
        const seg = (
          <circle
            key={d.label}
            cx={size / 2} cy={size / 2} r={r}
            fill="none"
            stroke={d.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

// ─── Section card wrapper ──────────────────────────────────────────────────────
function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F0EFF6] flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#030213]">{title}</p>
          {subtitle && <p className="text-xs text-[#717182] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0 mt-0.5">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────
type AnalyticsTab = 'intelligence' | 'spend' | 'suppliers' | 'ai';

const TABS: { id: AnalyticsTab; label: string; icon?: React.ReactNode }[] = [
  { id: 'intelligence', label: 'Invoice Intelligence' },
  { id: 'spend',        label: 'Spend' },
  { id: 'suppliers',    label: 'Suppliers' },
  { id: 'ai',           label: 'AI Insights', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

// ─── Period filter ─────────────────────────────────────────────────────────────
const PERIODS = ['Month', 'Quarter', 'Year'];

// ─── AI Insights data ──────────────────────────────────────────────────────────
// Derived once at module scope (INVOICES / mockCases are static mock constants,
// matching how every other dataset on this page is built).

// 1. Purchase catalogue — what clinics & dentists are buying, per supplier.
type CatalogueItem = { description: string; qty: number; unitPrice: number; total: number; buyers: string[] };
type SupplierCatalogue = { supplier: string; categories: string[]; totalSpend: number; buyers: string[]; items: CatalogueItem[] };

function buildCatalogue(): SupplierCatalogue[] {
  const bySupplier = new Map<string, { categories: Set<string>; items: Map<string, CatalogueItem & { buyerSet: Set<string> }> }>();
  for (const inv of INVOICES) {
    if (!inv.supplier?.trim() || !inv.lineItems?.length) continue;
    let entry = bySupplier.get(inv.supplier);
    if (!entry) { entry = { categories: new Set(), items: new Map() }; bySupplier.set(inv.supplier, entry); }
    inv.categories.forEach(c => entry!.categories.add(c));
    for (const li of inv.lineItems) {
      // Refunds / statement balances aren't purchasable catalogue items.
      if (li.unitPrice <= 0 || /refund|statement/i.test(li.description)) continue;
      let item = entry.items.get(li.description);
      if (!item) {
        item = { description: li.description, qty: 0, unitPrice: li.unitPrice, total: 0, buyers: [], buyerSet: new Set() };
        entry.items.set(li.description, item);
      }
      item.qty += li.qty;
      item.total += li.total;
      item.unitPrice = li.unitPrice;
      if (inv.billedToName?.trim()) item.buyerSet.add(inv.billedToName);
    }
  }
  return Array.from(bySupplier.entries())
    .map(([supplier, e]) => {
      const items = Array.from(e.items.values())
        .map(({ buyerSet, ...item }) => ({ ...item, buyers: Array.from(buyerSet) }))
        .sort((a, b) => b.total - a.total);
      return {
        supplier,
        categories: Array.from(e.categories),
        totalSpend: items.reduce((s, it) => s + it.total, 0),
        buyers: Array.from(new Set(items.flatMap(it => it.buyers))),
        items,
      };
    })
    .filter(s => s.items.length > 0)
    .sort((a, b) => b.totalSpend - a.totalSpend);
}
const CATALOGUE = buildCatalogue();
const CATALOGUE_ITEM_COUNT = CATALOGUE.reduce((s, c) => s + c.items.length, 0);

// 2. Routing mix — where practices/dentists send their lab work (from cases).
type LabShare = { lab: string; count: number; pct: number; color: string };
type PracticeRouting = { practice: string; total: number; topLab: string; topLabPct: number; segments: LabShare[] };

function buildLabMix(): LabShare[] {
  const counts = new Map<string, number>();
  mockCases.forEach(c => counts.set(c.lab, (counts.get(c.lab) ?? 0) + 1));
  const total = mockCases.length;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lab, count], i) => ({
      lab, count,
      pct: Math.round((count / total) * 100),
      color: TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length],
    }));
}
const LAB_MIX = buildLabMix();

function buildPracticeRouting(): PracticeRouting[] {
  const byPractice = new Map<string, Map<string, number>>();
  mockCases.forEach(c => {
    if (!byPractice.has(c.practice)) byPractice.set(c.practice, new Map());
    const labs = byPractice.get(c.practice)!;
    labs.set(c.lab, (labs.get(c.lab) ?? 0) + 1);
  });
  const labColor = (lab: string) => LAB_MIX.find(l => l.lab === lab)?.color ?? '#E0E0E6';
  return Array.from(byPractice.entries())
    .map(([practice, labs]) => {
      const total = Array.from(labs.values()).reduce((a, b) => a + b, 0);
      const segments = Array.from(labs.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([lab, count]) => ({ lab, count, pct: Math.round((count / total) * 100), color: labColor(lab) }));
      return { practice, total, topLab: segments[0].lab, topLabPct: segments[0].pct, segments };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}
const PRACTICE_ROUTING = buildPracticeRouting();

function buildRoutingInsights(): string[] {
  const insights: string[] = [];
  const topPractice = PRACTICE_ROUTING[0];
  if (topPractice) insights.push(`${topPractice.practice} sends ${topPractice.topLabPct}% of its cases to ${topPractice.topLab}.`);
  const topLab = LAB_MIX[0];
  if (topLab) insights.push(`${topLab.lab} handles ${topLab.pct}% of all lab work across the group — your biggest routing dependency.`);
  // Busiest dentist and where their work goes.
  const byDentist = new Map<string, Map<string, number>>();
  mockCases.forEach(c => {
    if (!byDentist.has(c.dentist)) byDentist.set(c.dentist, new Map());
    const labs = byDentist.get(c.dentist)!;
    labs.set(c.lab, (labs.get(c.lab) ?? 0) + 1);
  });
  const dentists = Array.from(byDentist.entries())
    .map(([dentist, labs]) => {
      const total = Array.from(labs.values()).reduce((a, b) => a + b, 0);
      const [lab, count] = Array.from(labs.entries()).sort((a, b) => b[1] - a[1])[0];
      return { dentist, total, lab, pct: Math.round((count / total) * 100) };
    })
    .sort((a, b) => b.total - a.total);
  if (dentists[0]) insights.push(`${dentists[0].dentist} routes ${dentists[0].pct}% of ${dentists[0].total} cases to ${dentists[0].lab}.`);
  return insights;
}
const ROUTING_INSIGHTS = buildRoutingInsights();

// 3. Savings recommendations — curated per-unit benchmarks vs. catalogue prices.
//    Every £ figure is derived (qty × price delta) so cards stay internally
//    consistent; only the alternative unit prices are curated.
type Benchmark = { match: RegExp; altSupplier: string; altKind: 'lab' | 'supplier'; altUnitPrice: number };
const PRICE_BENCHMARKS: Benchmark[] = [
  { match: /full ceramic crown/i,      altSupplier: 'Smile Genius Lab',     altKind: 'lab',      altUnitPrice: 79.50 },
  { match: /zirconia bridge/i,         altSupplier: 'Smile Genius Lab',     altKind: 'lab',      altUnitPrice: 118.00 },
  { match: /implant crown pfm/i,       altSupplier: 'Smile Genius Lab',     altKind: 'lab',      altUnitPrice: 185.00 },
  { match: /nightguard splint/i,       altSupplier: 'Smile Genius Lab',     altKind: 'lab',      altUnitPrice: 188.50 },
  { match: /composite resin/i,         altSupplier: 'Henry Schein Dental',  altKind: 'supplier', altUnitPrice: 84.00 },
  { match: /sterilisation pouches/i,   altSupplier: 'Henry Schein Dental',  altKind: 'supplier', altUnitPrice: 96.00 },
  { match: /gloves nitrile/i,          altSupplier: 'Henry Schein Dental',  altKind: 'supplier', altUnitPrice: 255.00 },
  { match: /implant abutments/i,       altSupplier: 'Eurodontic Ltd',       altKind: 'lab',      altUnitPrice: 192.00 },
  { match: /healing caps/i,            altSupplier: 'Eurodontic Ltd',       altKind: 'lab',      altUnitPrice: 57.00 },
];

type SavingsRow = { description: string; qty: number; currentSupplier: string; currentUnit: number; altUnit: number; saving: number };
type Recommendation = { altSupplier: string; altKind: 'lab' | 'supplier'; rows: SavingsRow[]; monthlySaving: number; annualSaving: number };

function buildRecommendations(): Recommendation[] {
  const byAlt = new Map<string, Recommendation>();
  for (const sup of CATALOGUE) {
    for (const item of sup.items) {
      const bm = PRICE_BENCHMARKS.find(b => b.match.test(item.description) && item.unitPrice > b.altUnitPrice);
      if (!bm || bm.altSupplier === sup.supplier) continue;
      let rec = byAlt.get(bm.altSupplier);
      if (!rec) { rec = { altSupplier: bm.altSupplier, altKind: bm.altKind, rows: [], monthlySaving: 0, annualSaving: 0 }; byAlt.set(bm.altSupplier, rec); }
      const saving = +(item.qty * (item.unitPrice - bm.altUnitPrice)).toFixed(2);
      rec.rows.push({
        description: item.description, qty: item.qty,
        currentSupplier: sup.supplier, currentUnit: item.unitPrice,
        altUnit: bm.altUnitPrice, saving,
      });
      rec.monthlySaving = +(rec.monthlySaving + saving).toFixed(2);
    }
  }
  return Array.from(byAlt.values())
    .map(r => ({ ...r, annualSaving: Math.round(r.monthlySaving * 12) }))
    .sort((a, b) => b.annualSaving - a.annualSaving);
}
const RECOMMENDATIONS = buildRecommendations();
const TOTAL_ANNUAL_SAVINGS = RECOMMENDATIONS.reduce((s, r) => s + r.annualSaving, 0);

// ─── AI Insights components ─────────────────────────────────────────────────────

// Accordion row: one supplier's purchased-item catalogue.
function SupplierCatalogueRow({ data, color, defaultOpen = false }: { data: SupplierCatalogue; color: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#E0E0E6] rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-[#F8F9FC] transition-colors text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-sm font-semibold text-[#030213] truncate">{data.supplier}</span>
          <span className="hidden sm:flex items-center gap-1">
            {data.categories.slice(0, 2).map(c => (
              <span key={c} className="text-[10px] px-1.5 py-px rounded-full bg-[#F3F3F5] text-[#717182]">{c}</span>
            ))}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-[#717182]">
            {data.items.length} {data.items.length === 1 ? 'item' : 'items'} · <span className="font-bold text-[#030213]">{fmt(data.totalSpend)}</span>
          </span>
          <span className="hidden sm:inline text-[10px] text-[#A0A0B0]">
            {data.buyers.length} {data.buyers.length === 1 ? 'buyer' : 'buyers'}
          </span>
          <ChevronDown className={`w-4 h-4 text-[#717182] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {/* Item table scrolls inside a capped height so one expanded supplier
          never balloons the catalogue card; the header row stays pinned. */}
      {open && (
        <div className="border-t border-[#F0EFF6] px-4 pb-3 max-h-44 overflow-y-auto">
          {/* Top padding lives on the sticky header (not the container) so
              rows can't peek through above it while scrolling. */}
          <div className="sticky top-0 z-10 bg-white grid grid-cols-[1.8fr_auto_auto_auto] gap-3 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest pt-3 pb-2 border-b border-[#F0EFF6]">
            <span>Item</span>
            <span className="text-right w-10">Qty</span>
            <span className="text-right w-16">Unit</span>
            <span className="text-right w-20">Total</span>
          </div>
          {data.items.map(item => (
            <div key={item.description} className="grid grid-cols-[1.8fr_auto_auto_auto] gap-3 py-2.5 border-b border-[#F8F8F8] last:border-b-0 items-start">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#030213] break-words">{item.description}</p>
                {item.buyers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.buyers.map(b => (
                      <span key={b} className="text-[10px] px-1.5 py-px rounded-full bg-[#F3F3F5] text-[#717182]">{b}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-[#717182] text-right w-10 tabular-nums">{item.qty}</span>
              <span className="text-xs text-[#717182] text-right w-16 tabular-nums">{fmt(item.unitPrice)}</span>
              <span className="text-xs font-bold text-[#030213] text-right w-20 tabular-nums">{fmt(item.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// One AI savings suggestion inside the hero card — a slim collapsed row
// ("move N items to X → save £Y/yr") that expands into the per-item price
// comparison. Collapsed by default so the hero reads at a glance.
function SavingsSuggestionRow({ rec, defaultOpen = false }: { rec: Recommendation; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  // Demo accept flow — no backend, so "accepting" marks the row and toasts.
  // Accepting first asks for confirmation because the switch applies to every
  // clinic in the group, not just the practice that raised the purchases.
  const [accepted, setAccepted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  function confirmAccept() {
    setAccepted(true);
    setConfirmOpen(false);
    toast.success(`Recommendation accepted for all clinics — est. ${fmt(rec.annualSaving)}/yr saving`);
  }
  return (
    <div className="bg-white border border-[#D9EFDE] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#FAFDF9] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#E7F6EC] flex items-center justify-center flex-shrink-0">
            <PiggyBank className="w-3.5 h-3.5 text-[#2E7D32]" />
          </span>
          <p className="text-xs text-[#5A5568] truncate">
            Move <span className="font-semibold text-[#030213]">{rec.rows.length} {rec.rows.length === 1 ? 'item' : 'items'}</span> to{' '}
            <span className="font-semibold text-[#030213]">{rec.altSupplier}</span>
            <span className="hidden sm:inline text-[#A0A0B0]"> · {rec.altKind}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {accepted && (
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#E7F6EC] text-[#2E7D32] border border-[#C6E9CE]">
              <CheckCircle2 className="w-3 h-3" />
              Accepted
            </span>
          )}
          <span className="text-sm font-bold text-[#2E7D32] tabular-nums">{fmt(rec.annualSaving)}<span className="text-[10px] font-semibold text-[#7BAE85]">/yr</span></span>
          <ChevronDown className={`w-4 h-4 text-[#A0A0B0] transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {open && (
        <>
          {/* Item list scrolls inside a capped height so an expanded tile
              never balloons the hero card; the footer stays pinned below. */}
          <div className="border-t border-[#F0EFF6] px-4 py-1.5 max-h-44 overflow-y-auto">
            {rec.rows.map(row => (
              <div key={row.description} className="flex items-center justify-between gap-3 py-2.5 border-b border-[#F8F8F8] last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#030213] truncate">{row.description}</p>
                  <p className="text-[10px] text-[#A0A0B0] mt-0.5">Qty {row.qty} · currently {row.currentSupplier}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 text-xs tabular-nums">
                  <span className="text-[#A0A0B0] line-through">{fmt(row.currentUnit)}</span>
                  <ArrowRight className="w-3 h-3 text-[#A0A0B0]" />
                  <span className="font-semibold text-[#2E7D32]">{fmt(row.altUnit)}</span>
                </div>
                <span className="text-xs font-bold text-[#2E7D32] w-20 text-right tabular-nums flex-shrink-0">−{fmt(row.saving)}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[#F0EFF6] flex items-center justify-between gap-3">
            <span className="text-[11px] text-[#717182]">{fmt(rec.monthlySaving)}/mo at current run-rate</span>
            {accepted ? (
              <span className="inline-flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold text-[#2E7D32]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accepted — procurement notified
                </span>
                <button
                  onClick={() => setAccepted(false)}
                  className="text-[11px] text-[#717182] underline hover:text-[#030213]"
                >
                  Undo
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                Accept recommendation
              </button>
            )}
          </div>
        </>
      )}

      {/* Confirmation — the switch applies group-wide, so spell that out
          before committing. */}
      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Apply to all clinics?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmAccept}>Confirm for all clinics</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[#5A5568]">
            This moves <span className="font-semibold text-[#030213]">{rec.rows.length} {rec.rows.length === 1 ? 'item' : 'items'}</span> to{' '}
            <span className="font-semibold text-[#030213]">{rec.altSupplier}</span> for{' '}
            <span className="font-semibold text-[#030213]">every clinic in your group</span> — future orders across all
            practices will use the new supplier.
          </p>
          <div className="rounded-lg bg-[#E7F6EC] border border-[#C6E9CE] px-3 py-2.5 flex items-center justify-between gap-3">
            <span className="text-xs text-[#1B5E20]">Estimated saving</span>
            <span className="text-sm font-bold text-[#2E7D32] tabular-nums">
              {fmt(rec.annualSaving)}/yr
              <span className="text-[11px] font-semibold text-[#7BAE85]"> · {fmt(rec.monthlySaving)}/mo</span>
            </span>
          </div>
          <p className="text-[11px] text-[#A0A0B0]">
            Procurement is notified and can revert the switch at any time.
          </p>
        </div>
      </Modal>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function SpendAnalyticsPage({ onNavigateToInvoices }: { onNavigateToInvoices?: (filter?: string, supplier?: string) => void } = {}) {
  const [tab, setTab] = useState<AnalyticsTab>('intelligence');
  // AI Insights — purchasing catalogue shows a handful of suppliers so the
  // card stays level with the savings hero; "See more" reveals the rest.
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [period, setPeriod] = useState('Month');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState('');
  const [draftTo, setDraftTo] = useState('');
  const customRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (customRef.current && !customRef.current.contains(e.target as Node)) setCustomOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function applyCustomRange() {
    if (draftFrom && draftTo && draftFrom <= draftTo) {
      setCustomRange({ from: draftFrom, to: draftTo });
      setPeriod('custom');
      setCustomOpen(false);
    }
  }
  function fmtRangeLabel(r: { from: string; to: string }) {
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
    const from = new Date(r.from).toLocaleDateString('en-GB', opts);
    const to = new Date(r.to).toLocaleDateString('en-GB', { ...opts, year: sameYear ? undefined : 'numeric' });
    return `${from} – ${to}`;
  }

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC]">

      {/* Header */}
      <div className="px-8 pt-8 pb-5 bg-white border-b border-[#F0EFF6]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#030213]">Analytics</h1>
            <p className="text-sm text-[#717182] mt-1">Spend intelligence and procurement insights</p>
          </div>
          {/* Period selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#F3F3F5] rounded-lg p-1">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => { setPeriod(p); setCustomRange(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    period === p ? 'bg-white text-[#030213] shadow-sm' : 'text-[#717182] hover:text-[#030213]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="relative" ref={customRef}>
              <button
                onClick={() => {
                  setDraftFrom(customRange?.from ?? '');
                  setDraftTo(customRange?.to ?? '');
                  setCustomOpen(v => !v);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  period === 'custom'
                    ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#4D8EF7]'
                    : 'border-[#E0E0E6] text-[#717182] hover:bg-[#F8F9FC] hover:text-[#030213]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {customRange ? fmtRangeLabel(customRange) : 'Custom'}
                {customRange && (
                  <span
                    onClick={e => { e.stopPropagation(); setCustomRange(null); setPeriod('Month'); }}
                    className="ml-1 hover:text-[#C62828]"
                  >
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
              {customOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E0E0E6] rounded-lg shadow-xl p-4 w-72">
                  <p className="text-xs font-semibold text-[#030213] mb-3">Custom Date Range</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-[#717182] uppercase tracking-wide mb-1">From</label>
                      <input
                        type="date"
                        value={draftFrom}
                        max={draftTo || undefined}
                        onChange={e => setDraftFrom(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#E0E0E6] rounded focus:outline-none focus:border-[#4D8EF7]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[#717182] uppercase tracking-wide mb-1">To</label>
                      <input
                        type="date"
                        value={draftTo}
                        min={draftFrom || undefined}
                        onChange={e => setDraftTo(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-[#E0E0E6] rounded focus:outline-none focus:border-[#4D8EF7]"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-4">
                    <button
                      onClick={() => setCustomOpen(false)}
                      className="px-3 py-1.5 text-xs font-medium border border-[#E0E0E6] text-[#717182] rounded-md hover:bg-[#F8F9FC] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCustomRange}
                      disabled={!draftFrom || !draftTo || draftFrom > draftTo}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-md hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mt-5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white shadow-sm'
                  : 'text-[#717182] hover:text-[#030213] hover:bg-[#F3F3F5]'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">{t.icon}{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

        {/* ── INVOICE INTELLIGENCE TAB ── */}
        {tab === 'intelligence' && (
          <>
            {/* KPI row — pipeline outcomes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard accent="#4D8EF7" icon={<FileText className="w-5 h-5 text-[#4D8EF7]" />}      label="Total Invoices Received" value={KPI.totalInvoices} sub={period === 'custom' ? 'custom range' : `this ${period.toLowerCase()}`} />
              <KpiCard accent="#2E7D32" icon={<CheckCircle2 className="w-5 h-5 text-[#2E7D32]" />}  label="Approved"                value={KPI.approved}      sub={`${Math.round((KPI.approved / KPI.totalInvoices) * 100)}% of received`} />
              <KpiCard accent="#1565C0" icon={<Send className="w-5 h-5 text-[#1565C0]" />}          label="Extracted for Payment"   value={KPI.extracted}     sub="moved to AP queue" />
              <KpiCard alert            icon={<XCircle className="w-5 h-5 text-[#D4183D]" />}      label="Not Approved"            value={KPI.notApproved}   sub="rejected or disputed" />
              <KpiCard alert            icon={<AlertTriangle className="w-5 h-5 text-[#E65100]" />} label="Deferred to Next Cycle"  value={KPI.leftOver}      sub={`${fmt(KPI.leftOverAmount)} past ${KPI.extractionDay} extraction`} onClick={() => onNavigateToInvoices?.('left_over')} />
            </div>

            {/* Pipeline + Score distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Invoice Pipeline */}
              <Card title="Invoice Pipeline" subtitle="Invoices by status">
                <div className="space-y-3">
                  {PIPELINE.map(p => (
                    <div key={p.label} className="flex items-center gap-3">
                      <span className="text-xs text-[#717182] w-36 flex-shrink-0 text-right">{p.label}</span>
                      <div className="flex-1 h-6 bg-[#F3F3F5] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500 flex items-center pl-2"
                          style={{ width: `${(p.count / PIPELINE_MAX) * 100}%`, background: p.color }}
                        >
                          {p.count > 5 && (
                            <span className="text-[10px] font-bold text-[#030213]">{p.count}</span>
                          )}
                        </div>
                      </div>
                      {p.count <= 5 && <span className="text-xs font-semibold text-[#030213] w-4">{p.count}</span>}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Match Score Distribution */}
              <Card title="Match Score Distribution" subtitle="Hover low-score bars to see suppliers">
                <div className="flex items-end gap-3 h-32">
                  {SCORE_DIST.map(s => {
                    const isLow = s.suppliers && s.suppliers.length > 0;
                    return (
                      <div key={s.range} className={`relative flex-1 flex flex-col items-center gap-1 ${isLow ? 'group cursor-pointer' : ''}`}>
                        <span className="text-[10px] font-bold text-[#717182]">{s.count}</span>
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${isLow ? 'group-hover:opacity-80 group-hover:ring-2 group-hover:ring-[#F87171]/60' : ''}`}
                          style={{
                            height: `${(s.count / SCORE_MAX) * 96}px`,
                            background: s.range === '80–100' ? '#34D399'  // emerald-400 (soft green)
                              : s.range === '60–79' ? '#4D8EF7'              // brand blue
                              : s.range === '40–59' ? '#FB923C'              // orange-400 (soft amber)
                              : '#F87171',                                    // red-400 (soft red)
                          }}
                        />
                        <span className={`text-[9px] whitespace-nowrap ${isLow ? 'text-[#C62828] font-semibold' : 'text-[#A0A0B0]'}`}>{s.range}</span>
                        {/* Hover tooltip — only on low-score bars */}
                        {isLow && (
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 hidden group-hover:flex flex-col min-w-[160px] max-w-[200px] bg-[#1E1E2E] text-white rounded-xl shadow-xl overflow-hidden pointer-events-none">
                            <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-[#F87171] flex-shrink-0" />
                              <span className="text-[10px] font-bold text-[#F87171] uppercase tracking-wider">{s.range} score — {s.count} invoice{s.count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="px-3 py-2 space-y-1">
                              <p className="text-[9px] text-white/50 uppercase tracking-wider font-semibold mb-1.5">Suppliers affected</p>
                              {s.suppliers!.map((name, ni) => (
                                <div key={ni} className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F87171] flex-shrink-0" />
                                  <span className="text-[10px] text-white/90 leading-tight truncate">{name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Needs-attention-by-supplier + Suppliers With Issues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Not Approved + Deferred, grouped by supplier — each row is a
                  supplier with a count of stuck invoices. Counts roll up to the
                  Not Approved / Deferred KPIs above. */}
              <Card
                title="By Supplier — Action Needed"
                subtitle="Not-approved and deferred invoices, grouped by supplier"
                action={
                  <button
                    onClick={() => onNavigateToInvoices?.('left_over')}
                    className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5"
                  >
                    View unpaid <ChevronRight className="w-3 h-3" />
                  </button>
                }
              >
                {/* Two sections side-by-side so the card stays compact instead
                    of stacking into a tall column. Divider between on sm+. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-0 sm:divide-x sm:divide-[#F0EFF6]">
                  <div className="sm:pr-4">
                    <SupplierCountSection
                      title="Not Approved"
                      total={KPI.notApproved}
                      items={NOT_APPROVED_BY_SUPPLIER}
                      tone="red"
                      icon={<XCircle className="w-3.5 h-3.5" />}
                      onSelect={(supplier) => onNavigateToInvoices?.('not_approved', supplier)}
                      onViewAll={() => onNavigateToInvoices?.('not_approved')}
                    />
                  </div>
                  <div className="sm:pl-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-[#F0EFF6]">
                    <SupplierCountSection
                      title="Deferred to Next Cycle"
                      total={KPI.leftOver}
                      items={DEFERRED_BY_SUPPLIER}
                      tone="amber"
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      onSelect={(supplier) => onNavigateToInvoices?.('left_over', supplier)}
                      onViewAll={() => onNavigateToInvoices?.('left_over')}
                    />
                  </div>
                </div>
              </Card>

              {/* Suppliers With Issues — flagged invoices grouped by the
                  supplier they came from, worst severity first. Each row opens
                  that supplier's invoices; footer opens the full flagged queue. */}
              <Card
                title="Suppliers With Issues"
                subtitle="Invoices from these suppliers have active flags"
                action={
                  <button
                    onClick={() => onNavigateToInvoices?.('low_confidence')}
                    className="text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] inline-flex items-center gap-0.5"
                  >
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                }
              >
                <div className="space-y-0.5">
                  {SUPPLIER_ISSUES.slice(0, 4).map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onNavigateToInvoices?.(undefined, s.supplier)}
                      title={`View ${s.supplier}'s invoices`}
                      className="group w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#FAFBFD] transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                        s.worst === 'Critical' ? 'bg-[#FFF1F2] text-[#D4183D]'
                        : s.worst === 'High'   ? 'bg-[#FFF7ED] text-[#E65100]'
                                               : 'bg-[#F3F3F5] text-[#5A5568]'
                      }`}>
                        {s.supplier.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-[#030213] truncate group-hover:text-[#1565C0] transition-colors">{s.supplier}</p>
                          <SeverityBadge s={s.worst} />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.flags.map((f, j) => (
                            <span
                              key={j}
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                                s.worst === 'Critical' ? 'bg-[#FFF1F2] text-[#D4183D]' : 'bg-[#FFF7ED] text-[#9A3412]'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                        <div>
                          <p className="text-sm font-bold text-[#030213] leading-none">{s.flagged}</p>
                          <p className="text-[9px] text-[#A0A0B0] mt-0.5">of {s.total}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#C8C8D0] group-hover:text-[#4D8EF7] transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
                {SUPPLIER_ISSUES.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onNavigateToInvoices?.('low_confidence')}
                    className="w-full mt-1.5 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0] hover:bg-[#EEF4FF] transition-colors"
                  >
                    View all {SUPPLIER_ISSUES.length} flagged suppliers
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </Card>
            </div>
          </>
        )}

        {/* ── SPEND TAB ── */}
        {tab === 'spend' && (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Spend',    value: fmt(108700), sub: `${period} period`,    accent: '#4D8EF7', icon: <TrendingUp className="w-5 h-5 text-[#4D8EF7]" /> },
                { label: 'Lab Spend',      value: fmt(77100),  sub: '71% of total',        accent: '#2E7D32', icon: <FileText className="w-5 h-5 text-[#2E7D32]" /> },
                { label: 'Non-Lab Spend',  value: fmt(31600),  sub: '29% of total',        accent: '#7C3AED', icon: <FileText className="w-5 h-5 text-[#7C3AED]" /> },
                { label: 'Avg Invoice',    value: fmt(734),    sub: 'across all invoices', accent: '#1565C0', icon: <BarChart3 className="w-5 h-5 text-[#1565C0]" /> },
              ].map(k => (
                <KpiCard key={k.label} accent={k.accent} icon={k.icon} label={k.label} value={k.value} sub={k.sub} />
              ))}
            </div>

            {/* Monthly spend chart — stacked by category */}
            <Card title="Monthly Spend" subtitle="Spend by category over time">
              <div className="flex items-end gap-4 h-48">
                {MONTHLY_SPEND.map(m => {
                  const total = m.clinical + m.equipment + m.dentalLabs + m.implants + m.software + m.raw;
                  const totalH = (total / SPEND_MAX) * 168;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-[#A0A0B0] font-medium">{fmt(total)}</span>
                      <div className="w-full flex flex-col items-center justify-end" style={{ height: `${totalH}px` }}>
                        {SPEND_CATEGORIES.map((cat, idx) => {
                          const v = (m as any)[cat.key] as number;
                          const h = (v / total) * totalH;
                          const isFirst = idx === 0;
                          const isLast = idx === SPEND_CATEGORIES.length - 1;
                          return (
                            <div
                              key={cat.key}
                              className={`w-full max-w-[28px] ${isLast ? 'rounded-t-md' : ''} ${isFirst ? 'rounded-b-sm' : ''}`}
                              style={{ height: `${h}px`, background: cat.color }}
                              title={`${cat.label}: ${fmt(v)}`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-[#717182]">{m.month}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#F0EFF6] flex-wrap">
                {SPEND_CATEGORIES.map(c => (
                  <div key={c.key} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: c.color }} />
                    <span className="text-xs text-[#717182]">{c.label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Spend by Clinic — top 10 shown; PDF download exports all 12 */}
            <Card
              title="Spend by Clinic"
              subtitle={`Top 10 of ${SPEND_BY_CLINIC.length} clinics · this period`}
              action={
                <button
                  onClick={() => {
                    const total = SPEND_BY_CLINIC.reduce((a, b) => a + b.value, 0);
                    const rows = SPEND_BY_CLINIC.map((c, i) =>
                      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9fb'}">
                        <td style="padding:8px 12px;font-size:12px;color:#030213">${i + 1}. ${c.name}</td>
                        <td style="padding:8px 12px;font-size:12px;font-weight:600;text-align:right">£${(c.value).toLocaleString('en-GB')}</td>
                        <td style="padding:8px 12px;font-size:12px;color:#717182;text-align:right">${((c.value / total) * 100).toFixed(1)}%</td>
                      </tr>`
                    ).join('');
                    const html = `<!DOCTYPE html><html><head><title>Spend by Clinic</title>
                      <style>body{font-family:system-ui,sans-serif;margin:40px;color:#030213}
                      h1{font-size:18px;margin-bottom:4px}p{font-size:12px;color:#717182;margin-bottom:24px}
                      table{width:100%;border-collapse:collapse;border:1px solid #E0E0E6;border-radius:8px;overflow:hidden}
                      th{background:#F8F9FC;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#A0A0B0;text-align:left}
                      th:not(:first-child){text-align:right}
                      tfoot td{padding:8px 12px;font-weight:700;font-size:12px;border-top:2px solid #E0E0E6}
                      tfoot td:not(:first-child){text-align:right}
                      @media print{@page{margin:20mm}}</style></head>
                      <body>
                      <h1>Spend by Clinic</h1>
                      <p>All ${SPEND_BY_CLINIC.length} clinics · Generated ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</p>
                      <table><thead><tr><th>Clinic</th><th>Spend (£)</th><th>Share</th></tr></thead>
                      <tbody>${rows}</tbody>
                      <tfoot><tr><td>Total (${SPEND_BY_CLINIC.length} clinics)</td><td>£${total.toLocaleString('en-GB')}</td><td>100%</td></tr></tfoot>
                      </table></body></html>`;
                    const win = window.open('', '_blank');
                    if (win) { win.document.write(html); win.document.close(); win.print(); }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#4D8EF7] bg-[#EEF4FF] border border-[#C8D8FC] hover:bg-[#E0EDFF] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  PDF (all {SPEND_BY_CLINIC.length})
                </button>
              }
            >
              <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 items-center">
                <div className="relative flex items-center justify-center">
                  <Donut
                    data={SPEND_BY_CLINIC_DISPLAY.map(c => ({ label: c.name, value: c.value, color: c.color }))}
                    size={160}
                    thickness={22}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-[#717182]">Total</span>
                    <span className="text-sm font-semibold text-[#030213]">
                      £{(SPEND_BY_CLINIC.reduce((a, b) => a + b.value, 0) / 1000).toFixed(1)}k
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 min-w-0">
                  {(() => {
                    const total = SPEND_BY_CLINIC.reduce((a, b) => a + b.value, 0);
                    return SPEND_BY_CLINIC_DISPLAY.map((c, idx) => {
                      const pct = (c.value / total) * 100;
                      return (
                        <div
                          key={c.name}
                          className="grid items-center gap-2"
                          style={{ gridTemplateColumns: '18px minmax(0, 1fr) auto auto' }}
                        >
                          <span className="text-[9px] text-[#A0A0B0] tabular-nums font-semibold">{idx + 1}</span>
                          <span className="text-xs text-[#030213] truncate flex items-center gap-1" title={c.name}>
                            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: c.color }} />
                            {c.name}
                          </span>
                          <span className="text-xs font-semibold text-[#030213] tabular-nums">£{(c.value / 1000).toFixed(0)}k</span>
                          <span className="text-[10px] text-[#717182] tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    });
                  })()}
                  {SPEND_BY_CLINIC.length > 10 && (
                    <div className="sm:col-span-2 mt-1 pt-2 border-t border-[#F0EFF6]">
                      <span className="text-[10px] text-[#A0A0B0]">
                        +{SPEND_BY_CLINIC.length - 10} more clinics · £{((SPEND_BY_CLINIC.slice(10).reduce((a, b) => a + b.value, 0)) / 1000).toFixed(0)}k combined · <span className="text-[#4D8EF7]">download PDF to see all</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* GL Category breakdown */}
            <Card title="Spend by GL Category" subtitle="Top cost categories">
              <div className="space-y-3">
                {GL_CATEGORIES.map(g => (
                  <div key={g.label} className="flex items-center gap-3">
                    <span className="text-xs text-[#717182] w-44 flex-shrink-0">{g.label}</span>
                    <div className="flex-1 h-5 bg-[#F3F3F5] rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] transition-all duration-500"
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#030213] w-16 text-right">{fmt(g.amount)}</span>
                    <span className="text-[10px] text-[#A0A0B0] w-8 text-right">{g.pct}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ── SUPPLIERS TAB ── */}
        {tab === 'suppliers' && (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Active Suppliers',     value: 24,         sub: 'approved & trading',     accent: '#4D8EF7', icon: <Building2 className="w-5 h-5 text-[#4D8EF7]" /> },
                { label: 'New This Period',      value: 2,          sub: 'first invoice received', accent: '#2E7D32', icon: <Users className="w-5 h-5 text-[#2E7D32]" /> },
                { label: 'Avg Invoices/Supplier', value: '6.2',     sub: `over ${period}`,         accent: '#E65100', icon: <FileText className="w-5 h-5 text-[#E65100]" /> },
                { label: 'Avg Spend/Supplier',   value: fmt(4529),  sub: `over ${period}`,         accent: '#1565C0', icon: <BarChart3 className="w-5 h-5 text-[#1565C0]" /> },
              ].map(k => (
                <KpiCard key={k.label} accent={k.accent} icon={k.icon} label={k.label} value={k.value} sub={k.sub} />
              ))}
            </div>

            {/* Top suppliers — table + donut */}
            <Card title="Top Suppliers by Spend" subtitle={`${period} period`}>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-center">
                {/* Table */}
                <div className="space-y-0">
                  <div className="grid grid-cols-[2fr_auto_auto_auto] text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest pb-2 border-b border-[#F0EFF6] mb-1 gap-3">
                    <span>Supplier</span>
                    <span className="text-right">Invoices</span>
                    <span className="text-right">Spend</span>
                    <span className="text-center">Trend</span>
                  </div>
                  {TOP_SUPPLIERS.map((s, i) => (
                    <div key={i} className="grid grid-cols-[2fr_auto_auto_auto] items-center py-3 border-b border-[#F8F8F8] last:border-b-0 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length] }} />
                        <p className="text-xs font-semibold text-[#030213] truncate">{s.name}</p>
                      </div>
                      <span className="text-xs font-medium text-[#717182] text-right">{s.invoices}</span>
                      <span className="text-xs font-bold text-[#030213] text-right">{fmt(s.spend)}</span>
                      <div className="flex justify-center">
                        {s.trend === 'up'
                          ? <TrendingUp className="w-3.5 h-3.5 text-[#2E7D32]" />
                          : <TrendingDown className="w-3.5 h-3.5 text-[#D4183D]" />
                        }
                      </div>
                    </div>
                  ))}
                </div>

                {/* Donut */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative">
                    <Donut
                      data={TOP_SUPPLIERS.map((s, i) => ({
                        label: s.name,
                        value: s.spend,
                        color: TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length],
                      }))}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider">Total</span>
                      <span className="text-sm font-bold text-[#030213]">
                        {fmt(TOP_SUPPLIERS.reduce((a, s) => a + s.spend, 0))}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#A0A0B0] mt-2">Spend share by supplier</p>
                </div>
              </div>
            </Card>

            {/* Spend by Category — Suppliers tab */}
            <Card title="Spend by Category" subtitle={`Breakdown across categories — ${period} period`}>
              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
                {/* Donut */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <Donut
                      data={CATEGORY_SPEND.map(c => ({ label: c.label, value: c.amount, color: c.color }))}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider">Total</span>
                      <span className="text-sm font-bold text-[#030213]">
                        {fmt(CATEGORY_SPEND.reduce((a, c) => a + c.amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bars */}
                <div className="space-y-3">
                  {CATEGORY_SPEND.map(c => {
                    const total = CATEGORY_SPEND.reduce((a, x) => a + x.amount, 0);
                    const pct = Math.round((c.amount / total) * 100);
                    return (
                      <div key={c.label} className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <span className="text-xs text-[#717182] w-36 flex-shrink-0 truncate">{c.label}</span>
                        <div className="flex-1 h-4 bg-[#F3F3F5] rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all duration-500"
                            style={{ width: `${pct}%`, background: c.color }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#030213] w-16 text-right">{fmt(c.amount)}</span>
                        <span className="text-[10px] text-[#A0A0B0] w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Spend share bars */}
            <Card title="Spend Concentration" subtitle="Share of total spend per supplier">
              <div className="space-y-3">
                {TOP_SUPPLIERS.map((s, i) => {
                  const totalSpend = TOP_SUPPLIERS.reduce((acc, x) => acc + x.spend, 0);
                  const pct = Math.round((s.spend / totalSpend) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length] }} />
                      <span className="text-xs text-[#717182] w-40 flex-shrink-0 truncate">{s.name}</span>
                      <div className="flex-1 h-5 bg-[#F3F3F5] rounded-lg overflow-hidden">
                        <div
                          className="h-full rounded-lg transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[#030213] w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {/* ── AI INSIGHTS TAB ── */}
        {tab === 'ai' && (
          <>
            {/* Top row — savings hero + purchasing catalogue side by side on
                wide screens, stacked on narrow ones. Cards stretch to the
                same height so neither leaves a gap beneath it. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Savings suggestions — the headline of this tab. One hero card
                with the annual total up top and each suggestion as a slim
                collapsed row underneath. */}
            <div className="bg-gradient-to-br from-[#E7F6EC] to-[#F4FBF2] border border-[#C6E9CE] rounded-xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <PiggyBank className="w-5 h-5 text-[#2E7D32]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#2E7D32] uppercase tracking-widest">Suggested savings</p>
                    <p className="text-2xl font-semibold text-[#030213] leading-tight">
                      {fmt(TOTAL_ANNUAL_SAVINGS)}
                      <span className="text-sm font-normal text-[#717182]"> / year</span>
                    </p>
                  </div>
                </div>
                <AiSparkle label title="Savings identified by AI from cross-supplier price benchmarks" />
              </div>
              <div className="space-y-2">
                {RECOMMENDATIONS.map(rec => (
                  <SavingsSuggestionRow key={rec.altSupplier} rec={rec} />
                ))}
              </div>
            </div>

            {/* Section — What you're purchasing. All suppliers collapsed so
                the catalogue reads as a quiet index, not a wall of tables. */}
            <Card
              title="What you're purchasing"
              subtitle="AI-built catalogue from clinic & dentist purchases, grouped by supplier"
              action={<AiSparkle label title="Catalogue auto-built from invoice line items by AI" />}
            >
              <div className="space-y-2">
                {(showAllSuppliers ? CATALOGUE : CATALOGUE.slice(0, 5)).map((s, i) => (
                  <SupplierCatalogueRow
                    key={s.supplier}
                    data={s}
                    color={TOP_SUPPLIER_COLORS[i % TOP_SUPPLIER_COLORS.length]}
                  />
                ))}
                {CATALOGUE.length > 5 && (
                  <button
                    onClick={() => setShowAllSuppliers(v => !v)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs font-semibold text-[#4D8EF7] hover:text-[#1565C0] transition-colors"
                  >
                    {showAllSuppliers ? 'Show less' : `See all ${CATALOGUE.length} suppliers`}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllSuppliers ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </Card>

            </div>

            {/* Coverage stats — one quiet line instead of a KPI card row. */}
            <p className="px-1 text-xs text-[#717182]">
              Based on <span className="font-semibold text-[#030213]">{CATALOGUE_ITEM_COUNT}</span> catalogued items
              {' · '}<span className="font-semibold text-[#030213]">{CATALOGUE.length}</span> suppliers
              {' · '}<span className="font-semibold text-[#030213]">{LAB_MIX.length}</span> labs
              {' · '}<span className="font-semibold text-[#030213]">{mockCases.length}</span> cases analysed
            </p>

            {/* Section 2 — AI Decisions */}
            <div className="flex items-center gap-2 pt-1">
              <Sparkles className="w-4 h-4 text-[#A59DFF]" />
              <span className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">AI Decisions</span>
            </div>

            <Card title="Where your purchasing goes" subtitle="Case routing across labs by practice">
              <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
                {/* Lab mix donut */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative">
                    <Donut data={LAB_MIX.map(l => ({ label: l.lab, value: l.count, color: l.color }))} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-[#A0A0B0] uppercase tracking-wider">Cases</span>
                      <span className="text-sm font-bold text-[#030213]">{mockCases.length}</span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 w-full">
                    {LAB_MIX.map(l => (
                      <div key={l.lab} className="flex items-center gap-1.5 text-[10px] text-[#717182]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
                        <span className="truncate flex-1">{l.lab}</span>
                        <span className="font-semibold text-[#030213] tabular-nums">{l.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-practice routing bars */}
                <div className="space-y-4">
                  {PRACTICE_ROUTING.map(p => (
                    <div key={p.practice}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <p className="text-xs font-semibold text-[#030213] truncate">{p.practice}</p>
                        <p className="text-[11px] text-[#717182] flex-shrink-0">
                          <span className="font-bold text-[#030213]">{p.topLabPct}%</span> → {p.topLab}
                        </p>
                      </div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-[#F3F3F5]">
                        {p.segments.map(seg => (
                          <div key={seg.lab} title={`${seg.lab} — ${seg.pct}%`} style={{ width: `${seg.pct}%`, background: seg.color }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Derived insights */}
              <div className="mt-5 pt-4 border-t border-[#F0EFF6] space-y-2">
                {ROUTING_INSIGHTS.map(text => (
                  <div key={text} className="flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#A59DFF] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#5A5568]">{text}</p>
                  </div>
                ))}
              </div>
            </Card>

          </>
        )}

      </div>
    </div>
  );
}
