import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, Eye, EyeOff, HelpCircle, Plus, Trash2, ShieldCheck } from 'lucide-react';

type StepId = 1 | 2 | 3;

interface InviteUser {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  role: string;
  department: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Onboarding wizard — full-screen 3-step setup for a new Dental Group admin.
// Reached via /onboarding (typically from the Start Setup CTA in the invite email).
// Steps: 1 Set Password · 2 Business & User Details · 3 Invite Team
// ────────────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<StepId>(1);

  // Step 1 — password
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const passwordStrong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirm;

  // Step 2 — user info + dental group details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('Administration');
  const [employeeId, setEmployeeId] = useState('');
  const [userType, setUserType] = useState('Super-Admin');
  const [groupName, setGroupName] = useState('');
  const [website, setWebsite] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [phoneCode, setPhoneCode] = useState('+44');
  const [phone, setPhone] = useState('');

  // Step 3 — invite team
  const [users, setUsers] = useState<InviteUser[]>([
    { id: `u-${Date.now()}`, name: '', email: '', employeeId: '', role: 'Practice Manager', department: 'Operations' },
  ]);

  const canContinue = (() => {
    if (step === 1) return passwordStrong && passwordsMatch;
    if (step === 2) return firstName.trim() && department && userType && groupName.trim() && country;
    return true;
  })();

  function next() {
    if (step < 3) setStep((step + 1) as StepId);
    else finish();
  }
  function back() {
    if (step > 1) setStep((step - 1) as StepId);
  }
  function finish() {
    // Mock: log the user in and land them on the supplier portal.
    login('owner@smilegenius.co.uk', password || 'password');
    navigate('/portal-select');
  }

  function addUserRow() {
    setUsers((prev) => [...prev, { id: `u-${Date.now()}`, name: '', email: '', employeeId: '', role: 'Practice Manager', department: 'Operations' }]);
  }
  function removeUserRow(id: string) {
    setUsers((prev) => (prev.length === 1 ? prev : prev.filter((u) => u.id !== id)));
  }
  function updateUser(id: string, patch: Partial<InviteUser>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/40 to-[#AEE3E6]/40">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Stepper */}
        <Stepper current={step} />

        {/* Step content card */}
        <div className="bg-white rounded-3xl shadow-sm border border-[#F0EFF6] mt-8 p-8 sm:p-10 reveal">

          {step === 1 && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-[#030213] mb-1">Set your password</h2>
                <p className="text-sm text-[#717182]">Create a secure password to protect your account.</p>
              </div>
              <div className="space-y-4">
                <Field label="New Password" required>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters, one uppercase and one number"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#717182] hover:text-[#030213]"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Confirm Password" required>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className={inputCls}
                  />
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-[#C62828] mt-1.5">Passwords don't match.</p>
                  )}
                </Field>
                <PasswordStrength password={password} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-[#030213] mb-1">Please review and complete your details</h2>
                <p className="text-sm text-[#717182]">Help us get your registration set up by providing a few key details. You can update this later.</p>
              </div>

              {/* User Information */}
              <h3 className="text-base font-bold text-[#030213] mb-4">User Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <Field label="First Name" required>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Last Name">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Department" required>
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
                    {['Administration', 'Finance', 'Operations', 'Clinical', 'IT'].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Employee ID">
                  <input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls} placeholder="e.g. EMP-001" />
                </Field>
                <Field label="User Type" required className="sm:col-span-2">
                  <input value={userType} onChange={(e) => setUserType(e.target.value)} className={inputCls} placeholder="Super-Admin" />
                </Field>
              </div>

              {/* Dental Group Details */}
              <h3 className="text-base font-bold text-[#030213] mb-4">Dental Group Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name of the Dental Group" required className="sm:col-span-2">
                  <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={inputCls} placeholder="e.g. Smile Genius" />
                </Field>
                <Field label="Website" className="sm:col-span-2">
                  <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="smilegenius.com" />
                </Field>
                <Field label="Country" required>
                  <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                    <option value="">Select country…</option>
                    <option value="GB">United Kingdom</option>
                    <option value="IE">Ireland</option>
                    <option value="US">United States</option>
                    <option value="AU">Australia</option>
                  </select>
                </Field>
                <Field label="City">
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Address" className="sm:col-span-2">
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Postcode">
                  <input value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Contact No.">
                  <div className="flex items-center gap-2">
                    <select value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} className="px-3 py-2.5 border border-[#E0E0E6] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]">
                      {['+44', '+1', '+353', '+61'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="17548003451" />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-xl font-semibold text-[#030213] mb-1">Invite your team</h2>
                <p className="text-sm text-[#717182]">
                  Add the people you want to work with. They'll receive an email invitation —
                  <span className="font-medium text-[#030213]"> their status stays <span className="text-[#E65100]">Inactive</span> until they accept and finish onboarding</span>.
                </p>
              </div>

              <div className="space-y-3">
                {/* Header row */}
                <div className="hidden sm:grid grid-cols-[1.5fr_2fr_1fr_1.2fr_1.2fr_36px] gap-3 px-3 text-[10px] font-bold text-[#A0A0B0] uppercase tracking-widest">
                  <span>Name</span>
                  <span>Email</span>
                  <span>Employee ID</span>
                  <span>Role</span>
                  <span>Department</span>
                  <span />
                </div>
                {users.map((u, idx) => (
                  <div key={u.id} className="grid grid-cols-1 sm:grid-cols-[1.5fr_2fr_1fr_1.2fr_1.2fr_36px] gap-3 p-3 bg-[#F8F9FC] border border-[#F0EFF6] rounded-xl">
                    <input value={u.name} onChange={(e) => updateUser(u.id, { name: e.target.value })} placeholder="Full name" className={rowInputCls} />
                    <input type="email" value={u.email} onChange={(e) => updateUser(u.id, { email: e.target.value })} placeholder="email@company.com" className={rowInputCls} />
                    <input value={u.employeeId} onChange={(e) => updateUser(u.id, { employeeId: e.target.value })} placeholder="EMP-002" className={rowInputCls} />
                    <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })} className={rowInputCls}>
                      {['Super-Admin', 'Admin', 'Practice Manager', 'Finance', 'Reviewer', 'Member'].map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={u.department} onChange={(e) => updateUser(u.id, { department: e.target.value })} className={rowInputCls}>
                      {['Administration', 'Finance', 'Operations', 'Clinical', 'IT'].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => removeUserRow(u.id)}
                        disabled={users.length === 1}
                        title="Remove row"
                        className="p-2 text-[#A0A0B0] hover:text-[#C62828] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Status badge — always Inactive until they accept */}
                    <div className="sm:col-span-6 -mt-1 flex items-center gap-2 px-1">
                      <span className="text-[10px] text-[#A0A0B0]">Status:</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFCC80]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E65100]" />
                        Inactive · pending onboarding
                      </span>
                      {idx === 0 && (
                        <span className="text-[10px] text-[#A0A0B0]">— flips to Active once they finish their setup.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addUserRow}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
              >
                <Plus className="w-4 h-4" /> Add another user
              </button>

              <p className="text-[11px] text-[#A0A0B0] mt-6">
                You can skip this step and invite users later from <span className="font-medium text-[#5A5568]">Settings → User Management</span>.
              </p>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-[#5A5568] bg-gradient-to-r from-[#A5F3D0]/40 to-[#A59DFF]/30 hover:opacity-80 transition-opacity"
          >
            <HelpCircle className="w-4 h-4" />
            Help
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={back}
                className="px-5 py-2.5 text-sm font-medium border border-[#E0E0E6] text-[#5A5568] rounded-xl hover:bg-white transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {step === 3 ? 'Finish Setup' : 'Next'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ current }: { current: StepId }) {
  const steps: { id: StepId; label: string }[] = [
    { id: 1, label: 'Set Password' },
    { id: 2, label: 'Fill Details' },
    { id: 3, label: 'Invite User' },
  ];
  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((s, i) => {
        const isDone = current > s.id;
        const isActive = current === s.id;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  isDone
                    ? 'bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] border-transparent text-white shadow-sm shadow-[#4D8EF7]/40'
                    : isActive
                      ? 'bg-white border-[#4D8EF7] text-[#4D8EF7] shadow-sm'
                      : 'bg-white border-[#D4CEE1] text-[#A0A0B0]'
                }`}
              >
                {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : s.id}
              </div>
              <span className={`text-[11px] font-semibold mt-2 whitespace-nowrap ${isActive || isDone ? 'text-[#030213]' : 'text-[#A0A0B0]'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 sm:mx-6 mb-6 w-20 sm:w-40 h-0.5 rounded-full overflow-hidden bg-[#E8E8EC]">
                <div
                  className={`h-full transition-all ${current > s.id ? 'w-full bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF]' : 'w-0'}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Inline form helpers ──────────────────────────────────────────────────────
const inputCls =
  'w-full px-4 py-2.5 text-sm border border-[#E0E0E6] rounded-lg bg-white text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] transition-colors';

const rowInputCls =
  'w-full px-3 py-2 text-xs border border-[#E0E0E6] rounded-lg bg-white text-[#030213] placeholder:text-[#A0A0B0] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7] transition-colors';

function Field({ label, required, children, className = '' }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-[#5A5568] mb-1.5">
        {label}
        {required && <span className="text-[#C62828] ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8,         label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(password),       label: 'One uppercase letter' },
    { ok: /[0-9]/.test(password),       label: 'One number' },
  ];
  return (
    <ul className="space-y-1 mt-2">
      {checks.map((c) => (
        <li key={c.label} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-[#2E7D32]' : 'text-[#A0A0B0]'}`}>
          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${c.ok ? 'bg-[#2E7D32]' : 'bg-[#E0E0E6]'}`}>
            {c.ok && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
          </div>
          {c.label}
        </li>
      ))}
    </ul>
  );
}
