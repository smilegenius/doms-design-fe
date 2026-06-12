import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, Eye, EyeOff, Check, X as XIcon, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PageLoader from '../components/PageLoader';

const SmileGeniusLogo = () => (
  <svg width="171" height="40" viewBox="0 0 171 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-auto">
    <path d="M165.562 29.1068C166.989 26.0695 164.967 27.0625 163.778 27.9386C144.154 42.3949 126.639 31.467 123.506 29.8808C121.977 29.1068 121.977 29.1068 121.977 29.1068C125.035 34.0716 131.977 39.3547 143.129 39.3547C155.204 39.3547 163.778 32.9034 165.562 29.1068Z" fill="url(#login_grad)"/>
    <path d="M166.72 25.7229C167.182 26.1365 167.77 26.3433 168.486 26.3433C169.186 26.3433 169.759 26.1365 170.204 25.7229C170.666 25.2933 170.896 24.7684 170.896 24.1479C170.896 23.5116 170.666 22.9866 170.204 22.573C169.759 22.1435 169.186 21.9287 168.486 21.9287C167.77 21.9287 167.182 22.1435 166.72 22.573C166.275 22.9866 166.052 23.5116 166.052 24.1479C166.052 24.7684 166.275 25.2933 166.72 25.7229Z" fill="#434343"/>
    <path d="M7.16303 27.1983C5.9568 27.1983 4.88276 26.9917 3.94091 26.5786C2.99906 26.1656 2.25549 25.6037 1.71021 24.8932C1.16492 24.1662 0.859234 23.3565 0.793139 22.4642H4.9819C5.03147 22.9434 5.25454 23.3317 5.65111 23.6292C6.04768 23.9266 6.53513 24.0753 7.11346 24.0753C7.64222 24.0753 8.04705 23.9762 8.32796 23.7779C8.62538 23.5631 8.7741 23.2904 8.7741 22.9599C8.7741 22.5634 8.56755 22.2742 8.15446 22.0925C7.74136 21.8942 7.07215 21.6794 6.14682 21.448C5.1554 21.2167 4.32922 20.9771 3.66827 20.7292C3.00732 20.4649 2.43725 20.06 1.95806 19.5148C1.47887 18.9529 1.23928 18.2011 1.23928 17.2593C1.23928 16.4661 1.45409 15.7473 1.8837 15.1029C2.32985 14.442 2.97427 13.9215 3.81698 13.5414C4.67621 13.1614 5.69242 12.9714 6.86561 12.9714C8.6006 12.9714 9.96381 13.401 10.9552 14.2602C11.9632 15.1194 12.5415 16.2596 12.6902 17.6806H8.7741C8.708 17.2014 8.49319 16.8214 8.12967 16.5405C7.78267 16.2596 7.32001 16.1191 6.74168 16.1191C6.24597 16.1191 5.86592 16.2183 5.60154 16.4166C5.33716 16.5983 5.20497 16.8544 5.20497 17.1849C5.20497 17.5815 5.41152 17.8789 5.82461 18.0772C6.25423 18.2755 6.91518 18.4738 7.80746 18.672C8.83193 18.9364 9.66638 19.2008 10.3108 19.4652C10.9552 19.713 11.517 20.1261 11.9962 20.7045C12.4919 21.2663 12.7481 22.0264 12.7646 22.9847C12.7646 23.7944 12.5332 24.5214 12.0706 25.1659C11.6244 25.7938 10.9718 26.2895 10.1125 26.653C9.26981 27.0165 8.28665 27.1983 7.16303 27.1983ZM33.0049 13.0209C34.7234 13.0209 36.0866 13.5414 37.0945 14.5824C38.119 15.6234 38.6312 17.0692 38.6312 18.9199V27H34.4177V19.49C34.4177 18.5977 34.1781 17.912 33.6989 17.4328C33.2362 16.9371 32.5918 16.6892 31.7656 16.6892C30.9394 16.6892 30.2868 16.9371 29.8076 17.4328C29.3449 17.912 29.1136 18.5977 29.1136 19.49V27H24.9V19.49C24.9 18.5977 24.6604 17.912 24.1812 17.4328C23.7186 16.9371 23.0742 16.6892 22.248 16.6892C21.4218 16.6892 20.7691 16.9371 20.2899 17.4328C19.8272 17.912 19.5959 18.5977 19.5959 19.49V27H15.3576V13.1696H19.5959V14.9046C20.0255 14.3263 20.5873 13.8719 21.2813 13.5414C21.9753 13.1944 22.7602 13.0209 23.636 13.0209C24.677 13.0209 25.6023 13.244 26.4119 13.6901C27.2381 14.1363 27.8826 14.7724 28.3452 15.5986C28.8244 14.8385 29.4771 14.2189 30.3033 13.7397C31.1295 13.2605 32.03 13.0209 33.0049 13.0209ZM43.727 11.7321C42.9834 11.7321 42.3721 11.5173 41.8929 11.0877C41.4302 10.6415 41.1989 10.0962 41.1989 9.45181C41.1989 8.79086 41.4302 8.24557 41.8929 7.81596C42.3721 7.36982 42.9834 7.14675 43.727 7.14675C44.454 7.14675 45.0489 7.36982 45.5116 7.81596C45.9907 8.24557 46.2303 8.79086 46.2303 9.45181C46.2303 10.0962 45.9907 10.6415 45.5116 11.0877C45.0489 11.5173 44.454 11.7321 43.727 11.7321ZM45.8338 13.1696V27H41.5954V13.1696H45.8338ZM53.1436 8.65867V27H48.9052V8.65867H53.1436ZM69.2523 19.8618C69.2523 20.2583 69.2275 20.6714 69.1779 21.101H59.5859C59.652 21.9603 59.9246 22.6212 60.4038 23.0839C60.8995 23.53 61.5026 23.7531 62.2132 23.7531C63.2707 23.7531 64.006 23.3069 64.4191 22.4147H68.9301C68.6987 23.3235 68.2774 24.1414 67.666 24.8684C67.0711 25.5955 66.3193 26.1656 65.4105 26.5786C64.5017 26.9917 63.4855 27.1983 62.3619 27.1983C61.0069 27.1983 59.8007 26.9091 58.7432 26.3308C57.6857 25.7525 56.8595 24.9263 56.2646 23.8522C55.6698 22.7782 55.3723 21.5224 55.3723 20.0848C55.3723 18.6473 55.6615 17.3915 56.2398 16.3174C56.8347 15.2434 57.6609 14.4172 58.7184 13.8389C59.7759 13.2605 60.9904 12.9714 62.3619 12.9714C63.7003 12.9714 64.89 13.2523 65.931 13.8141C66.972 14.3759 67.7817 15.1773 68.36 16.2183C68.9548 17.2593 69.2523 18.4738 69.2523 19.8618ZM64.9148 18.7464C64.9148 18.0194 64.6669 17.441 64.1712 17.0114C63.6755 16.5818 63.0559 16.367 62.3123 16.367C61.6018 16.367 60.9987 16.5735 60.503 16.9866C60.0238 17.3997 59.7263 17.9863 59.6107 18.7464H64.9148ZM81.9952 12.9714C82.9701 12.9714 83.821 13.1696 84.5481 13.5662C85.2916 13.9628 85.8617 14.4833 86.2583 15.1277V13.1696H90.4966V26.9752C90.4966 28.2475 90.2405 29.3959 89.7283 30.4204C89.2326 31.4614 88.4642 32.2876 87.4232 32.899C86.3987 33.5103 85.1181 33.816 83.5814 33.816C81.5325 33.816 79.8719 33.3286 78.5995 32.3537C77.3272 31.3953 76.6002 30.0899 76.4184 28.4376H80.6072C80.7394 28.9663 81.0533 29.3794 81.549 29.6768C82.0447 29.9908 82.6561 30.1478 83.3832 30.1478C84.2589 30.1478 84.9529 29.8917 85.4651 29.3794C85.9939 28.8837 86.2583 28.0823 86.2583 26.9752V25.0172C85.8452 25.6616 85.2751 26.1903 84.5481 26.6034C83.821 27 82.9701 27.1983 81.9952 27.1983C80.855 27.1983 79.8223 26.9091 78.897 26.3308C77.9716 25.7359 77.2363 24.9015 76.691 23.8274C76.1623 22.7369 75.8979 21.4811 75.8979 20.06C75.8979 18.639 76.1623 17.3915 76.691 16.3174C77.2363 15.2434 77.9716 14.4172 78.897 13.8389C79.8223 13.2605 80.855 12.9714 81.9952 12.9714ZM86.2583 20.0848C86.2583 19.0273 85.9609 18.1929 85.366 17.5815C84.7877 16.9701 84.0772 16.6644 83.2344 16.6644C82.3917 16.6644 81.6729 16.9701 81.0781 17.5815C80.4998 18.1763 80.2106 19.0025 80.2106 20.06C80.2106 21.1176 80.4998 21.9603 81.0781 22.5882C81.6729 23.1995 82.3917 23.5052 83.2344 23.5052C84.0772 23.5052 84.7877 23.1995 85.366 22.5882C85.9609 21.9768 86.2583 21.1423 86.2583 20.0848ZM106.6 19.8618C106.6 20.2583 106.575 20.6714 106.526 21.101H96.9337C96.9998 21.9603 97.2724 22.6212 97.7516 23.0839C98.2473 23.53 98.8505 23.7531 99.561 23.7531C100.618 23.7531 101.354 23.3069 101.767 22.4147H106.278C106.047 23.3235 105.625 24.1414 105.014 24.8684C104.419 25.5955 103.667 26.1656 102.758 26.5786C101.85 26.9917 100.833 27.1983 99.7097 27.1983C98.3547 27.1983 97.1485 26.9091 96.091 26.3308C95.0335 25.7525 94.2073 24.9263 93.6124 23.8522C93.0176 22.7782 92.7202 21.5224 92.7202 20.0848C92.7202 18.6473 93.0093 17.3915 93.5877 16.3174C94.1825 15.2434 95.0087 14.4172 96.0662 13.8389C97.1237 13.2605 98.3382 12.9714 99.7097 12.9714C101.048 12.9714 102.238 13.2523 103.279 13.8141C104.32 14.3759 105.129 15.1773 105.708 16.2183C106.303 17.2593 106.6 18.4738 106.6 19.8618ZM102.263 18.7464C102.263 18.0194 102.015 17.441 101.519 17.0114C101.023 16.5818 100.404 16.367 99.6601 16.367C98.9496 16.367 98.3465 16.5735 97.8508 16.9866C97.3716 17.3997 97.0742 17.9863 96.9585 18.7464H102.263ZM117.263 13.0209C118.882 13.0209 120.171 13.5497 121.13 14.6072C122.105 15.6482 122.592 17.0858 122.592 18.9199V27H118.378V19.49C118.378 18.5646 118.139 17.8459 117.66 17.3336C117.18 16.8214 116.536 16.5653 115.726 16.5653C114.917 16.5653 114.272 16.8214 113.793 17.3336C113.314 17.8459 113.074 18.5646 113.074 19.49V27H108.836V13.1696H113.074V15.0038C113.504 14.3924 114.082 13.9132 114.809 13.5662C115.536 13.2027 116.354 13.0209 117.263 13.0209ZM127.669 11.7321C126.925 11.7321 126.314 11.5173 125.835 11.0877C125.372 10.6415 125.141 10.0962 125.141 9.45181C125.141 8.79086 125.372 8.24557 125.835 7.81596C126.314 7.36982 126.925 7.14675 127.669 7.14675C128.396 7.14675 128.991 7.36982 129.453 7.81596C129.933 8.24557 130.172 8.79086 130.172 9.45181C130.172 10.0962 129.933 10.6415 129.453 11.0877C128.991 11.5173 128.396 11.7321 127.669 11.7321ZM129.776 13.1696V27H125.537V13.1696H129.776ZM146.504 13.1696V27H142.266V25.1163C141.836 25.7277 141.249 26.2234 140.506 26.6034C139.779 26.967 138.969 27.1487 138.077 27.1487C137.019 27.1487 136.086 26.9174 135.276 26.4547C134.466 25.9755 133.838 25.2898 133.392 24.3975C132.946 23.5052 132.723 22.456 132.723 21.2497V13.1696H136.937V20.6797C136.937 21.605 137.176 22.3238 137.655 22.836C138.135 23.3483 138.779 23.6044 139.589 23.6044C140.415 23.6044 141.068 23.3483 141.547 22.836C142.026 22.3238 142.266 21.605 142.266 20.6797V13.1696H146.504ZM155.175 27.1983C153.968 27.1983 152.894 26.9917 151.952 26.5786C151.011 26.1656 150.267 25.6037 149.722 24.8932C149.176 24.1662 148.871 23.3565 148.805 22.4642H152.993C153.043 22.9434 153.266 23.3317 153.663 23.6292C154.059 23.9266 154.547 24.0753 155.125 24.0753C155.654 24.0753 156.059 23.9762 156.34 23.7779C156.637 23.5631 156.786 23.2904 156.786 22.9599C156.786 22.5634 156.579 22.2742 156.166 22.0925C155.753 21.8942 155.084 21.6794 154.158 21.448C153.167 21.2167 152.341 20.9771 151.68 20.7292C151.019 20.4649 150.449 20.06 149.97 19.5148C149.49 18.9529 149.251 18.2011 149.251 17.2593C149.251 16.4661 149.466 15.7473 149.895 15.1029C150.341 14.442 150.986 13.9215 151.829 13.5414C152.688 13.1614 153.704 12.9714 154.877 12.9714C156.612 12.9714 157.975 13.401 158.967 14.2602C159.975 15.1194 160.553 16.2596 160.702 17.6806H156.786C156.72 17.2014 156.505 16.8214 156.141 16.5405C155.794 16.2596 155.332 16.1191 154.753 16.1191C154.258 16.1191 153.877 16.2183 153.613 16.4166C153.349 16.5983 153.217 16.8544 153.217 17.1849C153.217 17.5815 153.423 17.8789 153.836 18.0772C154.266 18.2755 154.927 18.4738 155.819 18.672C156.843 18.9364 157.678 19.2008 158.322 19.4652C158.967 19.713 159.529 20.1261 160.008 20.7045C160.504 21.2663 160.76 22.0264 160.776 22.9847C160.776 23.7944 160.545 24.5214 160.082 25.1659C159.636 25.7938 158.983 26.2895 158.124 26.653C157.281 27.0165 156.298 27.1983 155.175 27.1983Z" fill="#3C3C3C"/>
    <defs>
      <linearGradient id="login_grad" x1="166.052" y1="33.2046" x2="121.977" y2="33.2046" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4D8EF7"/>
        <stop offset="1" stopColor="#A59DFF"/>
      </linearGradient>
    </defs>
  </svg>
);

// Auth views are toggled inside the same card without a route change so the
// gradient background + intro reveal stay continuous.
type AuthView =
  | 'login'
  | 'forgot-password'
  | 'reset-sent'
  | 'reset-password'  // ↑ page user lands on after clicking the email link
  | 'reset-complete'; // ↑ confirmation after the new password is saved

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const portalHint = searchParams.get('portal'); // 'supplier' | 'admin' | 'clinic' | null
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Forgot-password view state — kept separate so the login email field
  // doesn't get clobbered while the user is mid-recovery.
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSending, setResetSending] = useState(false);
  // Set-new-password view state (what the user sees after clicking the email link)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState('');
  const [newPasswordSaving, setNewPasswordSaving] = useState(false);

  // Lightweight password strength evaluation so we can render live checklist hints.
  const pwdChecks = {
    length:    newPassword.length >= 8,
    upper:     /[A-Z]/.test(newPassword),
    number:    /\d/.test(newPassword),
    symbol:    /[^A-Za-z0-9]/.test(newPassword),
    match:     newPassword.length > 0 && newPassword === confirmPassword,
  };
  const passwordsMatch = confirmPassword.length === 0 || newPassword === confirmPassword;
  // Intro loader on first mount — then reveal the form with stagger
  const [bootLoading, setBootLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBootLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      login(email, password);
      // If the login was initiated by clicking a specific portal card, take
      // the user there directly. Otherwise drop them on the portal-select page.
      if (portalHint === 'admin') navigate('/admin');
      else if (portalHint === 'supplier') navigate('/supplier');
      else if (portalHint === 'clinic') navigate('/clinic');
      else navigate('/');
    }, 1200);
  }

  function handleForgotPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    const value = resetEmail.trim();
    if (!value) {
      setResetError('Please enter your email address.');
      return;
    }
    // Lightweight email shape check — full validation lives server-side.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setResetError('That doesn’t look like a valid email address.');
      return;
    }
    setResetError('');
    setResetSending(true);
    setTimeout(() => {
      setResetSending(false);
      setView('reset-sent');
    }, 1100);
  }

  function openForgotPassword() {
    // Pre-fill the reset form with whatever the user already typed on login.
    setResetEmail(email);
    setResetError('');
    setView('forgot-password');
  }

  function returnToLogin() {
    setResetEmail('');
    setResetError('');
    setNewPassword('');
    setConfirmPassword('');
    setNewPasswordError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setView('login');
  }

  // Simulates the user clicking the link in the email — jumps straight to the
  // "set new password" view. Used by the "Open reset link (demo)" button on
  // the reset-sent screen so reviewers can walk through the rest of the flow.
  function openResetLink() {
    setNewPasswordError('');
    setView('reset-password');
  }

  function handleNewPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setNewPasswordError('Please fill out both password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewPasswordError('Passwords don’t match.');
      return;
    }
    setNewPasswordError('');
    setNewPasswordSaving(true);
    setTimeout(() => {
      setNewPasswordSaving(false);
      setView('reset-complete');
    }, 1100);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/60 to-[#AEE3E6]/60 flex items-center justify-center px-4">
      {(loading || bootLoading) && <PageLoader />}
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg px-10 py-10 reveal-stagger">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <SmileGeniusLogo />
          </div>

          {/* ── LOGIN VIEW ──────────────────────────────────────────────── */}
          {view === 'login' && (
            <>
              {/* Heading */}
              <div className="mb-8 text-center">
                <h1 className="text-xl font-semibold text-[#030213] mb-1">Welcome back</h1>
                <p className="text-sm text-[#717182]">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3C3C3C] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@company.com"
                    className="w-full border border-[#E0E0E6] rounded-lg px-4 py-3 text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/40 focus:border-[#4D8EF7] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#3C3C3C] mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full border border-[#E0E0E6] rounded-lg px-4 py-3 text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/40 focus:border-[#4D8EF7] transition-colors"
                  />
                  {/* Brand-tinted Forgot Password link — sits flush right under the password input */}
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={openForgotPassword}
                      className="text-xs font-medium text-[#4D8EF7] hover:text-[#A59DFF] hover:underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white font-semibold text-sm rounded-lg py-3 hover:opacity-90 active:opacity-80 transition-opacity mt-2"
                >
                  Sign In
                </button>
              </form>

              {/* Demo credentials helper — one-click pre-fill so demos move quickly */}
              <div className="mt-5 rounded-xl border border-dashed border-[#D4CEE1] bg-[#FAF8FF] px-4 py-3">
                <p className="text-[10px] font-bold text-[#A59DFF] uppercase tracking-widest mb-1">Demo mode</p>
                <p className="text-[11px] text-[#717182] leading-snug">
                  This is a prototype — any email and password will sign you in.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('sajid@smilegenius.co.uk');
                      setPassword('demo');
                    }}
                    className="text-[#4D8EF7] hover:underline font-medium"
                  >
                    Use demo account
                  </button>
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="block mx-auto mt-6 text-xs text-[#717182] hover:text-[#030213] transition-colors"
              >
                ← Back to portal select
              </button>

              <p className="text-center text-xs text-[#A0A0B0] mt-4">
                SmileGenius · Dental Operations Suite
              </p>
            </>
          )}

          {/* ── FORGOT PASSWORD VIEW ────────────────────────────────────── */}
          {view === 'forgot-password' && (
            <>
              {/* Heading */}
              <div className="mb-6 text-center">
                <h1 className="text-xl font-semibold text-[#030213] mb-1">Did you forget your password?</h1>
                <p className="text-sm text-[#717182]">
                  Enter your account email and we’ll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#3C3C3C] mb-1.5">
                    Email <span className="text-[#A59DFF]">*</span>
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                    placeholder="you@company.com"
                    autoFocus
                    className={`w-full border rounded-lg px-4 py-3 text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none transition-colors ${
                      resetError
                        ? 'border-[#FECACA] bg-[#FFF8F8] focus:ring-2 focus:ring-[#F87171]/30 focus:border-[#F87171]'
                        : 'border-[#E0E0E6] focus:ring-2 focus:ring-[#4D8EF7]/40 focus:border-[#4D8EF7]'
                    }`}
                  />
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FFF8F8] border border-[#FECACA]">
                    <svg className="w-4 h-4 text-[#F87171] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    <p className="text-xs text-[#C62828]">{resetError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={returnToLogin}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4D8EF7] hover:text-[#A59DFF] hover:underline transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return back to Login page
                </button>

                <button
                  type="submit"
                  disabled={resetSending}
                  className="w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white font-semibold text-sm rounded-lg py-3 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-1 inline-flex items-center justify-center gap-2"
                >
                  {resetSending ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>

              <p className="text-center text-xs text-[#A0A0B0] mt-6">
                SmileGenius · Dental Operations Suite
              </p>
            </>
          )}

          {/* ── RESET LINK SENT (SUCCESS) VIEW ──────────────────────────── */}
          {view === 'reset-sent' && (
            <>
              <div className="flex flex-col items-center text-center">
                {/* Success badge with brand gradient ring */}
                <div className="relative mb-5">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#4D8EF7]/20 to-[#A59DFF]/20 blur-md" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center shadow-lg shadow-[#4D8EF7]/30">
                    <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <h1 className="text-xl font-semibold text-[#030213] mb-2">Check your inbox</h1>
                <p className="text-sm text-[#717182] mb-5 leading-relaxed">
                  We’ve sent a password reset link to
                  <br />
                  <span className="font-semibold text-[#030213]">{resetEmail}</span>
                </p>
                <div className="w-full rounded-xl border border-dashed border-[#D4CEE1] bg-[#FAF8FF] px-4 py-3 flex items-start gap-3 mb-6">
                  <Mail className="w-4 h-4 text-[#A59DFF] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#717182] leading-snug text-left">
                    The link expires in 30 minutes. Didn’t get it?{' '}
                    <button
                      type="button"
                      onClick={() => setView('forgot-password')}
                      className="text-[#4D8EF7] hover:underline font-medium"
                    >
                      Try a different email
                    </button>
                    .
                  </p>
                </div>
                {/* Demo shortcut — simulates the user clicking the reset link in
                    their inbox so reviewers can walk through the rest of the flow */}
                <button
                  type="button"
                  onClick={openResetLink}
                  className="w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white font-semibold text-sm rounded-lg py-3 hover:opacity-90 active:opacity-80 transition-opacity inline-flex items-center justify-center gap-2 mb-2"
                >
                  <Mail className="w-4 h-4" />
                  Open reset link (demo)
                </button>
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="w-full bg-white border border-[#E0E0E6] text-[#5A5568] font-semibold text-sm rounded-lg py-3 hover:bg-[#F8F9FC] transition-colors"
                >
                  Return to Login
                </button>
              </div>

              <p className="text-center text-xs text-[#A0A0B0] mt-6">
                SmileGenius · Dental Operations Suite
              </p>
            </>
          )}

          {/* ── SET NEW PASSWORD VIEW ─────────────────────────────────────
              Page the user lands on after clicking the reset link in their email.
              Shows new + confirm fields with show/hide toggles, live strength
              checklist, and a same-card return link if they change their mind. */}
          {view === 'reset-password' && (
            <>
              <div className="mb-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-[#4D8EF7]/15 to-[#A59DFF]/15 mb-3">
                  <Lock className="w-5 h-5 text-[#4D8EF7]" />
                </div>
                <h1 className="text-xl font-semibold text-[#030213] mb-1">Set a new password</h1>
                <p className="text-sm text-[#717182]">
                  Almost there — choose a new password for{' '}
                  <span className="font-medium text-[#030213]">{resetEmail || 'your account'}</span>.
                </p>
              </div>

              <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
                {/* New password with show/hide */}
                <div>
                  <label className="block text-sm font-medium text-[#3C3C3C] mb-1.5">
                    New password <span className="text-[#A59DFF]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setNewPasswordError(''); }}
                      placeholder="At least 8 characters"
                      autoFocus
                      className="w-full border border-[#E0E0E6] rounded-lg px-4 py-3 pr-11 text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/40 focus:border-[#4D8EF7] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#030213] transition-colors"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password with match-state styling */}
                <div>
                  <label className="block text-sm font-medium text-[#3C3C3C] mb-1.5">
                    Confirm new password <span className="text-[#A59DFF]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setNewPasswordError(''); }}
                      placeholder="Re-enter the password"
                      className={`w-full border rounded-lg px-4 py-3 pr-11 text-sm text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none transition-colors ${
                        !passwordsMatch
                          ? 'border-[#FECACA] bg-[#FFF8F8] focus:ring-2 focus:ring-[#F87171]/30 focus:border-[#F87171]'
                          : 'border-[#E0E0E6] focus:ring-2 focus:ring-[#4D8EF7]/40 focus:border-[#4D8EF7]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#030213] transition-colors"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {!passwordsMatch && (
                    <p className="text-xs text-[#C62828] mt-1.5 flex items-center gap-1">
                      <XIcon className="w-3 h-3" />
                      Passwords don’t match
                    </p>
                  )}
                </div>

                {/* Live strength checklist — each rule lights up as it's met. */}
                <div className="rounded-xl border border-[#E8EAF6] bg-[#FAFBFC] px-4 py-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest mb-1">Password must include</p>
                  {[
                    { label: 'At least 8 characters', ok: pwdChecks.length },
                    { label: 'One uppercase letter',  ok: pwdChecks.upper  },
                    { label: 'One number',            ok: pwdChecks.number },
                    { label: 'One symbol',            ok: pwdChecks.symbol },
                    { label: 'Both passwords match',  ok: pwdChecks.match  },
                  ].map(rule => (
                    <div key={rule.label} className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                        rule.ok ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF]' : 'bg-[#E8EAF6]'
                      }`}>
                        {rule.ok ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} /> : null}
                      </span>
                      <span className={`text-xs ${rule.ok ? 'text-[#030213] font-medium' : 'text-[#A0A0B0]'}`}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>

                {newPasswordError && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FFF8F8] border border-[#FECACA]">
                    <svg className="w-4 h-4 text-[#F87171] flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                    <p className="text-xs text-[#C62828]">{newPasswordError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={newPasswordSaving}
                  className="w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white font-semibold text-sm rounded-lg py-3 hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {newPasswordSaving ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      Updating…
                    </>
                  ) : (
                    'Reset password'
                  )}
                </button>

                <button
                  type="button"
                  onClick={returnToLogin}
                  className="block mx-auto text-xs text-[#717182] hover:text-[#030213] transition-colors"
                >
                  ← Cancel and return to Login
                </button>
              </form>

              <p className="text-center text-xs text-[#A0A0B0] mt-5">
                SmileGenius · Dental Operations Suite
              </p>
            </>
          )}

          {/* ── PASSWORD RESET COMPLETE VIEW ──────────────────────────────
              Shown after the new password is saved. Same gradient success badge
              style as the email-sent view to keep the visual story consistent. */}
          {view === 'reset-complete' && (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-[#4D8EF7]/20 to-[#A59DFF]/20 blur-md" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center shadow-lg shadow-[#4D8EF7]/30">
                    <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={2.5} />
                  </div>
                </div>
                <h1 className="text-xl font-semibold text-[#030213] mb-2">Password updated</h1>
                <p className="text-sm text-[#717182] mb-5 leading-relaxed">
                  Your password has been changed successfully. You can now sign in
                  to your account with the new password.
                </p>
                <div className="w-full rounded-xl border border-dashed border-[#D4CEE1] bg-[#FAF8FF] px-4 py-3 flex items-start gap-3 mb-6">
                  <Lock className="w-4 h-4 text-[#A59DFF] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#717182] leading-snug text-left">
                    For your security, any other active sessions have been signed out.
                    Use your new password from now on.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={returnToLogin}
                  className="w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white font-semibold text-sm rounded-lg py-3 hover:opacity-90 active:opacity-80 transition-opacity"
                >
                  Sign in to your account
                </button>
              </div>

              <p className="text-center text-xs text-[#A0A0B0] mt-6">
                SmileGenius · Dental Operations Suite
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
