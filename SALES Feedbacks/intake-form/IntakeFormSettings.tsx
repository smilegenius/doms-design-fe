import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Code2, Copy, ExternalLink, Globe, ImagePlus, Monitor, RotateCcw, Smartphone, Trash2 } from 'lucide-react';
import Toggle from '../../src/app/components/Toggle';
import { useToast } from '../../src/app/context/ToastContext';
import { DEFAULT_PRESCRIPTION_CONFIG } from '../../src/app/data/prescriptionBuilder';
import { LAB_TEAM, portalDateTime } from '../lab-prescription-inbox/data';
import IntakeForm from './IntakeForm';
import {
  ACCENTS, buttonSnippet, embedSnippet, intakeEmailRecipients, intakeUrl, resetIntakeDemo, slugify,
  updateIntakeConfig, useIntake,
} from './intakeStore';

// ── Settings → Website Intake Form ───────────────────────────────────────────
// Card markup follows PrescriptionInboxSettings (itself modelled on the
// invoice inbox in SpendSettingsPage).

const MAX_LOGO = 2 * 1024 * 1024;
const card = 'bg-white rounded-xl border border-[#E0E0E6]';
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-[#E0E0E6] text-[#030213] bg-white hover:bg-[#F8F9FC] transition-colors whitespace-nowrap';

function CopyRow({ value, label, mono = true, multiline = false }: { value: string; label: string; mono?: boolean; multiline?: boolean }) {
  const { toast } = useToast();
  const copy = () => { navigator.clipboard?.writeText(value).catch(() => {}); toast.success(`${label} copied`); };
  return (
    <div className="flex items-start gap-2">
      {multiline
        ? <textarea readOnly value={value} rows={3} onFocus={e => e.target.select()} className={`flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] text-[11px] text-[#030213] resize-none focus:outline-none ${mono ? 'font-mono' : ''}`} />
        : <input readOnly value={value} onFocus={e => e.target.select()} className={`flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] text-xs text-[#030213] focus:outline-none ${mono ? 'font-mono' : ''}`} />}
      <button onClick={copy} className={btn}><Copy className="w-3.5 h-3.5" /> Copy</button>
    </div>
  );
}

export default function IntakeFormSettings() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { config, prefs, submissions } = useIntake();
  const logoInput = useRef<HTMLInputElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [slugDraft, setSlugDraft] = useState(config.slug);
  const url = intakeUrl(config.slug);
  const allServices = Object.keys(DEFAULT_PRESCRIPTION_CONFIG);
  const emailed = intakeEmailRecipients(prefs).map(e => LAB_TEAM.find(m => m.email === e)?.name ?? e);

  function onLogo(f?: File) {
    if (!f) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(f.type)) { toast.error('Use a PNG, JPG, SVG or WebP logo'); return; }
    if (f.size > MAX_LOGO) { toast.error('Logos must be 2MB or smaller'); return; }
    const r = new FileReader();
    r.onload = () => { updateIntakeConfig({ logo: String(r.result) }); toast.success('Logo updated'); };
    r.readAsDataURL(f);
  }

  function saveSlug() {
    const s = slugify(slugDraft);
    setSlugDraft(s);
    if (s === config.slug) return;
    updateIntakeConfig({ slug: s });
    toast.success('Form link updated. Update it on your website too: the old link stops working.');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#030213]">Website Intake Form</h2>
          <p className="text-xs text-[#717182] mt-0.5">
            A branded new-case form for your website. Every submission becomes a draft case in Cases for your team to check and confirm.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-medium text-[#5A5568]">{config.enabled ? 'Taking requests' : 'Turned off'}</span>
          <Toggle on={config.enabled} onChange={() => updateIntakeConfig({ enabled: !config.enabled })} />
        </div>
      </div>

      {/* Hero: the link + embed code */}
      <div className="rounded-2xl overflow-hidden border border-[#E0E0E6]">
        <div className="bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><Globe className="w-5 h-5 text-white" /></div>
          <div>
            <p className="text-xs font-semibold text-white/70 uppercase tracking-widest">Your intake form</p>
            <p className="text-sm font-semibold text-white mt-0.5">Link to it, or embed it on your website.</p>
          </div>
        </div>
        <div className="bg-white px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#030213] mb-1.5">Form link</p>
            <CopyRow value={url} label="Form link" />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <a href={url} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="w-3.5 h-3.5" /> Open form</a>
              <div className="flex items-center gap-1.5 text-xs text-[#717182]">
                <span className="font-mono">/intake/</span>
                <input value={slugDraft} onChange={e => setSlugDraft(e.target.value)} onBlur={saveSlug} onKeyDown={e => { if (e.key === 'Enter') saveSlug(); }} aria-label="Form address" className="w-44 px-2 py-1 rounded-md border border-[#E0E0E6] font-mono text-xs text-[#030213] focus:outline-none focus:border-[#4D8EF7]" />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#030213] mb-1.5 flex items-center gap-1.5"><Code2 className="w-3.5 h-3.5 text-[#4D8EF7]" /> Embed on your website</p>
            <CopyRow value={embedSnippet(config.slug, config.labName)} label="Embed code" multiline />
            <p className="text-[11px] text-[#717182] mt-1">Paste into any page that allows HTML (WordPress, Wix, Squarespace "Embed code" blocks). Allow about 1,100px of height.</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#030213] mb-1.5">Or add a button that opens it</p>
            <CopyRow value={buttonSnippet(config.slug, config.accent)} label="Button code" multiline />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Branding + services */}
        <div className="space-y-4">
          <div className={`${card} p-5 space-y-4`}>
            <p className="text-sm font-semibold text-[#030213]">Branding</p>
            <div className="flex items-center gap-4">
              <div className="w-24 h-16 rounded-lg border border-dashed border-[#E0E0E6] bg-[#F8F9FC] flex items-center justify-center overflow-hidden">
                {config.logo ? <img src={config.logo} alt="Lab logo" className="max-w-full max-h-full object-contain" /> : <ImagePlus className="w-5 h-5 text-[#A0A0B0]" />}
              </div>
              <div className="space-y-1.5">
                <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e => { onLogo(e.target.files?.[0]); e.target.value = ''; }} />
                <div className="flex gap-2">
                  <button onClick={() => logoInput.current?.click()} className={btn}><ImagePlus className="w-3.5 h-3.5" /> {config.logo ? 'Replace logo' : 'Upload logo'}</button>
                  {config.logo && <button onClick={() => updateIntakeConfig({ logo: null })} className={btn}><Trash2 className="w-3.5 h-3.5" /> Remove</button>}
                </div>
                <p className="text-[11px] text-[#717182]">PNG, JPG, SVG or WebP · up to 2MB. Shown at the top of the form.</p>
              </div>
            </div>
            <label className="block">
              <span className="block text-xs font-medium text-[#030213] mb-1">Lab name on the form</span>
              <input value={config.labName} onChange={e => updateIntakeConfig({ labName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm focus:outline-none focus:border-[#4D8EF7]" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-[#030213] mb-1">Welcome line</span>
              <textarea rows={2} maxLength={160} value={config.welcome} onChange={e => updateIntakeConfig({ welcome: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm resize-none focus:outline-none focus:border-[#4D8EF7]" />
            </label>
            <div>
              <span className="block text-xs font-medium text-[#030213] mb-1.5">Accent colour</span>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map(a => (
                  <button key={a.id} onClick={() => updateIntakeConfig({ accent: a.id })} title={a.label}
                    className={`w-8 h-8 rounded-full ring-offset-2 ${config.accent === a.id ? 'ring-2 ring-[#030213]' : ''}`}
                    style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }} aria-label={a.label} />
                ))}
              </div>
            </div>
          </div>

          <div className={`${card} p-5`}>
            <p className="text-sm font-semibold text-[#030213]">Services on the form</p>
            <p className="text-xs text-[#717182] mt-0.5 mb-3">Each service asks for the fields you've turned on in <button onClick={() => navigate('/growth/settings?tab=prescription-builder')} className="text-[#4D8EF7] font-medium hover:underline">Prescription Builder</button>.</p>
            <div className="flex flex-wrap gap-1.5">
              {allServices.map(s => {
                const on = config.services.includes(s);
                return (
                  <button key={s} onClick={() => {
                    if (on && config.services.length === 1) { toast.error('Keep at least one service on the form'); return; }
                    updateIntakeConfig({ services: on ? config.services.filter(x => x !== s) : [...config.services, s] });
                  }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]' : 'bg-white text-[#717182] border-[#E0E0E6] hover:bg-[#F8F9FC]'}`}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`${card} px-5 py-4 flex items-start gap-3`}>
            <span className="w-9 h-9 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0"><Bell className="w-4 h-4 text-[#1565C0]" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#030213]">Notifications</p>
              <p className="text-xs text-[#717182] mt-0.5">
                Each team member chooses in <span className="font-medium text-[#5A5568]">Settings → Notifications</span> whether they get the bell alert and an email for new website requests. {emailed.length ? <>Emailing now: <span className="font-medium text-[#5A5568]">{emailed.join(', ')}</span>.</> : 'No one is emailed yet.'}
              </p>
            </div>
            <button onClick={() => navigate('/growth/settings?tab=notifications&focus=intake-form')} className={btn}>Manage</button>
          </div>
        </div>

        {/* Live preview */}
        <div className={`${card} p-4 self-start xl:sticky xl:top-6`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-[#030213]">Preview</p>
            <div className="inline-flex p-0.5 bg-[#F3F3F5] rounded-lg">
              {([['desktop', Monitor], ['mobile', Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} onClick={() => setDevice(d)} className={`px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 ${device === d ? 'bg-white text-[#1565C0] font-semibold shadow-sm' : 'text-[#717182] font-medium'}`}>
                  <Icon className="w-3.5 h-3.5" /> {d === 'desktop' ? 'Desktop' : 'Mobile'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#F8F9FC] rounded-xl p-3 max-h-[720px] overflow-y-auto">
            <div className={device === 'mobile' ? 'max-w-[375px] mx-auto' : ''}>
              <IntakeForm config={config} preview />
            </div>
          </div>
          <p className="text-[11px] text-[#A0A0B0] mt-2">Preview only: sending is turned off here. Use "Open form" to try a real submission.</p>
        </div>
      </div>

      {/* Recent requests */}
      <div className={card}>
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-[#F0EFF6]">
          <div>
            <p className="text-sm font-semibold text-[#030213]">Recent requests</p>
            <p className="text-xs text-[#717182] mt-0.5">{submissions.length ? `${submissions.length} from your website` : 'Requests appear here, and as draft cases in Cases.'}</p>
          </div>
          {submissions.length > 0 && (
            <button onClick={() => { resetIntakeDemo(); setSlugDraft('smile-genius-lab'); toast.success('Intake demo reset'); }} className={btn}><RotateCcw className="w-3.5 h-3.5" /> Reset demo</button>
          )}
        </div>
        {submissions.length > 0 && (
          <div className="divide-y divide-[#F0EFF6]">
            {submissions.map(s => (
              <div key={s.caseId} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#030213]"><span className="font-mono font-semibold">{s.ref}</span> · {s.patientName} · {s.service}</p>
                  <p className="text-[11px] text-[#717182]">{s.dentist} · {s.practice}{s.knownPractice ? '' : ' (new practice)'} · {portalDateTime(s.at)}{s.files.length ? ` · ${s.files.length} file${s.files.length === 1 ? '' : 's'}` : ''}{s.notified.length ? ` · emailed ${s.notified.length}` : ''}</p>
                </div>
                <button onClick={() => navigate(`/growth/cases/quick-new/${encodeURIComponent(s.caseId)}`)} className={btn}>Review draft</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
