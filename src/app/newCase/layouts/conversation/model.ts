// ─── Experience B · Conversation · thread model ──────────────────────────────
// Turns the case into the short conversation shown above the current question:
// question → answer pairs, grouped per service, with the defaults a service
// simply took collapsed into one line. Who the case is for, the lab and Back by
// live in the case strip, so the thread is only about what is being made.
// Display only: every value comes from rules.ts (slotsFor, steps, dates) or the
// shared step helpers, never re-derived.

import type { CaseApi } from '../../CaseContext';
import {
  ServiceItem, Slot, SlotId, StepKind, bridgeParts, effective, itemPhrase, parseStep, recordsState, slotStepId, slotsFor,
} from '../../rules';
import { prefsSentence, questionFor } from '../../ServiceSteps';
import { recordsSummary } from '../../CaseSteps';

/** Slots shown in the defaults panel above the current question (as on the Guided slot screen). */
export const PANEL_SLOTS: SlotId[] = ['material', 'type', 'splint', 'retention', 'acrylic'];
/** Slots whose editor is the big chart (the thread hides the mini chart while one is open). */
export const CHART_SLOTS: SlotId[] = ['teeth', 'arch', 'extract'];

/** Where each kind of step sits in the conversation. */
const RANK: Record<StepKind, number> = { patient: 0, lab: 1, services: 2, slot: 2, records: 3, prescriber: 4, delivery: 5, review: 6 };

export interface Pair {
  stepId: string;
  question: string;
  answer: string;
  src?: string;
  /** Still unanswered (the person jumped past it). */
  gap: boolean;
  /** Answered by the person (soft blue reply), rather than known or defaulted (white reply + source). */
  mine: boolean;
}
/** One folded default: its own step, so each value opens the question that changes it. */
export interface DefaultPart { stepId: string; text: string }
export interface DefaultsLine { lead: string; parts: DefaultPart[] }
export interface ItemGroup { item: ServiceItem; pairs: Pair[]; defaults?: DefaultsLine; current: boolean; currentSlot?: SlotId }
export type Entry = { kind: 'pair'; pair: Pair } | { kind: 'item'; group: ItemGroup };

const MINE = new Set(['You', 'You picked', 'Changed for this case']);
/** A value the service took from someone's usual or a standard ("Your usual", "Lab standard"…). */
export const isUsual = (src?: string) => !!src && /(usual|standard)$/i.test(src);

/** "Used your usuals", "Used Dr Ellery's usuals", "Used the standard choices". */
export function defaultsLead(srcs: string[]): string {
  if (srcs.length && srcs.every(s => /standard$/i.test(s))) return 'Used the standard choices';
  const u = srcs.find(s => /usual$/i.test(s));
  if (!u || u === 'Your usual') return 'Used your usuals';
  return `Used ${u}s`;
}

function slotQuestion(slot: Slot, item: ServiceItem, api: CaseApi): string {
  if (slot.id === 'material' && !item.ambiguous) return 'Which material?';
  if (slot.id === 'prefs') return 'Preferences';
  // The bridge question is an instruction on its own screen ("Tap the teeth at each end…").
  if (slot.id === 'teeth' && item.product === 'bridge') return 'Which teeth?';
  return questionFor(slot, item, api.user.notation, api.lab.name);
}
function slotAnswer(slot: Slot, item: ServiceItem): string {
  if (slot.id === 'teeth' && item.product === 'bridge' && slot.value) {
    const p = [...bridgeParts(item).pontics].sort((a, b) => Number(a) - Number(b));
    return p.length ? `${slot.value} · ${p.length === 1 ? 'pontic' : 'pontics'} ${p.join(', ')}` : slot.value;
  }
  return slot.value || '—';
}
/** What a folded default says in the line: the value, named where the value alone would be unclear. */
function defaultText(slot: Slot, item: ServiceItem, api: CaseApi): string {
  if (slot.id === 'prefs') return `Preferences: ${prefsSentence(effective(item, api.ctx).prefs)}`;
  if (slot.id === 'mould') return `Mould: ${(slot.value ?? '').toLowerCase()}`;
  return slot.value ?? '';
}

/** One service: its answered slots up to `upTo` (the current question), defaults folded into one line. */
function itemGroup(api: CaseApi, item: ServiceItem, upTo?: SlotId): ItemGroup {
  const slots = slotsFor(item, api.ctx);
  const stop = upTo ? Math.max(0, slots.findIndex(s => s.id === upTo)) : slots.length;
  const pairs: Pair[] = [];
  const defaults: Slot[] = [];
  for (const s of slots.slice(0, stop)) {
    const stepId = slotStepId(item.id, s.id);
    const node = api.steps.find(n => n.id === stepId);
    if (!node?.navigable) continue;
    // The current question's card shows these in its defaults panel.
    if (upTo && PANEL_SLOTS.includes(s.id)) continue;
    if (!node.gap && isUsual(s.src)) { defaults.push(s); continue; }
    pairs.push({
      stepId,
      question: slotQuestion(s, item, api),
      answer: node.gap ? 'Needs you' : slotAnswer(s, item),
      src: s.src,
      gap: node.gap,
      mine: !s.src || MINE.has(s.src),
    });
  }
  const parts = defaults
    .map(d => ({ stepId: slotStepId(item.id, d.id), text: defaultText(d, item, api) }))
    .filter(p => p.text);
  return {
    item, pairs, current: !!upTo, currentSlot: upTo,
    defaults: parts.length ? { lead: defaultsLead(defaults.map(d => d.src ?? '')), parts } : undefined,
  };
}

const gapOf = (api: CaseApi, id: string) => !!api.steps.find(n => n.id === id)?.gap;

function servicesPair(api: CaseApi): Pair {
  return { stepId: 'services', question: `What are we making for ${api.patient.first}?`, answer: 'Needs you', gap: true, mine: false };
}
function recordsPair(api: CaseApi): Pair {
  const s = recordsState(api.draft, api.ctx);
  const gap = gapOf(api, 'records');
  const known = s === 'scan' || s === 'nextStage';
  return {
    stepId: 'records',
    question: s === 'scan' ? 'Which scans go with it?' : 'How will the lab get the impressions?',
    answer: gap ? 'Needs you' : recordsSummary(api),
    src: s === 'scan' ? 'From scan' : s === 'nextStage' ? 'Next stage' : undefined,
    gap, mine: !gap && !known && !!api.draft.records.route,
  };
}
function prescriberPair(api: CaseApi): Pair {
  const gap = gapOf(api, 'prescriber');
  const p = api.prescriber;
  return {
    stepId: 'prescriber', question: 'Who is prescribing?',
    answer: gap ? (p && !p.gdc ? 'Needs a GDC number' : 'Needs you') : `${p!.name}${p!.id === api.user.id ? ' (you)' : ''}`,
    src: api.prescriberSrc, gap, mine: !!api.draft.prescriber,
  };
}

/**
 * The services so far, then the case-level answers given before the current
 * question. Patient and lab are in the strip, not here, so going back to
 * either keeps every service in view (nothing looks undone).
 */
export function buildThread(api: CaseApi): Entry[] {
  const cur = parseStep(api.step);
  const rank = RANK[cur.kind] ?? 0;
  const out: Entry[] = [];
  const pair = (p: Pair) => out.push({ kind: 'pair', pair: p });
  const at = cur.kind === 'slot' ? api.draft.items.findIndex(i => i.id === cur.itemId) : api.draft.items.length;
  api.draft.items.forEach((item, k) => {
    if (k > at) return;
    out.push({ kind: 'item', group: itemGroup(api, item, cur.kind === 'slot' && k === at ? cur.slot : undefined) });
  });
  if (rank > 2 && api.draft.items.length === 0) pair(servicesPair(api));
  if (rank > 3) pair(recordsPair(api));
  if (rank > 4) pair(prescriberPair(api));
  return out;
}

/** How many answers the thread holds (for the folded thread on Review). */
export function answerCount(entries: Entry[]): number {
  return entries.reduce((n, e) => n + (e.kind === 'pair' ? 1 : 1 + e.group.pairs.length + (e.group.defaults?.parts.length ?? 0)), 0);
}

/**
 * The faint line under the card: the questions Next and auto-advance will
 * actually ask (the open ones after this, then any left before it), and how
 * many are left.
 */
export function upcoming(api: CaseApi): { then: string; count?: { text: string; done: boolean } } {
  const { steps, step, draft, user } = api;
  const cur = parseStep(step);
  const i = steps.findIndex(s => s.id === step);
  const ahead = [...steps.slice(i + 1), ...steps.slice(0, Math.max(0, i))].filter(s => s.gap);
  const labels: string[] = [];
  const add = (w: string) => { if (w && !labels.includes(w)) labels.push(w); };
  // A new service brings its own questions.
  if (cur.kind === 'services') add('a few details');
  for (const s of ahead) {
    if (s.kind === 'slot' && s.slot && s.itemId) {
      if (s.itemId === cur.itemId) add(s.slot.label.toLowerCase().replace(/\?$/, ''));
      else {
        const it = draft.items.find(x => x.id === s.itemId);
        if (it) add(itemPhrase(it, user.notation));
      }
    } else if (s.kind === 'records') add('scans');
    else if (s.kind === 'prescriber') add('prescriber');
    else if (s.kind === 'services') add('what we’re making');
  }
  const then = labels.length ? `Then: ${labels.join(', ')}, then review and send` : 'Then: review and send';
  // New services bring their own questions, so a count here would undersell it.
  if (cur.kind === 'services') return { then };
  const remaining = steps.filter(s => s.gap && s.id !== step).length;
  const curGap = !!steps[i]?.gap;
  if (remaining > 0) return { then, count: { text: `${remaining} more ${remaining === 1 ? 'question' : 'questions'}`, done: false } };
  return { then, count: { text: curGap ? '✓ Last question' : '✓ Nothing else needed', done: true } };
}
