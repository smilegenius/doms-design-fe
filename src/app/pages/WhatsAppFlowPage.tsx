import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, MessageCircle, FlaskConical, Stethoscope, Cpu, RotateCcw, LogIn,
  Link2, Unlink, ToggleRight, FileText, PenLine, Play, AlertTriangle, ShieldAlert, ScrollText,
  Sparkles, Smartphone, Send, UserCog,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import SmileGeniusWordmark from '../components/SmileGeniusWordmark';
import { removeWhatsAppCommunications } from '../data/caseCommunications';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  setWhatsAppEnabled,
  useWhatsAppComms,
  whatsappBlockReason,
  BLOCK_REASON_TEXT,
} from '../data/whatsappComms';

// ─── WhatsApp communication — flow walkthrough ───────────────────────────────
// Same shape as the CareStack walkthrough: every step of the epic in order,
// with the persona, what the screen shows and a button that deep-links straight
// to it (signing in first if needed). Standalone — no shell, no auth.
//
// The epic has two halves, and the walkthrough keeps them apart because the
// product does: the LAB configures the channel in Settings, and the channel is
// then used on a case — automatically by the scoring outcomes, manually from
// the Conversation hub. Both send from the lab's own connected WhatsApp
// Business number, never from a Smile Genius one.

type Persona = 'lab' | 'dentist' | 'system';

interface Step {
  title: string;
  persona: Persona;
  icon: React.ReactNode;
  description: string;
  /** States the user will see on that screen. */
  shows?: string[];
  /** How to try it once the screen is open. */
  tryIt?: string[];
  path: string;
  /** The one to demo first. */
  highlight?: boolean;
}

interface Stage {
  label: string;
  blurb: string;
  steps: Step[];
}

const PERSONA: Record<Persona, { label: string; cls: string; icon: React.ReactNode }> = {
  lab:     { label: 'Lab',                cls: 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]', icon: <FlaskConical className="w-3 h-3" /> },
  dentist: { label: 'Dentist',            cls: 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]', icon: <Stethoscope className="w-3 h-3" /> },
  system:  { label: 'Smile Genius (auto)',cls: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]', icon: <Cpu className="w-3 h-3" /> },
};

// Settings → Case Scoring → Automated Communication, with the channel picker
// on WhatsApp. Every set-up step lands on this one screen.
const WA_SETTINGS = '/lab/settings?tab=case-scoring&sub=case-emails&channel=whatsapp';
const DEMO_CASE = '/lab/cases/CASE-WA-3001?conversation=1&channel=whatsapp';

const STAGES: Stage[] = [
  {
    label: 'Connect the channel',
    blurb: 'WhatsApp is configured once by the lab, in Settings. Two switches govern every send and they are deliberately separate: the WhatsApp communication setting, and whether a Business account is actually linked.',
    steps: [
      {
        title: 'Link the lab’s WhatsApp Business account',
        persona: 'lab',
        icon: <Link2 className="w-4 h-4" />,
        description: 'Settings → Case Scoring → Automated Communication → WhatsApp. The connection card carries the linking flow: business details, a consent beat (where the real product hands off to Meta’s embedded signup), then the connected number every message goes out from.',
        shows: ['Smile Genius Lab · +44 7700 900482', 'Connected since 12 Aug 2026', 'Disconnect / Reconnect / Connect a different account'],
        tryIt: ['Press "Connect WhatsApp" and complete the two-step link', 'Disconnect, then use "Reconnect" — the same account comes back'],
        path: WA_SETTINGS,
      },
      {
        title: 'The master WhatsApp communication setting',
        persona: 'lab',
        icon: <ToggleRight className="w-4 h-4" />,
        description: 'The lab-wide switch on the banner, beside the connection — both answer whether WhatsApp can be used at all. Off means nothing leaves the platform over WhatsApp; the account can stay linked.',
        shows: ['On — WhatsApp can be used', 'Off — “WhatsApp communication is turned off for this lab.”'],
        path: WA_SETTINGS,
      },
      {
        title: 'Automatic or Manual, and which outcomes send',
        persona: 'lab',
        icon: <MessageCircle className="w-4 h-4" />,
        description: 'The WhatsApp Automation card is built exactly like the Email one: an Automatic / Manual switch on the header, then a toggle and one selected message per scoring outcome. Automatic sends the moment a case is scored; Manual sends nothing by itself and greys the outcomes out — the lab sends from the case instead.',
        shows: ['Automatic | Manual', 'Needs Review — on/off + one message', 'Incomplete — on/off + one message'],
        tryIt: ['Switch to Manual and watch the outcomes dim', 'Back on Automatic, turn Needs Review on', 'Open the message dropdown and switch between Default Message 1 and 2'],
        path: WA_SETTINGS,
      },
      {
        title: 'Message content — defaults, preview and custom messages',
        persona: 'lab',
        icon: <FileText className="w-4 h-4" />,
        description: 'WhatsApp bodies carry no subject and are read on a phone, so they are short and the case link does the work. Placeholders ({{Dentist Name}}, {{Case ID}}, {{Missing Items Summary}}, {{Case Link}}…) resolve at send time and are highlighted in the preview. Labs can write their own.',
        shows: ['Default Message 1 · Professional', 'Default Message 2 · Friendly', 'Custom'],
        tryIt: ['Press the eye icon to preview a message', 'Add a custom message, then select it for Needs Review', 'Delete it — the outcome falls back to its default'],
        path: WA_SETTINGS,
      },
    ],
  },
  {
    label: 'Automated messages',
    blurb: 'With sending on Automatic, the automation fires once, silently, at the moment a case is scored. A seeded case replays the whole sequence step by step so it can actually be watched — and it reads the lab’s real settings, so the failure branch is one toggle away.',
    steps: [
      {
        title: 'The demo case — scored, matched, sent, delivered, read, replied',
        persona: 'system',
        icon: <Play className="w-4 h-4" />,
        description: 'CASE-WA-3001 (Nadia Farrell · Crown) arrived from an iTero scanner with no scans attached, so it scores Needs Review and the automation has something real to chase. Its Conversation hub carries the end-to-end replay, writing the same records the live automation writes.',
        shows: ['Scored → Needs Review', 'Channel checked → message sent from +44 7700 900482', 'Delivered → Read → Dentist replied → Case updated'],
        tryIt: ['Open the WhatsApp tab and press "Run simulation"', 'Watch the outbound message and the dentist’s reply land in the thread'],
        path: DEMO_CASE,
        highlight: true,
      },
      {
        title: 'The branches that stop it',
        persona: 'system',
        icon: <ShieldAlert className="w-4 h-4" />,
        description: 'The replay reads the live settings, so each gate has its own ending. On Manual it stops at "Manual sending is on". With the channel off nothing is sent or recorded. With the account disconnected the attempt is still recorded against the case with the reason — a send that never happened is exactly what has to be auditable.',
        shows: ['Manual sending is on', BLOCK_REASON_TEXT.disabled, BLOCK_REASON_TEXT.disconnected, 'Recorded on the case as failed, with the reason'],
        tryIt: ['Press "Disconnect" in the demo controls above', 'Run the simulation again and read the step that stops it'],
        path: DEMO_CASE,
      },
    ],
  },
  {
    label: 'Manual messages — the Conversation hub',
    blurb: 'The case-level hub holds both channels in one thread: Latest, Email, WhatsApp and an AI tab. WhatsApp is only offered when the setting is on AND an account is connected.',
    steps: [
      {
        title: 'One thread, two channels',
        persona: 'lab',
        icon: <Smartphone className="w-4 h-4" />,
        description: 'CASE-051 (Olivia Bennett) is missing shade, instructions, two scans and a delivery date. Its hub shows the email and WhatsApp history together under "Latest", each bubble tagged by channel — WhatsApp green, email blue — and filterable by tab.',
        shows: ['Latest · Email · WhatsApp · AI', 'Composer channel toggle'],
        tryIt: ['Switch between the Latest, Email and WhatsApp tabs'],
        path: '/lab/cases/CASE-051?conversation=1&channel=whatsapp',
      },
      {
        title: 'Send a WhatsApp from a template',
        persona: 'lab',
        icon: <PenLine className="w-4 h-4" />,
        description: 'The manual route mirrors the email draft: one click opens the message seeded with the template configured for this case’s outcome, with the placeholders already resolved. The body and the recipient number are editable before sending, and the footer names the number it sends from.',
        shows: ['Template switcher', 'Recipient number on file — editable', 'Sending from +44 7700 900482'],
        tryIt: ['Pick WhatsApp in the composer → "Use template"', 'Switch the template, edit the body, send — the bubble appears in the thread'],
        path: '/lab/cases/CASE-051?conversation=1&channel=whatsapp',
      },
      {
        title: 'Chase from the case header — Email or WhatsApp',
        persona: 'lab',
        icon: <Send className="w-4 h-4" />,
        description: 'With both channels configured, the score card offers both: "Email dentist" and "WhatsApp dentist". Either one chases the same outcome, sends to the same dentist and moves the case to Sent for Review — only the channel differs. With WhatsApp unconfigured, only the email button shows, exactly as before.',
        shows: ['Email dentist', 'WhatsApp dentist', 'Case → Sent for Review'],
        tryIt: ['Press "WhatsApp dentist" on the score card', 'Read the message that lands in the hub — the missing items are filled in from the case'],
        path: '/lab/cases/CASE-WA-3001',
      },
      {
        title: 'No phone number on file',
        persona: 'lab',
        icon: <UserCog className="w-4 h-4" />,
        description: 'Dr. Harper (CASE-051) has no number the lab can message. Pressing "WhatsApp dentist" says so and opens Private Information — the lab’s own email, number and notes for that dentist, which the dentist never sees and which do not change their clinic contact record. Saving a number sends the message straight away.',
        shows: ['“No phone number on file for Dr. Harper”', 'Private Email · Private Phone No. · Private Notes', 'Save → the message goes out'],
        tryIt: ['Press "WhatsApp dentist"', 'Type an invalid number to see it rejected, then +44 7700 900931 → Save'],
        path: '/lab/cases/CASE-051',
        highlight: true,
      },
      {
        title: 'Mark as Urgent',
        persona: 'lab',
        icon: <AlertTriangle className="w-4 h-4" />,
        description: 'Arming "Urgent" before a send asks for confirmation and states the reminder schedule; the sent bubble then carries the red Urgent pill so the thread shows which messages are chasing a reply.',
        shows: ['“The recipient will receive reminder notifications if they do not respond.”', 'Reminders after 2 / 4 / 6 / 8 hours', 'Urgent pill on the bubble'],
        tryIt: ['Press "Urgent" next to the channel toggle, then send a message'],
        path: '/lab/cases/CASE-051?conversation=1&channel=whatsapp',
      },
      {
        title: 'Channel unavailable — greyed out, with the reason',
        persona: 'lab',
        icon: <Unlink className="w-4 h-4" />,
        description: 'With the setting off or no account linked, the WhatsApp option in the composer is disabled rather than hidden, and the reason is stated under the toggle. An open drawer falls back to email the moment the channel goes away.',
        shows: [BLOCK_REASON_TEXT.disabled, 'WhatsApp messages can’t be sent from this case.'],
        tryIt: ['Turn WhatsApp off in the demo controls above, then open the composer'],
        path: '/lab/cases/CASE-051?conversation=1&channel=whatsapp',
      },
    ],
  },
  {
    label: 'Record & audit',
    blurb: 'Every message — automated or manual, sent or failed — is written against the case rather than living in the drawer, so it survives a refresh.',
    steps: [
      {
        title: 'Recorded against the case',
        persona: 'system',
        icon: <ScrollText className="w-4 h-4" />,
        description: 'Each record keeps the channel, the trigger (automated or manual), the recipient and number, the sending account, the body and the outcome — sent, queued or failed with its reason. Reload the page and the thread is still there.',
        shows: ['Sent / Failed / Queued', 'Automated vs manual', 'Sender · recipient · timestamp'],
        tryIt: ['Send a message, refresh the browser, reopen the hub'],
        path: DEMO_CASE,
      },
      {
        title: 'AI summary across both channels',
        persona: 'dentist',
        icon: <Sparkles className="w-4 h-4" />,
        description: 'CASE-053’s dentist has already replied. The AI tab recaps the whole email + WhatsApp conversation and drafts a reply that can be dropped straight into the composer.',
        shows: ['Conversation summary', 'Suggested reply → Insert into composer'],
        path: '/lab/cases/CASE-053?conversation=1&channel=ai',
      },
    ],
  },
];

export default function WhatsAppFlowPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const settings = useWhatsAppComms();
  const isAuthed = !!user;
  const connected = settings.connection.status === 'connected';
  const blocked = whatsappBlockReason(settings);

  const open = (step: Step) => {
    if (isAuthed) navigate(step.path);
    else navigate(`/login?portal=lab&next=${encodeURIComponent(step.path)}`);
  };

  const reset = () => {
    removeWhatsAppCommunications();
    toast.success('WhatsApp demo data reset — every case starts from a clean thread');
  };

  let n = 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F7E2F8]/30 to-[#AEE3E6]/30 flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5">
        <SmileGeniusWordmark gradientId="waflow_grad" />
        <button
          onClick={() => navigate('/flows')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D8EF7] hover:text-[#3578E5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to flows
        </button>
      </header>

      <main className="flex-1 px-4 sm:px-6 pb-16 pt-2">
        <div className="w-full max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] opacity-15 blur-xl" />
              <div className="relative w-16 h-16 rounded-3xl bg-white border border-[#E0E0E6] shadow-sm flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-[#15803D]" />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D] mb-3">
              Flow walkthrough · Communication
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#030213] mb-2">WhatsApp communication, step by step</h1>
            <p className="text-sm text-[#717182] leading-relaxed max-w-xl mx-auto">
              Each step below opens the exact screen inside the Lab Portal. The steps read in order, but every button works on its own.
            </p>
          </div>

          {/* Demo controls — the two gates every step depends on */}
          <div className="bg-white border border-[#E0E0E6] rounded-2xl p-4 shadow-sm mb-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${blocked === null ? 'bg-[#2E7D32] animate-pulse' : 'bg-[#A0A0B0]'}`} />
              <p className="text-xs text-[#5A5568] min-w-0">
                WhatsApp is <span className="font-semibold text-[#030213]">{settings.enabled ? 'on' : 'off'}</span> for the lab ·{' '}
                <span className="font-semibold text-[#030213]">{connected ? settings.connection.number : 'no account connected'}</span>
                {!isAuthed && <span className="text-[#A0A0B0]"> · you’ll be asked to sign in first (any email / password)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setWhatsAppEnabled(!settings.enabled)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
              >
                <ToggleRight className="w-3.5 h-3.5" />
                {settings.enabled ? 'Turn off' : 'Turn on'}
              </button>
              <button
                onClick={() => (connected ? disconnectWhatsApp() : connectWhatsApp())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                title="The same account the Settings screen links — here so the failure branch is one click away"
              >
                {connected ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {connected ? 'Disconnect' : 'Connect'}
              </button>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors"
                title="Clears every WhatsApp record written against a case — sent, queued and failed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset demo data
              </button>
              {!isAuthed && (
                <button
                  onClick={() => navigate('/login?portal=lab&next=%2Fflows%2Fwhatsapp')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign in
                </button>
              )}
            </div>
          </div>

          {/* Stages */}
          <div className="space-y-8">
            {STAGES.map((stage, si) => (
              <section key={stage.label}>
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#A59DFF]">Stage {String.fromCharCode(65 + si)}</span>
                  <h2 className="text-base font-bold text-[#030213]">{stage.label}</h2>
                </div>
                <p className="text-xs text-[#717182] leading-relaxed mb-3 max-w-2xl">{stage.blurb}</p>
                <div className="space-y-3">
                  {stage.steps.map(step => {
                    n += 1;
                    const p = PERSONA[step.persona];
                    return (
                      <div
                        key={step.title}
                        className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md ${
                          step.highlight ? 'border-[#BBF7D0] ring-1 ring-[#BBF7D0]' : 'border-[#E0E0E6]'
                        }`}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="flex flex-col items-center gap-2 flex-shrink-0">
                            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white text-xs font-bold flex items-center justify-center tabular-nums">{n}</span>
                            <span className="w-8 h-8 rounded-lg bg-[#F3F3F5] text-[#5A5568] flex items-center justify-center">{step.icon}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-bold text-[#030213] leading-snug">{step.title}</h3>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${p.cls}`}>
                                {p.icon}{p.label}
                              </span>
                              {step.highlight && (
                                <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]">Key demo</span>
                              )}
                            </div>
                            <p className="text-xs text-[#5A5568] leading-relaxed mt-1.5">{step.description}</p>
                            {step.shows && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {step.shows.map(s => (
                                  <span key={s} className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F8F9FC] text-[#5A5568] border border-[#F0EFF6]">{s}</span>
                                ))}
                              </div>
                            )}
                            {step.tryIt && (
                              <div className="mt-3 rounded-xl bg-[#F8F9FC] border border-[#F0EFF6] px-3 py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0B0] mb-1">Try it</p>
                                <ol className="space-y-0.5">
                                  {step.tryIt.map((t, i) => (
                                    <li key={t} className="text-[11px] text-[#5A5568] flex gap-2">
                                      <span className="text-[#A0A0B0] tabular-nums flex-shrink-0">{i + 1}.</span>
                                      <span>{t}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                            <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                              <code className="text-[10px] text-[#A0A0B0] font-mono truncate">{step.path}</code>
                              <button
                                onClick={() => open(step)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity shadow-sm"
                              >
                                Open screen
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-6 pb-6 flex justify-center">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-[#8B8B9E] hover:text-[#030213] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to demo
        </button>
      </footer>
    </div>
  );
}
