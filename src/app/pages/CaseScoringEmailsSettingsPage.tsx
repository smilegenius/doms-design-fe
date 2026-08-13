import { useState } from 'react';
import {
  Mail, CheckCircle2, Plus, X, Eye, Pencil, Trash2, Copy, RefreshCw,
  AlertTriangle, Loader2, FileText, Sparkles, Ban, ChevronDown,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import Toggle from '../components/Toggle';
import { useToast } from '../context/ToastContext';
import {
  useCaseScoringEmails, connectEmail, disconnectEmail, reconnectEmail,
  setAutomationEnabled, selectTemplate, addCustomTemplate, updateCustomTemplate, removeCustomTemplate,
  DEFAULT_TEMPLATES, PROVIDER_META, CATEGORY_META, SCORING_EMAIL_PLACEHOLDERS, MOCK_LAB_EMAIL,
} from '../data/caseScoringEmails';
import type { EmailProvider, ScoringEmailCategory, ScoringEmailTemplate } from '../data/caseScoringEmails';

// ─── Settings → Case Scoring Emails (lab portal) ─────────────────────────────
// Everything the Automated Case Scoring Emails feature configures, in one
// settings section:
//   1. Email Integration — connect / disconnect / reconnect the lab's own
//      business email (Google Workspace or Microsoft 365). Status is always
//      visible. Once connected, automated emails send from THIS account, not
//      from Smile Genius.
//   2. Email Automation — per scoring outcome (Needs Review / Incomplete),
//      an on/off toggle + exactly one selected template. Complete has no
//      configuration: it never sends an email.
//   3. Custom Templates — the lab's own templates, usable in either category.
// State lives in data/caseScoringEmails.ts (localStorage) so the case pages
// and the create-case flow read the same connection + automation config.

const CATEGORIES: ScoringEmailCategory[] = ['needs-review', 'incomplete'];

// No overflow-hidden on the card: the template-picker dropdown inside Email
// Automation is absolutely positioned and must be able to overlay the card
// edge. The header rounds its own top corners instead.
function Card({ title, actions, children }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-[#E0E0E6]">
      <div className="flex items-center justify-between gap-3 px-6 py-4 bg-[#F8F9FC] border-b border-[#F0EFF6] rounded-t-xl">
        <h3 className="text-sm font-semibold text-[#030213]">{title}</h3>
        {actions}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// Template subject/body with the {{placeholders}} rendered as chips so the
// merge fields read at a glance in previews.
function MergeText({ text, block = false }: { text: string; block?: boolean }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  const Wrapper = block ? 'div' : 'span';
  return (
    <Wrapper className={block ? 'text-xs text-[#30313D] leading-relaxed whitespace-pre-wrap' : undefined}>
      {parts.map((p, i) =>
        /^\{\{[^}]+\}\}$/.test(p) ? (
          <span key={i} className="px-1 py-px rounded bg-[#EEF4FF] border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0]">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </Wrapper>
  );
}

function ToneChip({ tone }: { tone: string }) {
  const cls =
    tone === 'Professional' ? 'bg-[#EEF4FF] text-[#1565C0] border-[#BFDBFE]'
    : tone === 'Friendly'   ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]'
    : tone === 'Urgent'     ? 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]'
    : 'bg-[#F3EEFF] text-[#5B21B6] border-[#DDD6FE]';
  return (
    <span className={`inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider border ${cls}`}>
      {tone}
    </span>
  );
}

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

type EditorState = {
  mode: 'create' | 'edit';
  id?: string;
  name: string;
  subject: string;
  body: string;
  /** When the editor was opened from a category's "Custom Template" row, the
      saved template is auto-selected for that category. */
  selectFor?: ScoringEmailCategory;
};

export default function CaseScoringEmailsSettings() {
  const { toast } = useToast();
  const { connection, automation, customTemplates } = useCaseScoringEmails();
  const connected = connection.status === 'connected';

  // Connect flow: pick a provider → mock OAuth consent → connecting → done.
  const [consentProvider, setConsentProvider] = useState<EmailProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  // "Connect a different account" re-opens the provider picker after a disconnect.
  const [pickerOverride, setPickerOverride] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const [preview, setPreview] = useState<ScoringEmailTemplate | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScoringEmailTemplate | null>(null);
  // Which category's template-picker dropdown is open (null = none).
  const [templateMenuFor, setTemplateMenuFor] = useState<ScoringEmailCategory | null>(null);

  const startOAuth = (provider: EmailProvider) => setConsentProvider(provider);
  const finishOAuth = () => {
    if (!consentProvider) return;
    setConnecting(true);
    window.setTimeout(() => {
      connectEmail(consentProvider, MOCK_LAB_EMAIL);
      setConnecting(false);
      setConsentProvider(null);
      setPickerOverride(false);
      toast.success(`${PROVIDER_META[consentProvider].label} connected — case scoring emails now send from ${MOCK_LAB_EMAIL}`);
    }, 900);
  };
  const handleDisconnect = () => {
    disconnectEmail();
    setDisconnectOpen(false);
    toast.success('Email account disconnected — automated case scoring emails are paused');
  };
  const handleReconnect = () => {
    reconnectEmail();
    toast.success(`Reconnected to ${connection.lastEmail ?? MOCK_LAB_EMAIL} — automation resumed`);
  };

  const openCreate = (selectFor?: ScoringEmailCategory) =>
    setEditor({ mode: 'create', name: '', subject: '', body: '', selectFor });
  const openEdit = (t: ScoringEmailTemplate) =>
    setEditor({ mode: 'edit', id: t.id, name: t.name, subject: t.subject, body: t.body });

  const saveEditor = () => {
    if (!editor) return;
    if (!editor.name.trim() || !editor.subject.trim() || !editor.body.trim()) {
      toast.error('Give the template a name, a subject and a body before saving.');
      return;
    }
    if (editor.mode === 'edit' && editor.id) {
      updateCustomTemplate(editor.id, { name: editor.name, subject: editor.subject, body: editor.body });
      toast.success(`"${editor.name.trim()}" updated`);
    } else {
      const tpl = addCustomTemplate({ name: editor.name, subject: editor.subject, body: editor.body });
      if (editor.selectFor) {
        selectTemplate(editor.selectFor, tpl.id);
        toast.success(`"${tpl.name}" created and selected for ${CATEGORY_META[editor.selectFor].label}`);
      } else {
        toast.success(`"${tpl.name}" created — select it under Needs Review or Incomplete`);
      }
    }
    setEditor(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    removeCustomTemplate(confirmDelete.id);
    toast.success(`"${confirmDelete.name}" deleted`);
    setConfirmDelete(null);
  };

  // Which categories a custom template is currently selected for (badges).
  const usedBy = (id: string): ScoringEmailCategory[] =>
    CATEGORIES.filter(c => automation[c].templateId === id);

  const copyPlaceholder = (p: string) => {
    navigator.clipboard?.writeText(`{{${p}}}`);
    toast.success(`Copied {{${p}}}`);
  };

  const showProviderPicker = !connected && (pickerOverride || !connection.lastProvider);

  return (
    <div className="space-y-4">

      {/* ── Intro — what this section automates ── */}
      <div className="bg-gradient-to-br from-[#EEF4FF] to-[#F5F3FF] border border-[#DBEAFE] rounded-xl p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-white border border-[#DBEAFE] flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-[#4D8EF7]" />
        </span>
        <div className="text-xs text-[#3A4A63] leading-relaxed">
          <span className="font-semibold text-[#1565C0]">Automated Case Scoring Emails.</span>{' '}
          When case scoring classifies a case as <span className="font-semibold">Needs Review</span> or{' '}
          <span className="font-semibold">Incomplete</span>, the selected email template is sent to the dentist
          automatically — from your own business email account, not from Smile Genius — so communication happens
          without manual follow-up. Cases scored <span className="font-semibold">Complete</span> never trigger an email.
          Emails are sent only to dentists with an email address on file — cases whose dentist has no email are
          skipped.
        </div>
      </div>

      {/* ── 1 · Email Integration — connection status is ALWAYS visible ── */}
      <Card
        title="Email Integration"
        actions={
          connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-[#FFF8E1] text-[#B45309] border-[#FDE68A]">
              <AlertTriangle className="w-3.5 h-3.5" /> Not Connected
            </span>
          )
        }
      >
        {connected && connection.provider ? (
          /* Connected — provider, address, since-when + Disconnect */
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-lg bg-[#EEF4FF] border border-[#C8D8FC] flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#1565C0]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#030213] flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[#1565C0]">{connection.email}</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-semibold text-[#2E7D32]">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: PROVIDER_META[connection.provider].color }} />
                    {PROVIDER_META[connection.provider].label} · {PROVIDER_META[connection.provider].product}
                  </span>
                </p>
                <p className="text-[11px] text-[#717182] mt-0.5">
                  Connected {fmtDate(connection.connectedAt)} · All automated case scoring emails are sent from this
                  account rather than from Smile Genius.
                </p>
              </div>
            </div>
            <button
              onClick={() => setDisconnectOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#B91C1C] border border-[#FECACA] bg-white hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        ) : showProviderPicker ? (
          /* Never connected (or choosing a different account) — provider cards */
          <div>
            <p className="text-sm text-[#030213] font-medium mb-1">Connect your business email account</p>
            <p className="text-xs text-[#717182] leading-relaxed mb-4">
              Automated case scoring emails are sent from the account you connect here — dentists see your lab's
              address, and their replies land in your own inbox. Until an account is connected, no automated emails
              can be sent.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              {(Object.keys(PROVIDER_META) as EmailProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => startOAuth(p)}
                  className="flex items-center gap-3 p-4 bg-white border border-[#E0E0E6] rounded-xl hover:border-[#4D8EF7] hover:shadow-sm transition-all text-left"
                >
                  <Mail className="w-5 h-5 flex-shrink-0" style={{ color: PROVIDER_META[p].color }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#030213]">{PROVIDER_META[p].label}</span>
                    <span className="block text-[11px] text-[#A0A0B0]">{PROVIDER_META[p].product} · {PROVIDER_META[p].oauth}</span>
                  </span>
                </button>
              ))}
            </div>
            {connection.lastProvider && (
              <button onClick={() => setPickerOverride(false)} className="mt-3 text-[11px] font-medium text-[#717182] hover:text-[#030213]">
                ← Back
              </button>
            )}
          </div>
        ) : (
          /* Previously connected → one-click Reconnect */
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <span className="w-10 h-10 rounded-lg bg-[#FFF8E1] border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-[#B45309]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#030213]">
                  <span className="font-mono text-[#5A5568]">{connection.lastEmail}</span>{' '}
                  <span className="text-[#B45309]">is disconnected</span>
                </p>
                <p className="text-[11px] text-[#717182] mt-0.5">
                  Automated case scoring emails are paused. Reconnect to resume, or connect a different account —
                  your automation settings and templates are kept either way.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setPickerOverride(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#5A5568] border border-[#E0E0E6] bg-white hover:bg-[#F8F9FC] transition-colors"
              >
                Connect a different account
              </button>
              <button
                onClick={handleReconnect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ── 2 · Email Automation — one toggle + one template per outcome ── */}
      <Card title="Email Automation">
        {!connected && (
          <div className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-[#FEF3C7] text-[#B45309] flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
            <p className="text-[11px] text-[#A16207] leading-relaxed">
              <span className="font-bold text-[#92400E]">No email account connected.</span>{' '}
              Automated case scoring emails cannot be sent. Your configuration below is saved and takes effect the
              moment an account is connected above.
            </p>
          </div>
        )}

        <p className="text-xs text-[#717182] leading-relaxed mb-4">
          Choose which case scoring outcomes automatically trigger an email to the dentist, and which template each
          outcome sends. Exactly one template can be selected per outcome.
        </p>

        <div className="space-y-4">
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat];
            const conf = automation[cat];
            const options = [...DEFAULT_TEMPLATES[cat], ...customTemplates];
            return (
              <div key={cat} className="border border-[#E0E0E6] rounded-xl">
                {/* Outcome header: name + description + Enabled/Disabled toggle.
                    (No overflow-hidden on the block — the picker dropdown must
                    overlay it — so the header rounds its own top corners.) */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#FAFBFC] border-b border-[#F0EFF6] rounded-t-xl">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: meta.dot }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#030213]">{meta.label}</p>
                      <p className="text-[11px] text-[#717182] leading-relaxed mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-semibold ${conf.enabled ? 'text-[#15803D]' : 'text-[#A0A0B0]'}`}>
                      {conf.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Toggle
                      on={conf.enabled}
                      onChange={() => {
                        setAutomationEnabled(cat, !conf.enabled);
                        toast.success(`${meta.label} emails ${conf.enabled ? 'disabled' : 'enabled'}`);
                      }}
                    />
                  </div>
                </div>

                {/* Template selection — compact picker. The selected template
                    (with tone + subject) shows inline; the full list of
                    Default Template 1–3 + custom templates lives in the
                    dropdown, so each outcome stays two rows tall instead of a
                    scrolling radio stack. Exactly one template per outcome. */}
                <div className={`px-4 py-3 transition-opacity ${conf.enabled ? '' : 'opacity-55'}`}>
                  {(() => {
                    const selectedTpl = options.find(t => t.id === conf.templateId) ?? options[0];
                    const menuOpen = templateMenuFor === cat;
                    const optionRow = (t: ScoringEmailTemplate) => {
                      const selected = conf.templateId === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${selected ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}
                        >
                          <button
                            onClick={() => {
                              if (!selected) { selectTemplate(cat, t.id); toast.success(`"${t.name}" selected for ${meta.label}`); }
                              setTemplateMenuFor(null);
                            }}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            role="option"
                            aria-selected={selected}
                            title={selected ? 'Selected template' : `Use "${t.name}" for ${meta.label}`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#4D8EF7]' : 'border-[#D4CEE1]'}`}>
                              {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#4D8EF7]" />}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs font-semibold ${selected ? 'text-[#1565C0]' : 'text-[#030213]'}`}>{t.name}</span>
                                <ToneChip tone={t.tone} />
                              </span>
                              <span className="block text-[10px] text-[#A0A0B0] truncate mt-px">{t.subject}</span>
                            </span>
                          </button>
                          <button
                            onClick={() => { setTemplateMenuFor(null); setPreview(t); }}
                            className="p-1 rounded-md text-[#717182] hover:text-[#4D8EF7] hover:bg-white transition-colors flex-shrink-0"
                            title={`Preview "${t.name}"`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    };
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] flex-shrink-0">Email template</p>
                        <div className="relative flex-1 min-w-[240px] max-w-md">
                          <button
                            onClick={() => setTemplateMenuFor(menuOpen ? null : cat)}
                            aria-haspopup="listbox"
                            aria-expanded={menuOpen}
                            title={`Change the ${meta.label} template`}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-white transition-colors text-left ${menuOpen ? 'border-[#4D8EF7] ring-2 ring-[#4D8EF7]/15' : 'border-[#E0E0E6] hover:border-[#C8D8FC]'}`}
                          >
                            <span className="text-xs font-semibold text-[#030213] truncate">{selectedTpl.name}</span>
                            <ToneChip tone={selectedTpl.tone} />
                            <span className="hidden sm:block text-[11px] text-[#A0A0B0] truncate flex-1 min-w-0">
                              {selectedTpl.subject}
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-[#717182] ml-auto flex-shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                          </button>
                          {menuOpen && (
                            <>
                              <span className="fixed inset-0 z-20" onClick={() => setTemplateMenuFor(null)} />
                              <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border border-[#E0E0E6] bg-white shadow-lg" role="listbox">
                                <div className="max-h-64 overflow-y-auto p-1.5">
                                  <p className="px-2 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#A0A0B0]">Default templates</p>
                                  {DEFAULT_TEMPLATES[cat].map(optionRow)}
                                  {customTemplates.length > 0 && (
                                    <p className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#A0A0B0] border-t border-[#F0EFF6] mt-1.5">Custom templates</p>
                                  )}
                                  {customTemplates.map(optionRow)}
                                </div>
                                <div className="border-t border-[#F0EFF6] p-1.5">
                                  <button
                                    onClick={() => { setTemplateMenuFor(null); openCreate(cat); }}
                                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors text-left"
                                    title="Write your own wording — created under Custom Templates and selected here"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    New custom template
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => setPreview(selectedTpl)}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium text-[#4D8EF7] border border-[#C8D8FC] bg-[#F5F8FF] hover:bg-[#EEF4FF] transition-colors flex-shrink-0"
                          title={`Preview "${selectedTpl.name}"`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        {!conf.enabled && (
                          <p className="w-full text-[10px] text-[#A0A0B0]">
                            Paused — no {meta.label} emails are sent while disabled.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {/* Complete — deliberately NOT configurable: it never sends an email */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-dashed border-[#E0E0E6] bg-[#FAFBFC]">
            <div className="flex items-start gap-2.5 min-w-0">
              <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-[#22C55E]" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#5A5568]">Complete</p>
                <p className="text-[11px] text-[#A0A0B0] leading-relaxed mt-0.5">
                  No configuration — an email is never sent for cases scored Complete.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#A0A0B0] bg-white border border-[#E0E0E6] flex-shrink-0">
              <Ban className="w-3 h-3" />
              Never sends
            </span>
          </div>
        </div>
      </Card>

      {/* ── 3 · Custom Templates — create & manage the lab's own wording ── */}
      <Card
        title="Custom Templates"
        actions={
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-95 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        }
      >
        {customTemplates.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center mx-auto mb-3">
              <FileText className="w-5 h-5 text-[#7C3AED]" />
            </div>
            <p className="text-sm font-semibold text-[#030213] mb-1">No custom templates yet</p>
            <p className="text-xs text-[#717182] max-w-sm mx-auto">
              Create your own email wording and select it under <span className="font-semibold">Needs Review</span> or{' '}
              <span className="font-semibold">Incomplete</span> above. Placeholders like{' '}
              <span className="font-mono text-[#1565C0]">{'{{Patient Name}}'}</span> are filled automatically from the case.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EFF6]">
            {customTemplates.map(t => {
              const uses = usedBy(t.id);
              return (
                <div key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#EEF4FF] to-[#F3EEFF] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-[#7C3AED]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#030213] flex items-center gap-1.5 flex-wrap">
                      {t.name}
                      {uses.map(c => (
                        <span key={c} className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: CATEGORY_META[c].dot }} />
                          In use · {CATEGORY_META[c].label}
                        </span>
                      ))}
                    </p>
                    <p className="text-[11px] text-[#717182] truncate mt-0.5">
                      Subject: <MergeText text={t.subject} /> · Updated {fmtDate(t.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPreview(t)} title="Preview" className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete(t)} title="Delete" className="p-1.5 rounded-lg text-[#717182] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Mock OAuth consent + connecting state ── */}
      {consentProvider && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !connecting && setConsentProvider(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 pt-6 pb-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-base font-semibold text-[#030213] mb-1">
                  Connect {PROVIDER_META[consentProvider].label}
                </h3>
                <p className="text-sm text-[#717182] leading-relaxed">
                  You'll sign in with {consentProvider === 'google' ? 'Google' : 'Microsoft'} and grant Smile Genius
                  permission to send case scoring emails on your behalf.
                </p>
                <div className="mt-4 flex items-center gap-3 p-3 rounded-xl border border-[#E0E0E6] bg-[#FAFBFC] text-left">
                  <Mail className="w-4 h-4 flex-shrink-0" style={{ color: PROVIDER_META[consentProvider].color }} />
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium text-[#030213] truncate">{MOCK_LAB_EMAIL}</p>
                    <p className="text-[11px] text-[#A0A0B0]">{PROVIDER_META[consentProvider].product} · {PROVIDER_META[consentProvider].oauth}</p>
                  </div>
                </div>
                <p className="text-[10px] text-[#A0A0B0] mt-3">
                  We request send permission only. Demo — no real account is connected.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                <button
                  onClick={() => setConsentProvider(null)}
                  disabled={connecting}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={finishOAuth}
                  disabled={connecting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity disabled:opacity-70"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>Continue with {PROVIDER_META[consentProvider].label}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Disconnect confirmation ── */}
      {disconnectOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDisconnectOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 pt-6 pb-5">
                <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center mb-3">
                  <AlertTriangle className="w-5 h-5 text-[#B91C1C]" />
                </div>
                <h3 className="text-base font-semibold text-[#030213] mb-1">Disconnect email account?</h3>
                <p className="text-sm text-[#717182] leading-relaxed">
                  Automated case scoring emails will stop sending until you reconnect{' '}
                  <span className="font-mono text-[#030213]">{connection.email}</span> or connect a different account.
                  Your automation settings and templates are kept.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                <button onClick={() => setDisconnectOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                  Cancel
                </button>
                <button onClick={handleDisconnect} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#D4183D] hover:bg-[#B91C1C] transition-colors">
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Template preview ── */}
      {preview && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPreview(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                    <Eye className="w-4 h-4 text-[#4D8EF7]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#030213] truncate flex items-center gap-1.5">
                      {preview.name} <ToneChip tone={preview.tone} />
                    </h3>
                    <p className="text-[11px] text-[#717182]">Template preview</p>
                  </div>
                </div>
                <button onClick={() => setPreview(null)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">Subject</p>
                  <p className="text-sm font-medium text-[#030213]"><MergeText text={preview.subject} /></p>
                </div>
                <div className="border-t border-[#F0EFF6] pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1.5">Body</p>
                  <MergeText text={preview.body} block />
                </div>
              </div>
              <div className="px-5 py-3 bg-[#F8F9FC] border-t border-[#F0EFF6] flex-shrink-0">
                <p className="text-[10px] text-[#A0A0B0]">
                  Placeholders are filled automatically from the case when the email is sent.
                </p>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Custom template editor (create + edit) ── */}
      {editor && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditor(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#F3EEFF] flex items-center justify-center flex-shrink-0">
                    <Pencil className="w-4 h-4 text-[#7C3AED]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#030213]">
                      {editor.mode === 'create' ? 'New Custom Template' : `Edit "${editor.name}"`}
                    </h3>
                    <p className="text-[11px] text-[#717182]">
                      {editor.selectFor
                        ? `Will be selected for ${CATEGORY_META[editor.selectFor].label} on save`
                        : 'Usable for Needs Review and Incomplete'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setEditor(null)} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Template name</label>
                    <input
                      value={editor.name}
                      onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                      placeholder="e.g. Our house style"
                      className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
                    />
                  </div>
                  {editor.mode === 'create' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Start from</label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const [cat, idx] = e.target.value.split(':');
                          if (!cat) { setEditor({ ...editor, subject: '', body: '' }); return; }
                          const src = DEFAULT_TEMPLATES[cat as ScoringEmailCategory][Number(idx)];
                          setEditor({ ...editor, subject: src.subject, body: src.body });
                        }}
                        className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] bg-white"
                        title="Copy a default template as your starting point"
                      >
                        <option value="">Blank</option>
                        {CATEGORIES.flatMap(cat =>
                          DEFAULT_TEMPLATES[cat].map((t, i) => (
                            <option key={t.id} value={`${cat}:${i}`}>
                              {CATEGORY_META[cat].label} · {t.name} ({t.tone})
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Subject</label>
                  <input
                    value={editor.subject}
                    onChange={(e) => setEditor({ ...editor, subject: e.target.value })}
                    placeholder="e.g. Your Case Requires Review"
                    className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A5568] uppercase tracking-wider mb-1">Body</label>
                  <textarea
                    value={editor.body}
                    onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                    rows={12}
                    placeholder={'Hi {{Dentist Name}},\n\n…'}
                    className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg outline-none focus:border-[#4D8EF7] focus:ring-2 focus:ring-[#4D8EF7]/15 font-mono leading-relaxed resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1.5">Placeholders — click to copy, then paste where needed</p>
                  <div className="flex flex-wrap gap-1">
                    {SCORING_EMAIL_PLACEHOLDERS.map(p => (
                      <button
                        key={p}
                        onClick={() => copyPlaceholder(p)}
                        title="Click to copy"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-[#BFDBFE] text-[10px] font-mono font-semibold text-[#1565C0] hover:bg-[#EEF4FF]"
                      >
                        {`{{${p}}}`}
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6] flex-shrink-0">
                <button onClick={() => setEditor(null)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                  Cancel
                </button>
                <button
                  onClick={saveEditor}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {editor.mode === 'create' ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Delete-template confirmation ── */}
      {confirmDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setConfirmDelete(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="px-6 pt-6 pb-5">
                <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center mb-3">
                  <Trash2 className="w-5 h-5 text-[#B91C1C]" />
                </div>
                <h3 className="text-base font-semibold text-[#030213] mb-1">Delete "{confirmDelete.name}"?</h3>
                <p className="text-sm text-[#717182] leading-relaxed">
                  {usedBy(confirmDelete.id).length > 0
                    ? `It's currently selected for ${usedBy(confirmDelete.id).map(c => CATEGORY_META[c].label).join(' and ')} — those will fall back to Default Template 1.`
                    : 'This can\'t be undone.'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                <button onClick={() => setConfirmDelete(null)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#D4183D] hover:bg-[#B91C1C] transition-colors">
                  Delete Template
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
