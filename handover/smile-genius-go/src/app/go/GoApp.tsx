// ─── Smile Genius Go — clinician / dentist mobile app (prototype) ────────────
// Mounted at /go/*. On a phone it runs full-screen; on desktop it sits in a
// device frame with a side panel for theme + jumping between key screens.
// Requirements came from the "Smile Genius Go" brief; the UI is our own and
// uses the web portals' palette (light) plus a matching dark theme.
import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Monitor, Moon, Search, Sun, X } from './icons';
import '../../styles/go.css';
import { DemoFill, FEATURES, GoStoreProvider, ThemePref, useGo } from './store';
import { PracticeId } from './data';
import { GoMark, Toaster, cx } from './ui';
import { KB_HEIGHT, SimKeyboard, useKeyboardTarget } from './Keyboard';
import { ForgotScreen, SignInScreen } from './screens/Auth';
import HomeScreen from './screens/Home';
import { CaseDetailScreen, LabWorkScreen } from './screens/LabWork';
import { DispatchScreen, ReceiveScreen } from './screens/Logistics';
import CaptureScreen from './screens/Capture';
import ManualCaseScreen from './screens/ManualCase';
import { FinanceScreen, InvoiceScreen, InvoicesComingSoon, StatementScreen } from './screens/Finance';
import { AccountScreen, AppearanceSettings, DashboardSettings, NotificationSettings, NotificationsScreen, PracticesSettings } from './screens/Account';

// Reviewer navigation. Each entry can carry scenarios: variants of the same
// screen (single vs multi-service Rx, clean vs flagged invoice…) that deep-link
// via route + query params, optionally scoping the practice switcher.
// `fill` sets the reviewer demo data (see DemoFill); `fills` renders a row of
// quick picks (1 · 2 · 3 · All) instead of a single link.
interface Scenario { label: string; to: string; practice?: PracticeId | 'all'; solo?: PracticeId; fill?: DemoFill; fills?: { label: string; fill: DemoFill }[] }
interface Jump extends Scenario { group: string; scenarios?: Scenario[] }

const JUMPS: Jump[] = [
  { group: 'Start', label: 'Sign in', to: '/go/signin', scenarios: [
    { label: 'Email & password', to: '/go/signin' },
    { label: 'Forgot password', to: '/go/forgot' },
  ] },
  { group: 'Start', label: 'Home', to: '/go/home', scenarios: [
    { label: 'Multiple practices', to: '/go/home', practice: 'all' },
    { label: 'Single practice · no dropdown', to: '/go/home', solo: 'isc' },
    { label: 'Filled statuses', to: '/go/home', fill: 4, fills: [
      { label: '1', fill: 1 }, { label: '2', fill: 2 }, { label: '3', fill: 3 }, { label: 'All', fill: 4 },
    ] },
    { label: 'Empty dashboard', to: '/go/home', fill: 0 },
  ] },
  { group: 'Start', label: 'Notifications', to: '/go/notifications' },
  { group: 'Lab work', label: 'All lab work', to: '/go/work', scenarios: [
    { label: 'All cases', to: '/go/work' },
    { label: 'Overdue', to: '/go/work?f=overdue' },
    { label: 'Ready to dispatch', to: '/go/work?f=ready' },
    { label: 'On hold', to: '/go/work?f=on-hold' },
    { label: 'Draft', to: '/go/work?f=draft' },
    { label: 'Arriving from lab', to: '/go/work?f=arriving' },
    { label: 'Additional information required', to: '/go/work?f=questions' },
    { label: 'At risk only', to: '/go/work?r=at-risk' },
    { label: 'Tomorrow’s appointments', to: '/go/work?day=1' },
  ] },
  { group: 'Lab work', label: 'Case detail', to: '/go/work/SG-28491', scenarios: [
    { label: 'Single service · not sent yet', to: '/go/work/SG-28491' },
    { label: 'Multi-service case · on hold', to: '/go/work/SG-28472' },
    { label: 'Multi-service · 2 dentures in stages + crown', to: '/go/work/SG-28526' },
    { label: 'Denture in stages · single service', to: '/go/work/SG-28497' },
    { label: 'Clear aligners in phases + retainer', to: '/go/work/SG-28520' },
    { label: 'Arrives after the fit (at risk)', to: '/go/work/SG-28466' },
    { label: 'In practice, ready for patient', to: '/go/work/SG-28460' },
  ] },
  { group: 'Lab work', label: 'Reply to the lab', to: '/go/work/SG-28485', scenarios: [
    { label: 'Case overview', to: '/go/work/SG-28485' },
    { label: 'Straight to comments', to: '/go/work/SG-28485?tab=messages' },
  ] },
  { group: 'Lab work', label: 'Print label and dispatch', to: '/go/work/SG-28491/dispatch', scenarios: [
    { label: 'Crown · private', to: '/go/work/SG-28491/dispatch' },
    { label: 'Partial denture · NHS', to: '/go/work/SG-28497/dispatch' },
  ] },
  { group: 'Lab work', label: 'Mark as received', to: '/go/work/SG-28488/receive', scenarios: [
    { label: 'Arrives before the appointment', to: '/go/work/SG-28488/receive' },
    { label: 'Arrives after the fit (at risk)', to: '/go/work/SG-28466/receive' },
  ] },
  { group: 'Lab work', label: 'Chase overdue work', to: '/go/work/SG-28479' },
  { group: 'Create', label: 'Dictate a case (audio)', to: '/go/new/audio', scenarios: [
    { label: 'Single service', to: '/go/new/audio' },
    { label: 'Multi-service case', to: '/go/new/audio?rx=multi' },
    { label: 'Everything heard, no review', to: '/go/new/audio?rx=clean' },
  ] },
  { group: 'Create', label: 'Photograph a lab form', to: '/go/new/capture', scenarios: [
    { label: 'Single service', to: '/go/new/capture' },
    { label: 'Multi-service case', to: '/go/new/capture?rx=multi' },
    { label: 'Everything read, no review', to: '/go/new/capture?rx=clean' },
  ] },
  { group: 'Create', label: 'Fill in a case', to: '/go/new/manual', scenarios: [
    { label: 'New case', to: '/go/new/manual' },
    { label: 'Finish a draft · single service', to: '/go/new/manual?draft=SG-D1004' },
    { label: 'Finish a draft · multi-service', to: '/go/new/manual?draft=SG-D1007' },
    { label: 'Finish a draft · stages + phases + crown', to: '/go/new/manual?draft=SG-D1012' },
  ] },
{ group: 'Invoices', label: 'All invoices', to: '/go/invoices', scenarios: [    { label: 'All invoices', to: '/go/invoices' },    { label: 'QC · needs review', to: '/go/invoices?s=qc' },    { label: 'Duplicates', to: '/go/invoices?s=duplicate' },    { label: 'Awaiting approval', to: '/go/invoices?s=awaiting' },    { label: 'Approved', to: '/go/invoices?s=approved' },    { label: 'Disputed', to: '/go/invoices?s=disputed' },    { label: 'Sent to Xero failed', to: '/go/invoices?s=xero-failed' },    { label: 'Statements', to: '/go/invoices?tab=statements' },  ] },
  { group: 'Invoices', label: 'Invoice review', to: '/go/invoices/invoice/PDW-7731', scenarios: [
    { label: 'Amount flagged', to: '/go/invoices/invoice/PDW-7731' },
    { label: 'All checks passed', to: '/go/invoices/invoice/NDL-10482' },
    { label: 'Possible duplicate', to: '/go/invoices/invoice/DE-2026-118' },
  ] },
  { group: 'Invoices', label: 'Statement review', to: '/go/invoices/statement/ST-DSU-0926', scenarios: [
    { label: 'Two lines to resolve', to: '/go/invoices/statement/ST-DSU-0926' },
    { label: 'All lines matched', to: '/go/invoices/statement/ST-NDL-0926' },
  ] },
  { group: 'Account', label: 'Account & appearance', to: '/go/account' },
];

function ThemeSwitch() {
  const { themePref, setThemePref } = useGo();
  const opts: { v: ThemePref; icon: React.ReactNode; label: string }[] = [
    { v: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { v: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { v: 'system', icon: <Monitor className="w-4 h-4" />, label: 'Auto' },
  ];
  return (
    <div className="flex p-1 rounded-2xl bg-go-surface border border-go-line">
      {opts.map(o => (
        <button key={o.v} onClick={() => setThemePref(o.v)} aria-pressed={themePref === o.v}
          className={cx('flex-1 h-9 px-3 rounded-xl text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition',
            themePref === o.v ? 'go-grad text-white' : 'text-go-muted hover:text-go-ink')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

function SidePanel() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const here = pathname + search;
  const { signIn, signOut, setPractice, practice: practiceNow, setSoloPractice, demoFill, setDemoFill } = useGo();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  // "Filled · All" and "Multiple practices" load the same data; remember which was picked
  const [pickedFill, setPickedFill] = useState(false);

  const jump = (s: Scenario) => {
    setSoloPractice(s.solo ?? null);
    // 4 = every status filled = the normal seed data
    setDemoFill(s.fill === undefined || s.fill === 4 ? null : s.fill);
    setPickedFill(!!s.fills);
    setPractice(s.solo ?? s.practice ?? 'all');
    if (s.to === '/go/signin' || s.to === '/go/forgot') { signOut(); navigate(s.to); return; }
    signIn();
    // Let the sign-in screen's own redirect run first, then land on the target.
    setTimeout(() => navigate(s.to), 0);
  };
  const toggle = (k: string) => setOpen(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const { soloPractice } = useGo();
  const fillOf = (s: Scenario) => (s.fill === undefined || s.fill === 4 ? null : s.fill);
  const isHere = (s: Scenario) => here === s.to && (s.fills
    ? pickedFill && !soloPractice
    : !pickedFill && fillOf(s) === demoFill && (s.solo ? s.solo === soloPractice : !soloPractice && (s.practice === undefined || s.practice === practiceNow)));
  const fillHere = (s: Scenario, f: DemoFill) => isHere(s) && (f === 4 ? demoFill === null : demoFill === f);

  // Search matches the item, its group or any of its scenarios; scenario hits auto-expand.
  const term = q.trim().toLowerCase();
  const hit = (t: string) => t.toLowerCase().includes(term);
  // Hidden features drop out of the reviewer index too
  const jumps = JUMPS.filter(j => FEATURES.invoices || j.group !== 'Invoices');
  const shown = jumps.map(j => {
    if (!term) return { j, scen: j.scenarios ?? [] };
    const self = hit(j.label) || hit(j.group);
    const scen = (j.scenarios ?? []).filter(s => self || hit(s.label));
    return self || scen.length ? { j, scen } : null;
  }).filter(Boolean) as { j: Jump; scen: Scenario[] }[];
  const groups = [...new Set(shown.map(x => x.j.group))];
  const total = jumps.reduce((n, j) => n + 1 + (j.scenarios?.length ?? 0), 0);

  return (
    <aside className="hidden lg:flex flex-col w-[300px] h-[min(844px,calc(100dvh-40px))] relative z-10">
      <button onClick={() => navigate('/')} className="self-start inline-flex items-center gap-1.5 text-[13px] font-medium text-go-muted hover:text-go-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> All portals
      </button>
      <div className="flex items-center gap-3">
        <GoMark size={44} />
        <div>
          <p className="text-[20px] font-bold text-go-ink leading-tight">Smile Genius <span className="go-grad-text">Go</span></p>
          <p className="text-[12.5px] text-go-muted">Mobile app for dental practices</p>
        </div>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted mt-6 mb-2">Appearance</p>
      <ThemeSwitch />
      <div className="flex items-baseline justify-between mt-6 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-go-muted">Jump to screen</p>
        <span className="text-[11px] text-go-faint">{total} views</span>
      </div>
      <label className="flex items-center gap-2 h-10 px-3 rounded-xl bg-go-surface border border-go-line focus-within:border-go-brand focus-within:ring-4 focus-within:ring-go-brand/15 transition mb-2">
        <Search className="w-4 h-4 text-go-muted flex-shrink-0" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search screens & scenarios"
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-go-ink placeholder:text-go-faint" />
        {q && <button onClick={() => setQ('')} aria-label="Clear search" className="text-go-muted"><X className="w-4 h-4" /></button>}
      </label>
      <div className="go-scroll overflow-y-auto -mx-2 px-2 pb-2 flex-1 min-h-0">
        {groups.map(g => (
          <div key={g} className="mb-3">
            <p className="text-[11px] text-go-faint font-medium px-2 mb-1">{g}</p>
            {shown.filter(x => x.j.group === g).map(({ j, scen }) => {
              const expanded = !!scen.length && (!!term || open.has(j.label));
              const activeChild = !!j.scenarios?.some(isHere);
              return (
                <div key={j.label}>
                  <div className={cx('flex items-center rounded-xl transition',
                    here === j.to || (activeChild && !expanded) ? 'bg-go-brand-soft' : 'hover:bg-go-surface')}>
                    <button onClick={() => jump(j)}
                      className={cx('flex-1 text-left pl-3 py-2 text-[13px] font-medium',
                        here === j.to || activeChild ? 'text-go-brand-ink' : 'text-go-ink2')}>
                      {j.label}
                    </button>
                    {!!j.scenarios?.length && (
                      <button onClick={() => toggle(j.label)} aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'Show'} scenarios for ${j.label}`}
                        className="h-8 px-2 mr-1 rounded-lg inline-flex items-center gap-1 text-[11px] text-go-faint hover:text-go-ink hover:bg-go-raised">
                        {j.scenarios.length}
                        <ChevronDown className={cx('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="ml-4 pl-3 border-l border-go-line my-0.5">
                      {scen.map(s => s.fills ? (
                        <div key={s.label} className={cx('flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-lg text-[12.5px] transition',
                          isHere(s) ? 'bg-go-brand-soft text-go-brand-ink font-medium' : 'text-go-muted')}>
                          <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                          <span className="flex-1">{s.label}</span>
                          <span className="flex gap-1">
                            {s.fills.map(f => (
                              <button key={f.label} onClick={() => jump({ ...s, fill: f.fill })} aria-pressed={fillHere(s, f.fill)}
                                aria-label={`${s.label}: ${f.label}`}
                                className={cx('h-6 min-w-[26px] px-1.5 rounded-md text-[11px] font-semibold transition',
                                  fillHere(s, f.fill) ? 'go-grad text-white' : 'bg-go-surface border border-go-line text-go-ink2 hover:border-go-brand')}>
                                {f.label}
                              </button>
                            ))}
                          </span>
                        </div>
                      ) : (
                        <button key={s.label} onClick={() => jump(s)}
                          className={cx('w-full text-left px-2.5 py-1.5 rounded-lg text-[12.5px] transition flex items-center gap-2',
                            isHere(s) ? 'bg-go-brand-soft text-go-brand-ink font-medium' : 'text-go-muted hover:text-go-ink hover:bg-go-surface')}>
                          <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />{s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {!shown.length && <p className="text-[12.5px] text-go-muted px-2 py-4">No screens match “{q}”.</p>}
      </div>
    </aside>
  );
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);
  return (
    <div className="hidden sm:flex relative z-[65] h-[50px] flex-shrink-0 items-center justify-between px-8 pt-1 text-go-ink">
      <span className="text-[15px] font-semibold tabular-nums">{now.getHours() % 12 || 12}:{String(now.getMinutes()).padStart(2, '0')}</span>
      <span className="absolute left-1/2 -translate-x-1/2 top-[11px] w-[118px] h-[33px] rounded-full bg-black" />
      <span className="flex items-center gap-1.5">
        <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><path d="M8 2.2c2.2 0 4.2.8 5.7 2.2l1.1-1.2A10 10 0 0 0 8 .5 10 10 0 0 0 1.2 3.2l1.1 1.2A8.3 8.3 0 0 1 8 2.2Zm0 3.4c1.3 0 2.5.5 3.4 1.3l1.1-1.2A6.6 6.6 0 0 0 8 3.9a6.6 6.6 0 0 0-4.5 1.8l1.1 1.2A5 5 0 0 1 8 5.6Zm0 3.3L6.2 7.6a2.7 2.7 0 0 1 3.6 0L8 8.9Z" /></svg>
        <span className="relative w-[26px] h-[12px] rounded-[4px] border border-current/40 p-[1.5px]"><span className="block h-full w-[78%] rounded-[2px] bg-current" /></span>
      </span>
    </div>
  );
}

function RequireAuth() {
  const { signedIn } = useGo();
  return signedIn ? <Outlet /> : <Navigate to="/go/signin" replace />;
}

function GoRoutes() {
  const { signedIn } = useGo();
  const { pathname, search } = useLocation();
  return (
    <div key={pathname.startsWith('/go/new') ? pathname + search : pathname} className="absolute inset-0 go-fade-in">
      <Routes>
        <Route path="signin" element={signedIn ? <Navigate to="/go/home" replace /> : <SignInScreen />} />
        <Route path="forgot" element={<ForgotScreen />} />
        <Route element={<RequireAuth />}>
          <Route path="home" element={<HomeScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="work" element={<LabWorkScreen />} />
          <Route path="work/:id" element={<CaseDetailScreen />} />
          <Route path="work/:id/dispatch" element={<DispatchScreen />} />
          <Route path="work/:id/receive" element={<ReceiveScreen />} />
          <Route path="new/audio" element={<CaptureScreen key="audio" mode="audio" />} />
          <Route path="new/capture" element={<CaptureScreen key="photo" mode="photo" />} />
          <Route path="new/manual" element={<ManualCaseScreen />} />
          <Route path="invoices" element={FEATURES.invoices ? <FinanceScreen /> : <InvoicesComingSoon />} />
          <Route path="finance/*" element={<Navigate to="/go/invoices" replace />} />
          <Route path="invoices/invoice/:id" element={FEATURES.invoices ? <InvoiceScreen /> : <Navigate to="/go/invoices" replace />} />
          <Route path="invoices/statement/:id" element={FEATURES.invoices ? <StatementScreen /> : <Navigate to="/go/invoices" replace />} />
          <Route path="account" element={<AccountScreen />} />
          <Route path="account/appearance" element={<AppearanceSettings />} />
          <Route path="account/practices" element={<PracticesSettings />} />
          <Route path="account/notifications" element={<NotificationSettings />} />
          <Route path="account/dashboard" element={<DashboardSettings />} />
        </Route>
        <Route path="*" element={<Navigate to={signedIn ? '/go/home' : '/go/signin'} replace />} />
      </Routes>
    </div>
  );
}

/** Fit the 844px-tall frame into short laptop screens. */
function useFrameScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(window.innerWidth < 640 ? 1 : Math.min(1, (window.innerHeight - 40) / 866));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

function GoFrame() {
  const { theme, setSheetRoot, sheetRoot } = useGo();
  const scale = useFrameScale();
  const { pathname: routePath } = useLocation();
  const kbTarget = useKeyboardTarget(sheetRoot, routePath);
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Smile Genius Go'; }, []);
  // Presentation (backdrop + side panel) stays light; only the phone follows the theme
  return (
    <div className="go-theme font-sans antialiased" data-theme="light">
      <div className="relative min-h-[100dvh] bg-go-bg sm:flex sm:items-center sm:justify-center sm:gap-16 sm:p-5 overflow-hidden">
        {/* Desktop backdrop — the portal-select wash, re-tinted per theme */}
        <div className="hidden sm:block pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full bg-go-lav/20 blur-[120px]" />
          <div className="absolute -bottom-48 right-[-10%] w-[620px] h-[620px] rounded-full bg-go-brand/15 blur-[130px]" />
          <div className="absolute top-1/3 left-1/2 w-[380px] h-[380px] rounded-full bg-go-teal/10 blur-[110px]" />
        </div>

        <SidePanel />

        {/* Compact controls between sm and lg (no side panel) */}
        <div className="hidden sm:flex lg:hidden absolute top-4 left-4 right-4 z-10 items-center justify-between">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-go-muted hover:text-go-ink">
            <ArrowLeft className="w-4 h-4" /> All portals
          </button>
          <div className="w-[260px]"><ThemeSwitch /></div>
        </div>

        {/* Device */}
        <div className="relative sm:flex-shrink-0 sm:overflow-hidden sm:rounded-[58px]" style={scale < 1 ? { width: 390 * scale, height: 844 * scale } : undefined}>
          {/* Bezel: dark on the light theme, light grey on the dark theme so the screen edge reads */}
          <div className={cx('relative w-full h-[100dvh] sm:w-[390px] sm:h-[844px] sm:rounded-[58px] sm:p-[10px] origin-top-left',
            theme === 'dark'
              ? 'sm:bg-[#C9CCD4] sm:shadow-[0_40px_100px_-30px_rgba(16,24,64,.45),inset_0_0_0_1.5px_rgba(255,255,255,.7),inset_0_0_0_3px_rgba(16,24,64,.08)]'
              : 'sm:bg-[#0A0A12] sm:shadow-[0_40px_100px_-30px_rgba(16,24,64,.45),inset_0_0_0_1.5px_rgba(255,255,255,.08)]')}
            style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>
            <div data-theme={theme} className={cx('go-theme go-wash relative h-full w-full overflow-clip sm:rounded-[48px] sm:[clip-path:inset(0_round_48px)] flex flex-col', kbTarget && 'go-kb-open')} ref={setSheetRoot}
              style={{ '--go-kb': kbTarget ? `${KB_HEIGHT}px` : '0px' } as React.CSSProperties}>
              <StatusBar />
              {/* Shrinks by the keyboard height so content + sticky actions ride up */}
              <div className="relative flex-1 min-h-0 transition-[margin] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]" style={{ marginBottom: 'var(--go-kb)' }}>
                <GoRoutes />
              </div>
              <Toaster />
              <SimKeyboard target={kbTarget} theme={theme} />
              <span className="hidden sm:block pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 w-[134px] h-[5px] rounded-full bg-go-ink/80 z-[70]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GoApp() {
  return (
    <GoStoreProvider>
      <GoFrame />
    </GoStoreProvider>
  );
}
