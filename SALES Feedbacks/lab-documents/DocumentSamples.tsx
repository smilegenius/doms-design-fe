import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Settings2, Wand2 } from 'lucide-react';
import { useToast } from '../../src/app/context/ToastContext';
import { casesFor } from '../bulk-actions/BulkDialogs';
import { SgOrderFormPrint } from '../bulk-actions/printForms';
import { DEFAULT_SETTINGS, getDocs, saveDocs, type DocsSettings } from './docsStore';
import { CaseLabel } from './DocumentPrint';
import { euBlocker } from './engine';
import CasePicker from './CasePicker';

// ── Samples: /growth/order-form/samples?config=A&case=… ──────────────────────
// What the order form looks like in each set-up labs asked for, on any case.
// Nothing here changes the lab's saved settings unless "Apply" is pressed.

const SAMPLE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120"><rect x="4" y="14" width="92" height="92" rx="22" fill="#0F4C81"/><path d="M28 70c10 14 34 14 44 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="36" cy="48" r="7" fill="#fff"/><circle cx="64" cy="48" r="7" fill="#fff"/><text x="116" y="62" font-family="Georgia, serif" font-size="40" font-weight="700" fill="#0F4C81">Northgate</text><text x="118" y="96" font-family="Arial, sans-serif" font-size="22" letter-spacing="6" fill="#5A7FA6">DENTAL LAB</text></svg>',
)}`;

// A made-up lab, so the samples show someone else's logo where ours used to be.
const LAB: Partial<DocsSettings> = { brandingOn: true, logo: SAMPLE_LOGO, logoWidth: 480, displayName: 'Northgate Dental Lab', address: '7 Mill Street\nLeeds\nLS9 8AB\nUnited Kingdom', phone: '0113 555 0190', mhra: 'CA019284', damas: 'DM-4471' };
const SIGNER: Partial<DocsSettings> = { signerName: 'Hannah Clarke', signerTitle: 'Registered Dental Technician' };
const EU_READY: Partial<DocsSettings> = { sites: [{ name: 'Northgate Dental Lab', address: '7 Mill Street, Leeds LS9 8AB, UK' }], authRep: { name: 'Liffey Device Representation Ltd', address: '22 Baggot Street, Dublin 2, Ireland' } };

interface Sample { id: string; title: string; who: string; expect: string; settings: Partial<DocsSettings>; render: 'form' | 'eu-blocked' | 'label' }
const SAMPLES: Sample[] = [
  { id: 'A', title: 'Nothing set up', who: 'Every lab, until they change something', expect: 'Smile Genius mark at the top, as today. Dentist, patient, delivery date and instructions highlighted (on by default).', settings: {}, render: 'form' },
  { id: 'B', title: 'Lab logo', who: 'Asked for by DB Digital and CM Ceramics', expect: 'Lab logo with its name, address, phone, MHRA and DAMAS at the top; "Powered by Smile Genius" in the footer.', settings: LAB, render: 'form' },
  { id: 'C', title: 'Logo and UK statement, typed signature', who: 'Asked for by K2 and Digident', expect: 'As B, plus the short UK statement at the bottom, signed with the signatory’s name in a handwriting style. One page.', settings: { ...LAB, ...SIGNER, statementOn: true, jurisdiction: 'UK', signatureMode: 'typed' }, render: 'form' },
  { id: 'D', title: 'UK and EU statements, signed in ink', who: 'For labs sending work to Ireland (Cinchortho)', expect: 'Both statements, UK first; the EU one names the manufacturing site and the EU authorised representative. A blank line to sign by hand.', settings: { ...LAB, ...SIGNER, ...EU_READY, statementOn: true, jurisdiction: 'Both', signatureMode: 'blank' }, render: 'form' },
  { id: 'E', title: 'EU without a representative', who: 'What a lab sees before it has one', expect: 'EU and "UK and EU" can’t be chosen, with the reason shown. Nothing EU prints.', settings: { ...LAB, ...SIGNER, statementOn: true }, render: 'eu-blocked' },
  { id: 'F', title: 'Case label', who: 'Asked for by Digident', expect: 'Optional. When switched on, a thermal label with the lab logo and contact, case ID, patient, practice, product and teeth, "custom-made device" and "Powered by Smile Genius", printed from the bottom-right of the order form on any case.', settings: { ...LAB, labelOn: true }, render: 'label' },
];

const preset = (p: Partial<DocsSettings>): DocsSettings => ({ ...DEFAULT_SETTINGS, ...p });

export default function DocumentSamples() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const sample = SAMPLES.find(s => s.id === (params.get('config') ?? 'A').toUpperCase()) ?? SAMPLES[0];
  const [caseId, setCaseId] = useState(params.get('case') ?? 'CASE-RS-2002');
  const c = casesFor([caseId])[0];
  const s = preset(sample.settings);
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] bg-white text-[#030213] hover:bg-[#F8F9FC]';
  const go = (config: string, id = caseId) => setParams({ config, case: id }, { replace: true });

  function apply() {
    // Lab info (name, address, phone) always stays the lab's own.
    saveDocs({ ...getDocs(), ...s });
    toast.success(`Sample ${sample.id} applied to your settings. Switch anything back in Settings › Order form.`);
    navigate(sample.render === 'label' ? `/growth/order-form/${caseId}?view=label` : `/growth/order-form/${caseId}`);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-[#717182] hover:text-[#030213]"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
          <h1 className="text-xl font-semibold text-[#030213] mt-1">Order form samples</h1>
          <p className="text-xs text-[#717182] max-w-2xl">Each set-up labs asked for, on any case you pick. Your saved settings aren't changed unless you apply a sample.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CasePicker value={caseId} onChange={id => { setCaseId(id); go(sample.id, id); }} />
          <button className={btn} onClick={() => navigate('/growth/settings?tab=order-form')}><Settings2 className="w-3.5 h-3.5" /> Settings › Order form</button>
          {sample.render !== 'eu-blocked' && <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#7C6BFF]" onClick={apply}><Wand2 className="w-3.5 h-3.5" /> Apply {sample.id} to my settings</button>}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <nav className="lg:w-72 flex-shrink-0 bg-white border border-[#E0E0E6] rounded-xl p-2 h-fit">
          {SAMPLES.map(x => (
            <button key={x.id} onClick={() => go(x.id)} className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 ${x.id === sample.id ? 'bg-gradient-to-r from-[#EEF4FF] to-[#F5F3FF]' : 'hover:bg-[#F8F9FC]'}`}>
              <p className="text-sm font-medium text-[#030213]"><span className="inline-block w-5 font-bold text-[#4D8EF7]">{x.id}</span>{x.title}</p>
              <p className="text-[11px] text-[#717182] pl-5">{x.who}</p>
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="bg-white border border-[#E0E0E6] rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-[#030213]">{sample.id} · {sample.title}{c ? ` · ${c.id}` : ''}</p>
            <p className="text-xs text-[#5A5568] mt-0.5 flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D32] mt-0.5 flex-shrink-0" /> Expected: {sample.expect}</p>
          </div>

          {!c ? <p className="text-sm text-[#717182]">Case {caseId} not found. Pick another.</p> : (
            <div className="bg-[#EEF0F4] rounded-xl p-4 sm:p-8 overflow-x-auto">
              {sample.render === 'label' ? (
                <div className="flex flex-wrap justify-center items-end gap-6">
                  <div className="text-center"><CaseLabel c={c} s={{ ...s, labelStock: '62x100' }} /><p className="text-[11px] text-[#717182] mt-1">62 × 100 mm</p></div>
                  <div className="text-center"><CaseLabel c={c} s={{ ...s, labelStock: '102x152' }} /><p className="text-[11px] text-[#717182] mt-1">102 × 152 mm</p></div>
                </div>
              ) : sample.render === 'eu-blocked' ? (
                <div className="mx-auto bg-white rounded-xl border border-[#E0E0E6] p-5 max-w-lg space-y-3">
                  <p className="text-xs font-semibold text-[#030213]">Settings › Order form › Conformity statement › Where you send work</p>
                  <div className="flex gap-1.5">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border bg-[#EEF4FF] border-[#4D8EF7] text-[#1565C0]">UK only</span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] text-[#5A5568] opacity-40 inline-flex items-center gap-1"><Ban className="w-3 h-3" /> EU only</span>
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E0E0E6] text-[#5A5568] opacity-40 inline-flex items-center gap-1"><Ban className="w-3 h-3" /> UK and EU</span>
                  </div>
                  <p className="text-[11px] text-[#B45309]">{euBlocker(s)}</p>
                  <p className="text-[11px] text-[#717182]">A Great Britain lab supplying Ireland generally needs an EU authorised representative, and the EU statement has to name them and every manufacturing site. Until both are filled in, nothing EU prints. The UK statement and the order form are unaffected.</p>
                  <button className={btn} onClick={() => navigate('/growth/settings?tab=order-form&group=statement')}>Add sites and a representative</button>
                </div>
              ) : (
                <div className="mx-auto bg-white shadow-md rounded-sm p-8 sm:p-10 w-full max-w-[794px]"><SgOrderFormPrint c={c} docs={s} /></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
