import { useSyncExternalStore } from 'react';
import type { ScoringEmailCategory } from './caseScoringEmails';
import {
  BLOCK_REASON_TEXT,
  getWhatsAppSettings,
  whatsappBlockReason,
} from './whatsappComms';

// ─── Case communication record ───────────────────────────────────────────────
// Every message Smile Genius sends on a case — automated or manual, email or
// WhatsApp — is written here against the case ID. Two reasons it is a record
// rather than just a chat thread:
//   • "the communication is recorded against the case" — the audit trail has to
//     survive the drawer being closed, so it is stored, not component state.
//   • A send that never went out (WhatsApp account disconnected) still has to
//     be recorded, and a failure has no chat bubble to live in.

export type CommChannel = 'email' | 'whatsapp';
export type CommTrigger = 'automated' | 'manual';
export type CommStatus = 'sent' | 'failed';

export interface CaseCommunication {
  id: string;
  caseId: string;
  channel: CommChannel;
  trigger: CommTrigger;
  /** Which automated event fired this — absent on manual sends. */
  event?: ScoringEmailCategory;
  /** Who it went to, and at which address / number. */
  recipientName: string;
  recipientAddress: string;
  /** The sending account — the lab's mailbox or WhatsApp Business number. */
  sender?: string;
  subject?: string;
  body: string;
  /** ISO — the record is sorted and displayed from this. */
  at: string;
  status: CommStatus;
  /** Why a failed send failed. Shown on the case timeline. */
  failureReason?: string;
}

const LS_KEY = 'cases.communications';

function load(): CaseCommunication[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CaseCommunication[]) : [];
  } catch {
    return [];
  }
}

let records: CaseCommunication[] = load();
const listeners = new Set<() => void>();
let seq = 0;

function commit(next: CaseCommunication[]) {
  records = next;
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* storage blocked — keep in-memory */ }
  listeners.forEach(l => l());
}

export function getCommunications(): CaseCommunication[] {
  return records;
}

/** Write one communication against a case. Returns the stored record. */
export function recordCommunication(input: Omit<CaseCommunication, 'id' | 'at'> & { at?: string }): CaseCommunication {
  const rec: CaseCommunication = {
    ...input,
    id: `comm-${Date.now()}-${++seq}`,
    at: input.at ?? new Date().toISOString(),
  };
  commit([...records, rec]);
  return rec;
}

/** Everything sent (or attempted) on a case, newest last. */
export function communicationsFor(caseId: string, all: CaseCommunication[] = records): CaseCommunication[] {
  return all.filter(r => r.caseId === caseId).sort((a, b) => a.at.localeCompare(b.at));
}

// ── The one place a WhatsApp message is sent from ────────────────────────────
export interface WhatsAppSendInput {
  caseId: string;
  trigger: CommTrigger;
  event?: ScoringEmailCategory;
  recipientName: string;
  recipientAddress: string;
  body: string;
}

export interface WhatsAppSendResult {
  status: 'sent' | 'blocked' | 'failed';
  /** Human-readable outcome — surfaced as a toast by the caller. */
  message: string;
  /** The sending number, on success. */
  sender?: string;
  record?: CaseCommunication;
}

/**
 * Send a WhatsApp message on a case, applying the lab's settings. Both the
 * automated and the manual route go through here so the rules cannot drift:
 *
 *   • WhatsApp communication disabled → nothing is sent, and nothing is
 *     recorded. The lab switched the channel off; a failure log would be noise.
 *   • Account disconnected / unavailable → nothing is sent, and the FAILURE is
 *     recorded against the case so it is visible on the timeline.
 *   • Otherwise → sent from the lab's connected WhatsApp Business number and
 *     recorded.
 */
export function sendWhatsAppMessage(input: WhatsAppSendInput): WhatsAppSendResult {
  const settings = getWhatsAppSettings();
  const blocked = whatsappBlockReason(settings);

  if (blocked === 'disabled') {
    return { status: 'blocked', message: BLOCK_REASON_TEXT.disabled };
  }

  if (blocked === 'disconnected') {
    const record = recordCommunication({
      caseId: input.caseId,
      channel: 'whatsapp',
      trigger: input.trigger,
      event: input.event,
      recipientName: input.recipientName,
      recipientAddress: input.recipientAddress,
      body: input.body,
      status: 'failed',
      failureReason: BLOCK_REASON_TEXT.disconnected,
    });
    return { status: 'failed', message: `WhatsApp message not sent — ${BLOCK_REASON_TEXT.disconnected} The failure is recorded on the case.`, record };
  }

  const sender = settings.connection.number;
  const record = recordCommunication({
    caseId: input.caseId,
    channel: 'whatsapp',
    trigger: input.trigger,
    event: input.event,
    recipientName: input.recipientName,
    recipientAddress: input.recipientAddress,
    sender,
    body: input.body,
    status: 'sent',
  });
  return { status: 'sent', message: `WhatsApp message sent to ${input.recipientName} from ${sender}`, sender, record };
}

/** Email sends are recorded too, so the case timeline shows both channels. */
export function recordEmail(input: {
  caseId: string;
  trigger: CommTrigger;
  event?: ScoringEmailCategory;
  recipientName: string;
  recipientAddress: string;
  sender?: string;
  subject?: string;
  body: string;
}): CaseCommunication {
  return recordCommunication({ ...input, channel: 'email', status: 'sent' });
}

// ── Reactive read ─────────────────────────────────────────────────────────────
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useCaseCommunications(caseId?: string): CaseCommunication[] {
  const all = useSyncExternalStore(subscribe, getCommunications);
  return caseId ? communicationsFor(caseId, all) : all;
}
