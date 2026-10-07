import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from '../icons';
import { ME, useGo } from '../store';
import { BrandWordmark, Btn, Input, Label, Screen, TopBar, cx } from '../ui';

const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);
const MsLogo = () => (
  <svg width="16" height="16" viewBox="0 0 16 16"><rect width="7.5" height="7.5" fill="#F25022" /><rect x="8.5" width="7.5" height="7.5" fill="#7FBA00" /><rect y="8.5" width="7.5" height="7.5" fill="#00A4EF" /><rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#FFB900" /></svg>
);

export function SignInScreen() {
  const { signIn } = useGo();
  const navigate = useNavigate();
  const [email, setEmail] = useState(ME.email);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | 'google' | 'microsoft' | 'email'>(null);

  const go = (via: 'google' | 'microsoft' | 'email') => {
    setBusy(via);
    setTimeout(() => { signIn(); navigate('/go/home', { replace: true }); }, 900);
  };

  const sso = (via: 'google' | 'microsoft', icon: React.ReactNode, label: string) => (
    <button onClick={() => go(via)} disabled={!!busy}
      className="flex-1 h-12 rounded-2xl bg-go-surface border border-go-line text-[14px] font-semibold text-go-ink flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-60">
      {busy === via ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : icon}{label}
    </button>
  );

  return (
    <Screen bg="bg-go-bg">
      <div className="relative min-h-full flex flex-col px-6">
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-go-lav/25 blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -left-24 w-64 h-64 rounded-full bg-go-brand/20 blur-3xl pointer-events-none" />

        <div className="relative pt-16">
          <h1 className="text-[28px] font-bold text-go-ink tracking-tight">Welcome back</h1>
          <p className="text-[14px] text-go-muted mt-1">Sign in to <span className="go-grad-text font-semibold">Smile Genius Go</span></p>
        </div>

        <form className="relative mt-9 space-y-3" onSubmit={e => { e.preventDefault(); if (email && pw) go('email'); }}>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-go-faint pointer-events-none" />
            <Input type="email" aria-label="Work email" placeholder="Work email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" className="pl-11" />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-go-faint pointer-events-none" />
            <Input type={show ? 'text' : 'password'} aria-label="Password" placeholder="Password (any, demo)" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" className="pl-11 pr-12" />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl text-go-muted flex items-center justify-center">
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => navigate('/go/forgot')} className="text-[12.5px] font-semibold text-go-brand">Forgot password?</button>
          </div>
          <Btn type="submit" block disabled={!email || !pw || !!busy}>
            {busy === 'email' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in'}
          </Btn>
        </form>

        <div className="relative flex items-center gap-3 my-6">
          <span className="h-px flex-1 bg-go-line" /><span className="text-[12px] text-go-faint">or</span><span className="h-px flex-1 bg-go-line" />
        </div>
        <div className="relative flex gap-3">
          {sso('google', <GoogleG />, 'Google')}
          {sso('microsoft', <MsLogo />, 'Microsoft')}
        </div>

        {/* Full brand wordmark at the foot of the screen, centred and soft */}
        <div className="relative mt-auto pt-10 pb-8 flex justify-center pointer-events-none">
          <BrandWordmark width={120} className="opacity-50" />
        </div>
      </div>
    </Screen>
  );
}

export function ForgotScreen() {
  const [email, setEmail] = useState(ME.email);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  return (
    <Screen header={<TopBar back fallback="/go/signin" />}>
      <div className="px-6 pt-2">
        {!sent ? (
          <>
            <h1 className="text-[26px] font-bold text-go-ink tracking-tight">Reset your password</h1>
            <p className="text-[14px] text-go-muted mt-2 leading-relaxed">Enter your work email. We’ll send a secure link to set a new password.</p>
            <div className="mt-6"><Label>Work email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="mt-4 p-3.5 rounded-2xl bg-go-brand-soft text-[12.5px] text-go-brand-ink leading-relaxed">
              If your practice signs in with Google or Microsoft, reset your password with your IT provider instead.
            </div>
            <Btn block className="mt-6" disabled={!email} onClick={() => setSent(true)}>Send reset link</Btn>
          </>
        ) : (
          <div className="flex flex-col items-center text-center pt-10">
            <span className={cx('w-20 h-20 rounded-[28px] go-grad go-glow text-white flex items-center justify-center')}><MailCheck className="w-9 h-9" /></span>
            <h1 className="text-[24px] font-bold text-go-ink mt-6">Check your email</h1>
            <p className="text-[14px] text-go-muted mt-2 leading-relaxed">We sent a reset link to <span className="font-semibold text-go-ink">{email}</span>. It expires in 30 minutes.</p>
            <Btn block className="mt-8" onClick={() => navigate('/go/signin')}>Back to sign in</Btn>
            <button onClick={() => setSent(false)} className="mt-4 text-[13px] font-semibold text-go-brand">Didn’t get it? Send again</button>
            <p className="text-[12px] text-go-faint mt-6">Demo only. No email is sent.</p>
          </div>
        )}
      </div>
    </Screen>
  );
}
