import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Play, RotateCcw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { CATEGORY_META, ScoringEmailCategory } from '../data/caseScoringEmails';
import {
  BLOCK_REASON_TEXT,
  fillTemplateVars,
  findWhatsAppTemplate,
  getWhatsAppSettings,
  useWhatsAppComms,
  whatsappBlockReason,
  whatsappNumberFor,
} from '../data/whatsappComms';
import { sendWhatsAppMessage } from '../data/caseCommunications';

// ─── Automated WhatsApp — end-to-end simulation ──────────────────────────────
// The automation normally fires once, silently, at the moment a case is scored,
// which makes it hard to demo: by the time anyone opens the case the whole
// sequence has already happened. This replays it step by step on the seeded
// demo case — scored → matched → channel checked → sent → delivered → read →
// replied → case updated — writing the same real records the live automation
// writes, so nothing here is a mock of the mock.
//
// It reads the lab's ACTUAL settings, so turning WhatsApp off (or disconnecting
// the account) in Settings makes the simulation take the failure branch instead
// — which is the more interesting half to demo.

export interface SimStep {
  id: string;
  label: string;
  detail: string;
  tone?: 'ok' | 'fail';
}

/**
 * A beat of the sequence. `act` runs its side effect as the step appears, and
 * may correct its own wording from what actually happened — the send step
 * reports the real result rather than the branch we predicted. Returning
 * `stop` ends the run there.
 */
type ScriptStep = SimStep & { act?: () => (Partial<SimStep> & { stop?: boolean }) | void };

interface Props {
  caseId: string;
  patientName: string;
  dentist: string;
  serviceName: string;
  /** Outstanding requirement labels — what the message chases. */
  missing: string[];
  /** Which scoring outcome the case landed in. */
  category: ScoringEmailCategory;
  /** Clear the WhatsApp side of the thread before a run. */
  onReset: () => void;
  onOutbound: (body: string) => void;
  onInbound: (body: string) => void;
}

const STEP_MS = 950;

export default function WhatsAppAutomationSimulator({
  caseId, patientName, dentist, serviceName, missing, category, onReset, onOutbound, onInbound,
}: Props) {
  const { toast } = useToast();
  const whatsapp = useWhatsAppComms();
  const blocked = whatsappBlockReason(whatsapp);
  const [steps, setSteps] = useState<SimStep[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  // Every pending timer, so a replay (or unmount) can't leave a half-run
  // sequence firing into a thread that has already been cleared.
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); }, []);

  const number = whatsappNumberFor(dentist);

  const run = () => {
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
    onReset();
    setSteps([]);
    setDone(false);
    setRunning(true);

    // Read the settings LIVE at run time, not from the render snapshot: the
    // send path reads the store directly, so branching off a stale snapshot
    // would let the log narrate a send that actually failed.
    const live = getWhatsAppSettings();
    const blockedNow = whatsappBlockReason(live);
    const automationOn = live.automation[category].enabled;
    const tpl = findWhatsAppTemplate(category, live.automation[category].templateId, live.customTemplates);
    const body = fillTemplateVars(tpl.body, {
      'Dentist Name': dentist,
      'Patient Name': patientName,
      'Case ID': caseId,
      'Service Name': serviceName,
      'Missing Items Summary': missing.length ? missing.map(m => `• ${m}`).join('\n') : '• (nothing outstanding)',
      'Case Link': `https://app.smilegenius.co.uk/cases/${caseId}`,
      'Lab Name': 'Smile Genius Lab',
    });

    const script: ScriptStep[] = [
      {
        id: 'created', label: 'Case received',
        detail: `${caseId} arrived from the clinic for ${patientName} — ${serviceName}.`,
      },
      {
        id: 'scored', label: 'Case scored',
        detail: missing.length
          ? `Scored ${CATEGORY_META[category].label} — ${missing.length} item${missing.length === 1 ? '' : 's'} outstanding: ${missing.join(', ')}.`
          : `Scored ${CATEGORY_META[category].label}.`,
      },
      {
        id: 'matched', label: 'Automation matched',
        detail: automationOn
          ? `${CATEGORY_META[category].label} is configured to send "${tpl.name}" over WhatsApp.`
          : `${CATEGORY_META[category].label} WhatsApp automation is switched off — turn it on in Settings to send.`,
        tone: automationOn ? 'ok' : 'fail',
      },
    ];

    if (!automationOn) {
      // Nothing further happens — the outcome is simply not configured.
      playScript(script);
      return;
    }

    script.push({
      id: 'channel', label: 'Channel checked',
      detail: blockedNow
        ? BLOCK_REASON_TEXT[blockedNow]
        : `WhatsApp communication is on and ${live.connection.businessName} (${live.connection.number}) is connected.`,
      tone: blockedNow ? 'fail' : 'ok',
    });

    if (blockedNow === 'disabled') {
      script.push({
        id: 'skipped', label: 'Nothing sent',
        detail: 'The lab switched the channel off, so no WhatsApp message is sent and nothing is recorded.',
        tone: 'fail',
      });
      playScript(script);
      return;
    }

    if (blockedNow === 'disconnected') {
      script.push({
        id: 'failed', label: 'Send failed — recorded',
        detail: `The message could not go out with no account linked. The failure is recorded against ${caseId} and shows on its timeline.`,
        tone: 'fail',
        act: () => {
          sendWhatsAppMessage({
            caseId, trigger: 'automated', event: category,
            recipientName: dentist, recipientAddress: number, body,
          });
        },
      });
      playScript(script);
      return;
    }

    // The happy path.
    script.push(
      {
        id: 'sent', label: 'Message sent',
        detail: `Sent to ${dentist} on ${number}, from ${live.connection.number}. Recorded against the case.`,
        tone: 'ok',
        // The step reports what the send path ACTUALLY did. If the settings
        // changed between pressing Run and this beat, the log says so and the
        // run stops rather than narrating a delivery that never happened.
        act: () => {
          const result = sendWhatsAppMessage({
            caseId, trigger: 'automated', event: category,
            recipientName: dentist, recipientAddress: number, body,
          });
          if (result.status !== 'sent') {
            return {
              label: result.status === 'failed' ? 'Send failed — recorded' : 'Nothing sent',
              detail: result.message,
              tone: 'fail',
              stop: true,
            };
          }
          onOutbound(body);
          return undefined;
        },
      },
      { id: 'delivered', label: 'Delivered', detail: `Handset confirmed delivery to ${dentist}.`, tone: 'ok' },
      { id: 'read', label: 'Read', detail: `${dentist} opened the message.`, tone: 'ok' },
      {
        id: 'replied', label: 'Dentist replied',
        detail: 'The reply lands in the same case conversation — no separate inbox to watch.',
        tone: 'ok',
        act: () => onInbound(missing.length
          ? `Thanks — uploading the ${missing.slice(0, 2).join(' and ')}${missing.length > 2 ? ' and the rest' : ''} now. Should be with you in ten minutes.`
          : `Thanks — all good on my side, go ahead.`),
      },
      {
        id: 'resolved', label: 'Case updated',
        detail: 'The outstanding items arrive against the case and it re-scores — the chase is closed without anyone typing a message.',
        tone: 'ok',
      },
    );
    playScript(script);
  };

  // Sequential rather than a batch of pre-scheduled timers: a step can end the
  // run (a send that failed has nothing to deliver, read or reply to), which a
  // fire-and-forget chain can't express.
  const playScript = (script: ScriptStep[]) => {
    let anyFailed = false;
    const step = (i: number) => {
      const s = script[i];
      const t = window.setTimeout(() => {
        const patch = s.act?.() ?? undefined;
        const shown: SimStep = { id: s.id, label: s.label, detail: s.detail, tone: s.tone, ...(patch ?? {}) };
        setSteps(prev => [...prev, shown]);
        if (shown.tone === 'fail') anyFailed = true;

        const last = i === script.length - 1 || patch?.stop;
        if (!last) { step(i + 1); return; }
        setRunning(false);
        setDone(true);
        if (anyFailed) toast.info('Simulation finished — see why nothing was sent.');
        else toast.success('Simulation finished — the message, the reply and the record are all on the case.');
      }, STEP_MS);
      timers.current.push(t);
    };
    step(0);
  };

  // Only the latest beat is shown — the sequence plays out in the thread, not
  // in a log.
  const current = steps[steps.length - 1];
  const failed = current?.tone === 'fail';

  return (
    <div className="border border-[#BBF7D0] bg-[#F7FEF9] rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2.5">
      <span className="w-7 h-7 rounded-lg bg-white border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-[#15803D]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[#15803D]">Automated WhatsApp</p>
        {/* One line, not a checklist: the run itself is the thing worth
            watching — the message and the reply land in the thread below.
            While running this narrates the current beat and is replaced by the
            next, so the panel never grows. */}
        <p className={`text-[10px] leading-relaxed ${failed ? 'text-[#B91C1C]' : 'text-[#3F6B4F]'}`}>
          {current
            ? current.detail
            : 'Replays what happens the moment this case is scored, using your live WhatsApp settings.'}
        </p>
      </div>
      <button
        onClick={run}
        disabled={running}
        title="Play the automated WhatsApp sequence for this case"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
      >
        {done && !running ? <RotateCcw className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        {running ? 'Simulating…' : done ? 'Replay' : 'Simulate'}
      </button>
    </div>
  );
}
