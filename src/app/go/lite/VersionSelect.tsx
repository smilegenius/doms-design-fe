// ─── Smile Genius Go — choose a version ──────────────────────────────────────
// First thing at /go: the light version (short flow) or the full version that is
// still in development, each with the date it was last updated.
import { useNavigate } from 'react-router-dom';
import '../../../styles/go.css';
import { ArrowLeft, ChevronRight, Clock, Sparkles } from '../icons';
import { GoStoreProvider } from '../store';
import { GoMark, cx } from '../ui';

const VERSIONS = [
  {
    id: 'lite', to: '/go/lite/signin', title: 'Light version', date: '14 Oct 2026', tag: 'Ready to review',
    body: 'The short flow for busy practices.',
    flow: ['Sign in', 'Home', 'Create', 'Received', 'To dispatch'],
    icon: Sparkles, tone: 'go-grad text-white go-glow',
  },
  {
    id: 'dev', to: '/go/signin', title: 'In development version', date: '9 Oct 2026', tag: 'In development',
    body: 'The full app, still being built. Lab work, drafts, comments, audio and photo capture, invoices.',
    flow: ['Lab work', 'Drafts', 'Comments', 'Audio and photo', 'Account'],
    icon: Clock, tone: 'bg-go-violet-soft text-go-violet',
  },
];

function Versions() {
  const navigate = useNavigate();
  const open = (to: string) => {
    // Always start from the sign-in screen
    try { sessionStorage.removeItem('sg-go-auth'); } catch { /* ignore */ }
    navigate(to);
  };
  return (
    <div className="go-theme font-sans antialiased" data-theme="light">
      <div className="relative min-h-[100dvh] bg-go-bg overflow-hidden flex items-center justify-center p-5">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-go-lav/20 blur-[120px]" />
          <div className="absolute -bottom-48 right-[-10%] w-[620px] h-[620px] rounded-full bg-go-brand/15 blur-[130px]" />
        </div>
        <div className="relative w-full max-w-[640px] py-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-go-muted hover:text-go-ink mb-8">
            <ArrowLeft className="w-4 h-4" /> All portals
          </button>
          <div className="flex items-center gap-3">
            <GoMark size={48} />
            <div>
              <h1 className="text-[24px] font-bold text-go-ink leading-tight">Smile Genius <span className="go-grad-text">Go</span></h1>
              <p className="text-[13px] text-go-muted">Choose a version to open</p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {VERSIONS.map(v => (
              <button key={v.id} onClick={() => open(v.to)}
                className="group text-left rounded-[28px] bg-go-surface border border-go-line go-card-shadow p-5 hover:border-go-brand/50 hover:-translate-y-0.5 active:scale-[.99] transition flex flex-col">
                <span className={cx('w-12 h-12 rounded-2xl flex items-center justify-center', v.tone)}><v.icon className="w-6 h-6" /></span>
                <span className="mt-4 flex items-center gap-1.5">
                  <span className="text-[19px] font-bold text-go-ink leading-tight">{v.title}</span>
                  <ChevronRight className="w-5 h-5 text-go-faint group-hover:text-go-brand transition" />
                </span>
                <span className="mt-1 text-[13px] text-go-muted leading-relaxed">{v.body}</span>
                <span className="mt-4 flex flex-wrap gap-1.5">
                  {v.flow.map(f => <span key={f} className="h-6 px-2.5 rounded-full bg-go-raised text-[11.5px] font-medium text-go-ink2 inline-flex items-center">{f}</span>)}
                </span>
                <span className="mt-5 pt-4 border-t border-go-line flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-go-brand-ink">{v.tag}</span>
                  <span className="text-go-muted">Updated {v.date}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VersionSelect() {
  return <GoStoreProvider><Versions /></GoStoreProvider>;
}
