import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Download, Mail } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { saveBlob } from '../../bulk-actions/zip';
import { addDays, fmtDate, money, startOfMonth, today } from '../format';
import { billingCases } from '../engine';
import { updateMonday, useBilling } from '../billingStore';
import { billingAccounts, type Filters, mondayEmail, REPORTS, toCsv } from '../insights';
import { btn, btnPrimary, Card, Empty, Field, input, Note, Toggle, td, th } from '../ui';

// ── 9. Reports: what Xero can't show ─────────────────────────────────────────
// Six fixed reports, shared filters, CSV export, and the Monday email.

const WHY: Record<string, string> = {
  unbilled: 'Xero has no record of a case until it\'s invoiced.',
  trends: 'Xero shows revenue by contact, not cases by dentist.',
  'given-away': 'Xero sees the discounted total, not the discount.',
  remakes: 'Xero has no remake data.',
  mix: 'Xero groups by account code.',
  cash: 'Xero lists due dates, but practices don\'t pay on them.',
};

type Range = 'month' | '30' | '90' | 'all';

export default function Reports() {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [id, setId] = useState<string>(() => new URLSearchParams(window.location.search).get('r') ?? 'unbilled');
  const [range, setRange] = useState<Range>('90');
  const [department, setDepartment] = useState('all');
  const [acc, setAcc] = useState('all');
  const t = today();
  const f: Filters = { from: range === 'month' ? startOfMonth(t) : range === '30' ? addDays(t, -30) : range === '90' ? addDays(t, -90) : '2000-01-01', to: t, department, account: acc };
  const def = REPORTS.find(r => r.id === id) ?? REPORTS[0];
  const report = useMemo(() => def.fn(s, f), [s, def, f.from, f.to, f.department, f.account]);
  const all = useMemo(() => REPORTS.map(r => ({ id: r.id, r: r.fn(s, f) })), [s, f.from, f.to, f.department, f.account]);
  const monday = mondayEmail(s);
  const listIds = useMemo(() => new Set(billingCases().map(c => c.id)), [s]);
  const moneyCol = report.columns.findIndex(c => /value|amount|owed|total/i.test(c));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      <div className="space-y-2">
        {all.map(({ id: rid, r }) => (
          <button key={rid} onClick={() => setId(rid)} className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${rid === def.id ? 'border-[#4D8EF7] bg-[#F5F9FF]' : 'border-[#E0E0E6] bg-white hover:border-[#C8D8FC]'}`}>
            <p className="text-sm font-semibold text-[#030213]">{r.title}</p>
            <p className="text-[11px] text-[#717182]">"{r.question}"</p>
          </button>
        ))}
        <MondayCard monday={monday} />
      </div>

      <div className="xl:col-span-3 space-y-3">
        <Card
          title={report.title}
          sub={<>"{report.question}" · <span className="text-[#A0A0B0]">{WHY[def.id]}</span></>}
          actions={<button className={btn} onClick={() => { saveBlob(new Blob([toCsv(report)], { type: 'text/csv' }), `${def.id}_${t}.csv`); toast.success('CSV downloaded'); }}><Download className="w-3.5 h-3.5" /> Export CSV</button>}
          pad={false}
        >
          <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-[#F0EFF6]">
            <Field label="Dates">
              <select className={`${input} w-40`} value={range} onChange={e => setRange(e.target.value as Range)}><option value="month">This month</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select>
            </Field>
            <Field label="Department"><select className={`${input} w-44`} value={department} onChange={e => setDepartment(e.target.value)}><option value="all">All departments</option>{s.departments.map(d => <option key={d.name}>{d.name}</option>)}</select></Field>
            <Field label="Account"><select className={`${input} w-56`} value={acc} onChange={e => setAcc(e.target.value)}><option value="all">All accounts</option>{billingAccounts(s).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
            <p className="text-[11px] text-[#A0A0B0] pb-2">{fmtDate(f.from === '2000-01-01' ? null : f.from)} – {fmtDate(f.to)}</p>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {report.summary.map(x => (
              <div key={x.label} className="rounded-lg border border-[#E0E0E6] px-3 py-1.5">
                <p className="text-[10px] text-[#717182]">{x.label}</p>
                <p className={`text-sm font-semibold ${x.tone === 'red' ? 'text-[#C62828]' : 'text-[#030213]'}`}>{x.value}</p>
              </div>
            ))}
          </div>
          {report.note && <div className="px-4 pb-3"><Note>{report.note}</Note></div>}
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full min-w-[720px]">
              <thead className="sticky top-0"><tr>{report.columns.map((c, i) => <th key={c} className={`${th} ${i === moneyCol ? 'text-right' : ''}`}>{c}</th>)}</tr></thead>
              <tbody>
                {report.rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="hover:bg-[#FAFAFD]">
                    {r.map((v, k) => (
                      <td key={k} className={`${td} ${k === moneyCol ? 'text-right whitespace-nowrap' : ''}`}>
                        {k === 0 && listIds.has(String(v))
                          ? <button className="font-mono text-[#4D8EF7] hover:underline" onClick={() => navigate(`/growth/cases/${v}?sf=billing`)}>{v}</button>
                          : k === moneyCol && typeof v === 'number' ? money(v) : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!report.rows.length && <Empty>Nothing for these filters.</Empty>}
          </div>
        </Card>
        <p className="text-[11px] text-[#A0A0B0]">Left to Xero: profit and loss, VAT returns, the aged debtors ledger and supplier spend. Margin by case comes with job costing.</p>
      </div>
    </div>
  );
}

function MondayCard({ monday }: { monday: { label: string; value: string; link: string }[] }) {
  const s = useBilling();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [to, setTo] = useState(s.monday.to);
  return (
    <Card title={<span className="inline-flex items-center gap-1.5"><Mail className="w-4 h-4 text-[#4D8EF7]" /> Monday email</span>} sub="Five numbers and the one that changed most, to the owner every Monday.">
      <div className="space-y-2">
        <div className="rounded-lg border border-[#E0E0E6] divide-y divide-[#F0EFF6]">
          {monday.map(m => (
            <button key={m.label} onClick={() => navigate(m.link)} className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[#FAFAFD]">
              <span className="text-[11px] text-[#5A5568]">{m.label}</span>
              <span className="text-xs font-semibold text-[#030213] inline-flex items-center gap-1 truncate">{m.value} <ArrowRight className="w-3 h-3 text-[#A0A0B0]" /></span>
            </button>
          ))}
        </div>
        <Toggle on={s.monday.enabled} onChange={v => updateMonday({ ...s.monday, enabled: v })} label={s.monday.enabled ? `On, Mondays at ${s.monday.time}` : 'Off'} />
        <div className="flex gap-1.5"><input className={input} value={to} onChange={e => setTo(e.target.value)} /><button className={btn} onClick={() => { updateMonday({ ...s.monday, to }); toast.success('Saved'); }}>Save</button></div>
        <button className={btnPrimary} onClick={() => toast.success(`Preview sent to ${s.monday.to}`)}>Send me a preview</button>
      </div>
    </Card>
  );
}
