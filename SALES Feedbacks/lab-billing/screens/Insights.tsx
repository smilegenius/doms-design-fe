import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, Mail, MessageSquarePlus, Phone } from 'lucide-react';
import { useToast } from '../../../src/app/context/ToastContext';
import { saveBlob } from '../../bulk-actions/zip';
import { account, lineNet } from '../engine';
import { daysBetween, fmtMonth, fmtShort, money, monthOf, pl, prevMonth, round2, today } from '../format';
import { addAccountNote, useBilling } from '../billingStore';
import { mondayEmail } from '../insights';
import { dentistRows, HEALTH_TONE, overview, practiceDetail, practiceRows, whoToCall, type Health } from '../labInsights';
import Reports, { MondayCard } from './Reports';
import { btn, btnPrimary, Card, Empty, input, Pill, td, th } from '../ui';

// ── Insights (Requirements v2, Lab insights, N1–N15) ─────────────────────────
// Who to call, and why. One word for health per practice and dentist, worked
// out from its own history; four views and the adopted reports. No setup.

type View = 'overview' | 'practices' | 'dentists' | 'products' | 'reports';
const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'practices', label: 'Practices' }, { id: 'dentists', label: 'Dentists' }, { id: 'products', label: 'Products' }, { id: 'reports', label: 'Reports' },
];

const gbp = (n: number) => money(n, 'GBP', { round: true });
const pct = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${Math.round(n)}%`);
const csv = (rows: (string | number)[][], name: string) => saveBlob(new Blob([rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }), name);

function Status({ h }: { h: Health }) { return <Pill tone={HEALTH_TONE[h]}>{h}</Pill>; }
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <svg width="64" height="18" viewBox="0 0 64 18" role="img" aria-label="Six-month trend">
      <polyline fill="none" stroke="#4D8EF7" strokeWidth="1.5" points={values.map((v, i) => `${i * 12.4 + 1},${17 - (v / max) * 15}`).join(' ')} />
    </svg>
  );
}

export default function Insights() {
  const [params, setParams] = useSearchParams();
  const view = (VIEWS.find(v => v.id === params.get('view'))?.id ?? (params.get('r') ? 'reports' : 'overview')) as View;
  const practice = params.get('practice');
  const go = (v: View, extra: Record<string, string> = {}) => setParams({ view: v, ...extra }, { replace: false });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#F0EFF6] pb-2">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => go(v.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${view === v.id && !practice ? 'border-[#4D8EF7] bg-[#EEF4FF] text-[#1565C0]' : 'border-[#E0E0E6] bg-white text-[#5A5568] hover:bg-[#F8F9FC]'}`}>{v.label}</button>
        ))}
        <span className="flex-1" />
        <span className="text-[11px] text-[#717182]">Each practice and dentist is compared with its own last 3 months, so August and Christmas don't look like decline.</span>
      </div>
      {practice ? <PracticePage name={practice} onBack={() => go('practices')} />
        : view === 'overview' ? <Overview onPractice={p => go('practices', { practice: p })} />
          : view === 'practices' ? <Practices onOpen={p => go('practices', { practice: p })} />
            : view === 'dentists' ? <Dentists />
              : view === 'products' ? <Products />
                : <Reports />}
    </div>
  );
}

function Overview({ onPractice }: { onPractice: (p: string) => void }) {
  const s = useBilling();
  const ym = monthOf(today());
  const o = useMemo(() => overview(s, ym), [s, ym]);
  const calls = useMemo(() => whoToCall(s), [s]);
  const ds = useMemo(() => dentistRows(s), [s]);
  const relations = [
    { label: 'Gone quiet', value: calls.filter(c => c.row.status === 'Gone quiet').map(c => c.name).join(', ') || 'Nobody', link: '/growth/billing/insights?view=overview' },
    { label: 'Slowing', value: calls.filter(c => c.row.status === 'Slowing').map(c => c.name).join(', ') || 'Nobody', link: '/growth/billing/insights?view=overview' },
    { label: 'New dentists', value: ds.filter(d => d.status === 'New').map(d => d.dentist).join(', ') || 'None', link: '/growth/billing/insights?view=dentists' },
  ];
  const n = (label: string, k: 'billed' | 'cases' | 'practices' | 'dentists', fmt: (x: number) => string) => {
    const cur = o.cur[k], prev = o.prev[k];
    const ch = prev ? (cur - prev) / prev * 100 : null;
    return (
      <div className="bg-white border border-[#E0E0E6] rounded-xl p-3.5">
        <p className="text-[11px] text-[#717182]">{label}</p>
        <p className="text-xl font-semibold text-[#030213]">{fmt(cur)}</p>
        <p className="text-[11px] text-[#717182]"><span className={ch == null ? '' : ch < 0 ? 'text-[#C62828]' : 'text-[#2E7D32]'}>{pct(ch)}</span> vs the same days of {fmtMonth(prevMonth(ym)).split(' ')[0]} · {o.ly ? `${fmt(o.ly[k])} a year ago` : 'no data a year ago'}</p>
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {n('Billed so far this month', 'billed', gbp)}{n('Cases so far this month', 'cases', String)}{n('Active practices', 'practices', String)}{n('Active dentists', 'dentists', String)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <Card title="Who to call" sub="Slowing or gone quiet, ranked by what they usually send a month." pad={false}>
            {calls.length === 0 ? <Empty>Nobody is slowing down. Everyone is within their usual range.</Empty> : <ul className="divide-y divide-[#F0EFF6]">{calls.map(c => <CallRow key={`${c.kind}-${c.name}`} c={c} onPractice={onPractice} />)}</ul>}
          </Card>
          <Card title="Concentration" sub="Share of the last 3 months' billing from your top 10 practices.">
            {o.concentration == null ? <Empty>No billing yet.</Empty> : (
              <div className="space-y-2">
                <div className="h-3 rounded-full bg-[#F3F3F5] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF]" style={{ width: `${Math.round(o.concentration * 100)}%` }} /></div>
                <p className="text-xs text-[#5A5568]">Top {Math.min(10, o.practices)} of {o.practices} practices bring <b>{Math.round(o.concentration * 100)}%</b> of billing.{o.top1 ? <> The largest, {o.top1.name}, is <b>{Math.round(o.top1.share * 100)}%</b> on its own.</> : null}</p>
              </div>
            )}
          </Card>
        </div>
        <MondayCard monday={mondayEmail(s)} relations={relations} />
      </div>
    </div>
  );
}

function CallRow({ c, onPractice }: { c: ReturnType<typeof whoToCall>[number]; onPractice: (p: string) => void }) {
  const s = useBilling();
  const { toast } = useToast();
  const [noting, setNoting] = useState(false);
  const [text, setText] = useState('');
  const acc = c.accountId ? account(s, c.accountId) : undefined;
  const r = c.row;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#030213]">
            {c.kind === 'Practice' ? <button className="hover:underline" onClick={() => onPractice(c.name)}>{c.name}</button> : c.name} <Status h={r.status} /> <span className="text-[11px] font-normal text-[#717182]">{c.kind}{'practices' in c && c.practices?.length ? ` · ${c.practices.join(', ')}` : ''}</span>
          </p>
          <p className="text-xs text-[#5A5568] mt-0.5">
            Usually {gbp(r.avg)} a month; {gbp(r.last30)} in the last 30 days{r.change != null ? ` (${pct(r.change)})` : ''}. Last case {r.lastCase ? `${fmtShort(r.lastCase)}, ${daysBetween(r.lastCase, today())} days ago` : 'never'}.
          </p>
          {acc?.notes?.[0] && <p className="text-[11px] text-[#717182] mt-1">Last note ({fmtShort(acc.notes[0].at)}, {acc.notes[0].by}): {acc.notes[0].text}</p>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button className={btn} onClick={() => toast.success(`Call logged for ${c.name}`)}><Phone className="w-3.5 h-3.5" /> Call</button>
          <a className={btn} href={`mailto:${acc?.emails[0] ?? ''}?subject=${encodeURIComponent('Checking in')}`}><Mail className="w-3.5 h-3.5" /> Email</a>
          {acc && <button className={btn} onClick={() => setNoting(v => !v)}><MessageSquarePlus className="w-3.5 h-3.5" /> Add note</button>}
        </div>
      </div>
      {noting && acc && (
        <div className="flex gap-2 mt-2">
          <input className={input} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. New associate started; volume back from January" aria-label="Note" />
          <button className={btnPrimary} disabled={!text.trim()} onClick={() => { addAccountNote(acc.id, text); setText(''); setNoting(false); toast.success('Note saved on the account'); }}>Save</button>
        </div>
      )}
    </li>
  );
}

function Practices({ onOpen }: { onOpen: (p: string) => void }) {
  const s = useBilling();
  const rows = useMemo(() => practiceRows(s), [s]);
  return (
    <Card title="Practices" sub="Sorted by money at risk. Click one for its 12 months and each dentist." pad={false}
      actions={<button className={btn} onClick={() => csv([['Practice', 'Status', 'Slow payer', 'This month', '3-month average', 'Change %', 'Dentists active', 'Dentists total', 'Last case', 'Avg days to pay', 'Owed now', 'NHS share'], ...rows.map(r => [r.practice, r.status, r.slow ? 'Yes' : '', r.thisMonth, r.avg, r.change ?? '', r.dentistsActive, r.dentistsTotal, r.lastCase ?? '', r.daysToPay != null ? Math.round(r.daysToPay) : '', r.owed, r.nhsShare != null ? Math.round(r.nhsShare * 100) : ''])], `practices-${today()}.csv`)}><Download className="w-3.5 h-3.5" /> Export</button>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr><th className={th}>Practice</th><th className={`${th} text-right`}>This month</th><th className={`${th} text-right`}>3-month avg</th><th className={`${th} text-right`}>Last 30 days</th><th className={th}>Dentists</th><th className={th}>Last case</th><th className={`${th} text-right`}>Days to pay</th><th className={`${th} text-right`}>Owed now</th><th className={th}>NHS / private</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.practice} className="cursor-pointer hover:bg-[#FAFAFD]" onClick={() => onOpen(r.practice)}>
                <td className={td}><span className="font-semibold">{r.practice}</span> <Status h={r.status} /> {r.slow && <Pill tone="red">Slow payer</Pill>}</td>
                <td className={`${td} text-right`}>{gbp(r.thisMonth)}</td>
                <td className={`${td} text-right`}>{gbp(r.avg)}</td>
                <td className={`${td} text-right`}>{gbp(r.last30)} <span className={`text-[10px] ${r.change != null && r.change < 0 ? 'text-[#C62828]' : 'text-[#2E7D32]'}`}>{pct(r.change)}</span></td>
                <td className={td}>{r.dentistsActive} / {r.dentistsTotal} active</td>
                <td className={td}>{fmtShort(r.lastCase)}</td>
                <td className={`${td} text-right`}>{r.daysToPay != null ? Math.round(r.daysToPay) : '—'}</td>
                <td className={`${td} text-right`}>{gbp(r.owed)}</td>
                <td className={td}>{r.nhsShare != null ? `${Math.round(r.nhsShare * 100)}% / ${100 - Math.round(r.nhsShare * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PracticePage({ name, onBack }: { name: string; onBack: () => void }) {
  const s = useBilling();
  const d = useMemo(() => practiceDetail(s, name), [s, name]);
  const row = practiceRows(s).find(r => r.practice === name);
  const acc = row?.accountId ? account(s, row.accountId) : undefined;
  const max = Math.max(1, ...d.bars.map(b => b.value));
  const mixMax = Math.max(1, ...d.mix.map(m => m.value));
  const payments = acc ? s.invoices.filter(i => i.accountId === acc.id).flatMap(i => i.payments.map(p => ({ ...p, number: i.number }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6) : [];
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Practices</button>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold text-[#030213]">{name}</h2>
        {row && <Status h={row.status} />} {row?.slow && <Pill tone="red">Slow payer</Pill>}
        {row && <span className="text-xs text-[#717182]">Usually {gbp(row.avg)} a month · {gbp(row.last30)} in the last 30 days · owes {gbp(row.owed)}</span>}
      </div>
      <Card title="Last 12 months" sub="Value of cases received each month.">
        <div className="flex items-end gap-1.5 h-36" role="img" aria-label={`Monthly value for ${name}`}>
          {d.bars.map(b => (
            <div key={b.ym} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
              <span className="text-[9px] text-[#717182]">{b.value ? gbp(b.value) : ''}</span>
              <div className="w-full rounded-t bg-gradient-to-t from-[#4D8EF7] to-[#A59DFF]" style={{ height: `${(b.value / max) * 100}%`, minHeight: b.value ? 2 : 0 }} />
              <span className="text-[10px] text-[#717182]">{fmtMonth(b.ym).slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card title="Dentists" sub="Each with their own status, so one who dropped off shows up even when the practice looks fine." pad={false} className="xl:col-span-2">
          <table className="w-full">
            <thead><tr><th className={th}>Dentist</th><th className={th}>Trend</th><th className={`${th} text-right`}>Usual / month</th><th className={`${th} text-right`}>Last 30 days</th><th className={th}>Last case</th></tr></thead>
            <tbody>
              {d.dentists.map(x => (
                <tr key={x.dentist}>
                  <td className={td}>{x.dentist} <Status h={x.status} /></td>
                  <td className={td}><Spark values={x.trend} /></td>
                  <td className={`${td} text-right`}>{gbp(x.avg)}</td>
                  <td className={`${td} text-right`}>{gbp(x.last30)}</td>
                  <td className={td}>{fmtShort(x.lastCase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card title="Product mix">
            <ul className="space-y-1.5">{d.mix.map(m => <li key={m.item} className="text-xs"><div className="flex justify-between"><span>{m.item}</span><span className="text-[#717182]">{gbp(m.value)}</span></div><div className="h-1.5 rounded-full bg-[#F3F3F5] mt-0.5"><div className="h-full rounded-full bg-[#7C6BFF]" style={{ width: `${(m.value / mixMax) * 100}%` }} /></div></li>)}</ul>
          </Card>
          <Card title="Payments" sub={row?.daysToPay != null ? `Pays in ${Math.round(row.daysToPay)} days on average.` : undefined}>
            {payments.length ? <ul className="space-y-1 text-xs">{payments.map(p => <li key={p.id} className="flex justify-between"><span>{fmtShort(p.at)} · {p.number}</span><span className="text-[#2E7D32]">{money(p.amount)}</span></li>)}</ul> : <Empty>No payments yet.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Dentists() {
  const s = useBilling();
  const rows = useMemo(() => dentistRows(s), [s]);
  const [status, setStatus] = useState<'all' | Health>('all');
  const [practice, setPractice] = useState('all');
  const practices = [...new Set(rows.flatMap(r => r.practices))].sort();
  const list = rows.filter(r => (status === 'all' || r.status === status) && (practice === 'all' || r.practices.includes(practice)));
  return (
    <Card title="Dentists" sub="Every dentist across all practices." pad={false}
      actions={<>
        <select className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Status"><option value="all">All statuses</option>{(['New', 'Growing', 'Steady', 'Slowing', 'Gone quiet'] as Health[]).map(h => <option key={h}>{h}</option>)}</select>
        <select className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" value={practice} onChange={e => setPractice(e.target.value)} aria-label="Practice"><option value="all">All practices</option>{practices.map(p => <option key={p}>{p}</option>)}</select>
        <button className={btn} onClick={() => csv([['Dentist', 'Status', 'Practices', '3-month avg', 'Last 30 days', 'Avg case value', 'Top products', 'Main scanner', 'On time %', 'Remake rate %', 'Last case'], ...list.map(r => [r.dentist, r.status, r.practices.join('; '), r.avg, r.last30, r.avgCaseValue, r.topProducts.join('; '), r.scanner ?? '', r.onTimePct != null ? Math.round(r.onTimePct * 100) : '', r.remakeRate != null ? round2(r.remakeRate * 100) : '', r.lastCase ?? ''])], `dentists-${today()}.csv`)}><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead><tr><th className={th}>Dentist</th><th className={th}>6 months</th><th className={`${th} text-right`}>Avg case</th><th className={th}>Top products</th><th className={th}>Scanner</th><th className={`${th} text-right`}>On time</th><th className={`${th} text-right`}>Remakes</th><th className={th}>Last case</th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.dentist}>
                <td className={td}><span className="font-semibold">{r.dentist}</span> <Status h={r.status} /><span className="block text-[10px] text-[#717182]">{r.practices.join(', ')}</span></td>
                <td className={td}><Spark values={r.trend} /></td>
                <td className={`${td} text-right`}>{gbp(r.avgCaseValue)}</td>
                <td className={td}>{r.topProducts.join(', ')}</td>
                <td className={td}>{r.scanner ?? '—'}</td>
                <td className={`${td} text-right`}>{r.onTimePct != null ? `${Math.round(r.onTimePct * 100)}%` : '—'}</td>
                <td className={`${td} text-right`}>{r.remakeRate != null ? `${(r.remakeRate * 100).toFixed(1)}%` : '—'}</td>
                <td className={td}>{fmtShort(r.lastCase)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <Empty>No dentists match.</Empty>}
      </div>
    </Card>
  );
}

function Products() {
  const s = useBilling();
  const months = Array.from({ length: 6 }, (_, i) => { let m = monthOf(today()); for (let k = 0; k < i; k++) m = prevMonth(m); return m; });
  const [ym, setYm] = useState(months[1]);
  const [practice, setPractice] = useState('all');
  const data = useMemo(() => {
    const agg = (m: string) => {
      const out = new Map<string, { units: number; value: number; list: number }>();
      for (const inv of s.invoices) {
        if (!inv.issuedAt || inv.status === 'void' || monthOf(inv.issuedAt) !== m || (practice !== 'all' && inv.practice !== practice)) continue;
        for (const l of inv.lines) {
          if (!l.itemId) continue;
          const e = out.get(l.itemId) ?? { units: 0, value: 0, list: 0 };
          e.units += l.qty; e.value += lineNet(l); e.list += l.qty * l.listPrice; out.set(l.itemId, e);
        }
      }
      return out;
    };
    const cur = agg(ym), prev = agg(prevMonth(ym));
    const total = [...cur.values()].reduce((n, v) => n + v.value, 0);
    return [...cur].map(([id, v]) => ({ id, name: s.catalog.find(i => i.id === id)?.name ?? id, ...v, share: total ? v.value / total : 0, prev: prev.get(id)?.value ?? 0 })).sort((a, b) => b.value - a.value);
  }, [s, ym, practice]);
  const practices = [...new Set(s.invoices.map(i => i.practice))].sort();
  return (
    <Card title="Products" sub="Mix by value and count, change on the month before, and the price realised against list (how much discounting is happening)." pad={false}
      actions={<>
        <select className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" value={ym} onChange={e => setYm(e.target.value)} aria-label="Month">{months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}</select>
        <select className="px-2 py-1 rounded-md border border-[#E0E0E6] text-xs" value={practice} onChange={e => setPractice(e.target.value)} aria-label="Practice"><option value="all">All practices</option>{practices.map(p => <option key={p}>{p}</option>)}</select>
        <button className={btn} onClick={() => csv([['Product', 'Units', 'Value', 'Share %', 'Change vs month before %', 'Realised vs list %'], ...data.map(d => [d.name, d.units, round2(d.value), Math.round(d.share * 100), d.prev ? Math.round((d.value - d.prev) / d.prev * 100) : '', d.list ? Math.round(d.value / d.list * 100) : ''])], `products-${ym}.csv`)}><Download className="w-3.5 h-3.5" /> Export</button>
      </>}>
      {data.length === 0 ? <Empty>Nothing invoiced in {fmtMonth(ym)}.</Empty> : (
        <table className="w-full">
          <thead><tr><th className={th}>Product</th><th className={`${th} text-right`}>Units</th><th className={`${th} text-right`}>Value</th><th className={th}>Share</th><th className={`${th} text-right`}>vs month before</th><th className={`${th} text-right`}>Realised vs list</th></tr></thead>
          <tbody>
            {data.map(d => {
              const ch = d.prev ? (d.value - d.prev) / d.prev * 100 : null;
              const real = d.list ? d.value / d.list * 100 : null;
              return (
                <tr key={d.id}>
                  <td className={td}>{d.name}</td>
                  <td className={`${td} text-right`}>{d.units}</td>
                  <td className={`${td} text-right`}>{gbp(d.value)}</td>
                  <td className={td}><div className="h-1.5 w-28 rounded-full bg-[#F3F3F5]"><div className="h-full rounded-full bg-[#4D8EF7]" style={{ width: `${d.share * 100}%` }} /></div></td>
                  <td className={`${td} text-right ${ch != null && ch < 0 ? 'text-[#C62828]' : ''}`}>{pct(ch)}</td>
                  <td className={`${td} text-right ${real != null && real < 95 ? 'text-[#B45309] font-semibold' : ''}`}>{real != null ? `${Math.round(real)}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="px-4 py-2 text-[11px] text-[#717182]">{pl(data.reduce((n, d) => n + d.units, 0), 'unit')} in {fmtMonth(ym)}.</p>
    </Card>
  );
}
