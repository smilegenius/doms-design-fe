import { useState } from 'react';
import {
  MessageCircle, CheckCircle2, AlertTriangle, ChevronDown, Eye, Plus, Pencil, Trash2, X, Copy, Check, Smartphone, RefreshCw,
} from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import Toggle from '../components/Toggle';
import { useToast } from '../context/ToastContext';
import { CATEGORY_META, ScoringEmailCategory } from '../data/caseScoringEmails';
import {
  BLOCK_REASON_TEXT,
  DEFAULT_WHATSAPP_TEMPLATES,
  MOCK_LAB_WHATSAPP_NAME,
  MOCK_LAB_WHATSAPP_NUMBER,
  WHATSAPP_PLACEHOLDERS,
  WhatsAppTemplate,
  addCustomWhatsAppTemplate,
  connectWhatsApp,
  disconnectWhatsApp,
  isValidWhatsAppNumber,
  reconnectWhatsApp,
  removeCustomWhatsAppTemplate,
  selectWhatsAppTemplate,
  setWhatsAppAutomationEnabled,
  setWhatsAppEnabled,
  updateCustomWhatsAppTemplate,
  useWhatsAppComms,
  whatsappBlockReason,
} from '../data/whatsappComms';

// ─── Settings → Automated Communication → WhatsApp ───────────────────────────
// The WhatsApp half of the lab's automated communication. It reuses the case
// scoring outcomes (Needs Review / Incomplete) as its trigger events — the
// same workflow that decides when an email goes out decides when a WhatsApp
// message goes out — and adds only what is specific to the channel: the lab's
// connected WhatsApp Business number, the per-outcome message content, and the
// master WhatsApp communication setting that gates every send, automated or
// manual.

const CATEGORIES: ScoringEmailCategory[] = ['needs-review', 'incomplete'];

/** "12 Aug 2026" — the connected-since stamp, same format the email card uses. */
function fmtDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Card({ title, actions, children }: { title: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-visible">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#F0EFF6] flex-wrap">
        <h3 className="text-sm font-semibold text-[#030213]">{title}</h3>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ToneChip({ tone }: { tone: string }) {
  const map: Record<string, string> = {
    Professional: 'bg-[#EEF4FF] text-[#1565C0] border-[#C8D8FC]',
    Friendly: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
    Custom: 'bg-[#F3EEFF] text-[#7C3AED] border-[#DDD6FE]',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border flex-shrink-0 ${map[tone] ?? map.Custom}`}>
      {tone}
    </span>
  );
}

/** WhatsApp bodies carry {{Placeholder}} tokens — highlight them like the email preview does. */
function MergeText({ text }: { text: string }) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{[^}]+\}\}$/.test(p)
          ? <span key={i} className="px-1 py-0.5 rounded bg-[#F0FDF4] text-[#15803D] font-semibold text-[11px] border border-[#BBF7D0]">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

interface EditorState { mode: 'create' | 'edit'; id?: string; name: string; body: string; selectFor?: ScoringEmailCategory }

export default function WhatsAppCommunicationSettings() {
  const { toast } = useToast();
  const settings = useWhatsAppComms();
  const { enabled, connection, automation, customTemplates } = settings;
  const connected = connection.status === 'connected';
  const blocked = whatsappBlockReason(settings);

  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  // "Connect a different account" re-opens the linking form after a disconnect,
  // the same escape hatch the email integration offers.
  const [pickerOverride, setPickerOverride] = useState(false);
  // The account being linked: details first, then a consent beat (the real
  // product hands off to Meta's embedded signup here).
  const [linkForm, setLinkForm] = useState({ businessName: MOCK_LAB_WHATSAPP_NAME, number: MOCK_LAB_WHATSAPP_NUMBER });
  const [consentOpen, setConsentOpen] = useState(false);
  const [templateMenuFor, setTemplateMenuFor] = useState<ScoringEmailCategory | null>(null);
  const [preview, setPreview] = useState<WhatsAppTemplate | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppTemplate | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Never connected, or deliberately linking a different number — either way
  // the linking form is what the modal shows.
  const showLinkForm = !connected && (pickerOverride || !connection.lastNumber);
  const linkValid = linkForm.businessName.trim().length > 0 && isValidWhatsAppNumber(linkForm.number);

  // Start a fresh link. A different account starts from a blank form so the
  // remembered number isn't accidentally re-linked.
  const openLinkForm = (blank: boolean) => {
    setLinkForm(blank
      ? { businessName: '', number: '' }
      : { businessName: MOCK_LAB_WHATSAPP_NAME, number: MOCK_LAB_WHATSAPP_NUMBER });
    setPickerOverride(true);
  };

  // Embedded signup is a Meta-hosted flow in the real product; here it is a
  // consent step plus a short "linking" beat.
  const finishLink = () => {
    setConnecting(true);
    window.setTimeout(() => {
      connectWhatsApp(linkForm.number.trim(), linkForm.businessName.trim());
      setConnecting(false);
      setConsentOpen(false);
      setPickerOverride(false);
      setIntegrationOpen(false);
      toast.success(`WhatsApp Business connected — messages send from ${linkForm.number.trim()}`);
    }, 900);
  };
  const handleDisconnect = () => {
    disconnectWhatsApp();
    setDisconnectOpen(false);
    setIntegrationOpen(false);
    toast.success('WhatsApp Business disconnected — automated and manual WhatsApp messages are paused');
  };
  const handleReconnect = () => {
    reconnectWhatsApp();
    setIntegrationOpen(false);
    toast.success(`Reconnected to ${connection.lastNumber ?? MOCK_LAB_WHATSAPP_NUMBER} — WhatsApp communication resumed`);
  };

  const saveEditor = () => {
    if (!editor) return;
    if (!editor.name.trim() || !editor.body.trim()) {
      toast.error('Give the message a name and a body before saving.');
      return;
    }
    if (editor.mode === 'edit' && editor.id) {
      updateCustomWhatsAppTemplate(editor.id, { name: editor.name, body: editor.body });
      toast.success(`"${editor.name.trim()}" updated`);
    } else {
      const tpl = addCustomWhatsAppTemplate({ name: editor.name, body: editor.body });
      if (editor.selectFor) {
        selectWhatsAppTemplate(editor.selectFor, tpl.id);
        toast.success(`"${tpl.name}" created and selected for ${CATEGORY_META[editor.selectFor].label}`);
      } else {
        toast.success(`"${tpl.name}" created — select it under Needs Review or Incomplete`);
      }
    }
    setEditor(null);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    removeCustomWhatsAppTemplate(confirmDelete.id);
    toast.success(`"${confirmDelete.name}" deleted`);
    setConfirmDelete(null);
  };

  const copyPlaceholder = (p: string) => {
    navigator.clipboard?.writeText(`{{${p}}}`);
    setCopied(p);
    window.setTimeout(() => setCopied(c => (c === p ? null : c)), 1200);
  };

  const usedBy = (id: string): ScoringEmailCategory[] => CATEGORIES.filter(c => automation[c].templateId === id);

  return (
    <div className="space-y-4">

      {/* ── Header: what the channel does + the master setting + connection.
          The setting and the connection are separate on purpose — a lab can
          keep the account linked while switching the channel off. ── */}
      <div className="bg-gradient-to-br from-[#F0FDF4] to-[#ECFDF5] border border-[#BBF7D0] rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <span className="w-9 h-9 rounded-lg bg-white border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-[#15803D]" />
        </span>
        <div className="flex-1 min-w-[220px] text-xs text-[#2F4F3A] leading-relaxed">
          <span className="font-semibold text-[#15803D]">WhatsApp Communication.</span>{' '}
          Case updates over WhatsApp — automatically on the same scoring events as email, or manually from a case —
          all from your own WhatsApp Business number.
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIntegrationOpen(true)}
            title={connected ? `Manage the WhatsApp integration — sending as ${connection.number}` : 'Connect your WhatsApp Business account'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              connected
                ? 'bg-[#F0FDF4] text-[#2E7D32] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                : 'bg-[#FFF8E1] text-[#B45309] border-[#FDE68A] hover:bg-[#FEF3C7]'
            }`}
          >
            {connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {connected ? 'Connected' : 'Not Connected'}
            <ChevronDown className="w-3 h-3 -rotate-90" />
          </button>
        </div>
      </div>

      {enabled && !connected && (
        <div className="bg-white border border-[#E0E0E6] rounded-xl px-5 py-4 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[#717182] leading-relaxed">
            <p><span className="font-semibold text-[#030213]">{BLOCK_REASON_TEXT.disconnected}</span>{' '}
            Configure the automation now if you like — nothing sends until an account is linked, and any attempt is
            recorded on the case as a failure.</p>
            <button
              onClick={() => setIntegrationOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" /> Connect WhatsApp Business
            </button>
          </div>
        </div>
      )}

      {/* ── WhatsApp Automation — one toggle + one message per outcome. The
          trigger events are the case scoring outcomes, exactly as for email.
          The master WhatsApp setting lives on this card's header, next to the
          sending number: the switch and the number it sends from read as one
          decision. It stays mounted when the channel is off — otherwise there
          would be no way to turn it back on. ── */}
      <Card
        title="WhatsApp Automation"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {connected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0]">
                <Smartphone className="w-3 h-3" />
                Sending from {connection.number}
              </span>
            )}
            <span className={`text-[11px] font-semibold ${enabled ? 'text-[#15803D]' : 'text-[#A0A0B0]'}`}>
              {enabled ? 'On' : 'Off'}
            </span>
            <Toggle
              on={enabled}
              title={enabled ? 'Turn WhatsApp communication off' : 'Turn WhatsApp communication on'}
              onChange={() => {
                setWhatsAppEnabled(!enabled);
                toast.success(enabled
                  ? 'WhatsApp communication turned off — no WhatsApp messages will be sent'
                  : 'WhatsApp communication turned on');
              }}
            />
          </div>
        }
      >
        {!enabled ? (
          /* The channel is off — say so plainly. Nothing below applies while
             no WhatsApp message can be sent, so the config is not shown. */
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#B45309] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#717182] leading-relaxed">
              <span className="font-semibold text-[#030213]">{BLOCK_REASON_TEXT.disabled}</span>{' '}
              Automated WhatsApp messages are not sent, and lab users cannot send a WhatsApp message from a case.
              Turn the setting on to configure the channel.
            </p>
          </div>
        ) : (<>
        <p className="text-xs text-[#717182] leading-relaxed mb-4">
          A scored case sends the selected message to the same recipient the email automation uses — the case&apos;s
          dentist. Each outcome has its own on/off toggle and exactly one selected message.
        </p>

        {/* The two outcome descriptions wrap to different line counts, so the
            grey headers are different heights — which pushes the message
            dropdowns out of line. Subgrid puts BOTH cards' headers in the same
            grid row and both message rows in the next, so the headers share a
            height and the dropdowns line up. */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-4 ${connected ? '' : 'opacity-60'}`}>
          {CATEGORIES.map(cat => {
            const meta = CATEGORY_META[cat];
            const conf = automation[cat];
            const options = [...DEFAULT_WHATSAPP_TEMPLATES[cat], ...customTemplates];
            const selectedTpl = options.find(t => t.id === conf.templateId) ?? options[0];
            const menuOpen = templateMenuFor === cat;

            const optionRow = (t: WhatsAppTemplate) => {
              const selected = conf.templateId === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors ${selected ? 'bg-[#F0FDF4]' : 'hover:bg-[#F8F9FC]'}`}
                >
                  <button
                    onClick={() => {
                      if (!selected) { selectWhatsAppTemplate(cat, t.id); toast.success(`"${t.name}" selected for ${meta.label}`); }
                      setTemplateMenuFor(null);
                    }}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    role="option"
                    aria-selected={selected}
                    title={selected ? 'Selected message' : `Use "${t.name}" for ${meta.label}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-[#15803D]' : 'border-[#D4CEE1]'}`}>
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold ${selected ? 'text-[#15803D]' : 'text-[#030213]'}`}>{t.name}</span>
                        <ToneChip tone={t.tone} />
                      </span>
                      <span className="block text-[10px] text-[#A0A0B0] truncate mt-px">{t.body.split('\n')[0]}</span>
                    </span>
                  </button>
                  <button
                    onClick={() => { setTemplateMenuFor(null); setPreview(t); }}
                    className="p-1 rounded-md text-[#717182] hover:text-[#15803D] hover:bg-white transition-colors flex-shrink-0"
                    title={`Preview "${t.name}"`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            };

            return (
              <div key={cat} className="border border-[#E0E0E6] rounded-xl h-full flex flex-col lg:grid lg:grid-rows-subgrid lg:row-span-2">
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#FAFBFC] border-b border-[#F0EFF6] rounded-t-xl flex-shrink-0">
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
                        setWhatsAppAutomationEnabled(cat, !conf.enabled);
                        toast.success(`${meta.label} WhatsApp messages ${conf.enabled ? 'disabled' : 'enabled'}`);
                      }}
                    />
                  </div>
                </div>

                <div className={`px-4 py-3 flex-1 flex items-center transition-opacity ${conf.enabled ? '' : 'opacity-55'}`}>
                  <div className="flex items-center gap-2 flex-wrap w-full">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] flex-shrink-0">Message</p>
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                      <button
                        onClick={() => setTemplateMenuFor(menuOpen ? null : cat)}
                        aria-haspopup="listbox"
                        aria-expanded={menuOpen}
                        title={`Change the ${meta.label} WhatsApp message`}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-white transition-colors text-left ${menuOpen ? 'border-[#15803D] ring-2 ring-[#15803D]/15' : 'border-[#E0E0E6] hover:border-[#BBF7D0]'}`}
                      >
                        <span className="text-xs font-semibold text-[#030213] truncate">{selectedTpl.name}</span>
                        <ToneChip tone={selectedTpl.tone} />
                        <ChevronDown className={`w-3.5 h-3.5 text-[#717182] ml-auto flex-shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {menuOpen && (
                        <>
                          <span className="fixed inset-0 z-20" onClick={() => setTemplateMenuFor(null)} />
                          <div className="absolute top-full left-0 right-0 mt-1 z-30 rounded-xl border border-[#E0E0E6] bg-white shadow-lg" role="listbox">
                            <div className="max-h-64 overflow-y-auto p-1.5">
                              <p className="px-2 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#A0A0B0]">Default messages</p>
                              {DEFAULT_WHATSAPP_TEMPLATES[cat].map(optionRow)}
                              {customTemplates.length > 0 && (
                                <p className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-[#A0A0B0] border-t border-[#F0EFF6] mt-1.5">Custom messages</p>
                              )}
                              {customTemplates.map(optionRow)}
                            </div>
                            <div className="border-t border-[#F0EFF6] p-1.5">
                              <button
                                onClick={() => { setTemplateMenuFor(null); setEditor({ mode: 'create', name: '', body: '', selectFor: cat }); }}
                                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition-colors text-left"
                                title="Write your own wording — created under Custom messages and selected here"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                New custom message
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => setPreview(selectedTpl)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-medium text-[#15803D] border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-colors flex-shrink-0"
                      title={`Preview "${selectedTpl.name}"`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    {!conf.enabled && (
                      <p className="w-full text-[10px] text-[#A0A0B0]">
                        Paused — no {meta.label} WhatsApp messages are sent while disabled.
                      </p>
                    )}
                    {conf.enabled && blocked === 'disconnected' && (
                      <p className="w-full text-[10px] text-[#B45309]">
                        Configured, but nothing can send — connect a WhatsApp Business account.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </>)}
      </Card>

      {/* ── Custom messages — the lab's own wording, reusable across outcomes ── */}
      {enabled && (
      <Card
        title="Custom Messages"
        actions={
          <button
            onClick={() => setEditor({ mode: 'create', name: '', body: '' })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New message
          </button>
        }
      >
        {customTemplates.length === 0 ? (
          <p className="text-xs text-[#717182] leading-relaxed">
            No custom messages yet. The default messages above cover both outcomes — add your own when you want
            different wording.
          </p>
        ) : (
          <div className="space-y-2">
            {customTemplates.map(t => {
              const used = usedBy(t.id);
              return (
                <div key={t.id} className="flex items-start gap-3 border border-[#E0E0E6] rounded-xl px-4 py-3">
                  <span className="w-8 h-8 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-3.5 h-3.5 text-[#15803D]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-[#030213]">{t.name}</p>
                      <ToneChip tone={t.tone} />
                      {used.map(c => (
                        <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#F3F3F5] text-[#717182] border border-[#E0E0E6]">
                          Used for {CATEGORY_META[c].label}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#717182] mt-1 line-clamp-2 whitespace-pre-line">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPreview(t)} title="Preview" className="p-1.5 rounded-lg text-[#717182] hover:text-[#15803D] hover:bg-[#F0FDF4] transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditor({ mode: 'edit', id: t.id, name: t.name, body: t.body })} title="Edit" className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(t)} title="Delete" className="p-1.5 rounded-lg text-[#717182] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      )}

      {/* ── WhatsApp Integration modal — connect / reconnect / disconnect ── */}
      {integrationOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !connecting && setIntegrationOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-[#15803D]" />
                  </span>
                  <h3 className="text-sm font-semibold text-[#030213]">WhatsApp Integration</h3>
                </div>
                <button onClick={() => !connecting && setIntegrationOpen(false)} className="p-1.5 rounded-lg text-[#717182] hover:bg-[#F3F3F5] transition-colors"><X className="w-4 h-4" /></button>
              </div>

              <div className="px-5 py-4">
                {connected ? (
                  /* Connected — account details + disconnect */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4]">
                      <span className="w-9 h-9 rounded-lg bg-white border border-[#BBF7D0] flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#030213] truncate">{connection.businessName}</p>
                        <p className="flex items-center gap-1.5 text-[11px] text-[#2E7D32] tabular-nums">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                          {connection.number} · Connected {fmtDate(connection.connectedAt)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#717182] leading-relaxed">
                      Every automated and manual WhatsApp message on a case sends from this number, so the dentist
                      sees the lab — not Smile Genius.
                    </p>
                  </div>
                ) : showLinkForm ? (
                  /* Never connected (or linking a different account) */
                  <div className="space-y-3">
                    <p className="text-xs text-[#717182] leading-relaxed">
                      Link the lab&apos;s WhatsApp Business account. Case messages then send from your number, and
                      dentist replies come back to it. Nothing sends until an account is connected.
                    </p>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">Business display name</p>
                      <input
                        value={linkForm.businessName}
                        onChange={(e) => setLinkForm(f => ({ ...f, businessName: e.target.value }))}
                        placeholder="e.g. Smile Genius Lab"
                        className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:border-[#15803D] focus:outline-none"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">WhatsApp Business number</p>
                      <input
                        value={linkForm.number}
                        onChange={(e) => setLinkForm(f => ({ ...f, number: e.target.value }))}
                        placeholder="+44 7700 900000"
                        className={`w-full px-3 py-2 rounded-lg border text-sm text-[#030213] tabular-nums focus:outline-none transition-colors ${
                          linkForm.number.trim() && !isValidWhatsAppNumber(linkForm.number)
                            ? 'border-[#FECACA] focus:border-[#DC2626]'
                            : 'border-[#E0E0E6] focus:border-[#15803D]'
                        }`}
                      />
                      {linkForm.number.trim() && !isValidWhatsAppNumber(linkForm.number) && (
                        <p className="text-[10px] text-[#B91C1C] mt-1">Enter a valid number, including the country code.</p>
                      )}
                    </div>
                    {connection.lastNumber && (
                      <button onClick={() => setPickerOverride(false)} className="text-[11px] font-medium text-[#717182] hover:text-[#030213]">
                        ← Back
                      </button>
                    )}
                  </div>
                ) : (
                  /* Previously connected → one-click Reconnect */
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-[#FDE68A] bg-[#FFF8E1]">
                      <span className="w-9 h-9 rounded-lg bg-white border border-[#FDE68A] flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="w-4 h-4 text-[#B45309]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#030213] truncate">{connection.lastBusinessName}</p>
                        <p className="text-[11px] text-[#B45309] tabular-nums">
                          {connection.lastNumber} · Disconnected — WhatsApp messages are paused
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#717182] leading-relaxed">
                      Reconnect to resume, or connect a different account — your automation settings and messages are
                      kept either way.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                {connected ? (
                  <>
                    <button onClick={() => setIntegrationOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                      Close
                    </button>
                    <button
                      onClick={() => setDisconnectOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-[#B91C1C] border border-[#FECACA] bg-white hover:bg-[#FEF2F2] transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </>
                ) : showLinkForm ? (
                  <>
                    <button onClick={() => setIntegrationOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                      Close
                    </button>
                    <button
                      onClick={() => setConsentOpen(true)}
                      disabled={!linkValid}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-[#15803D]"
                    >
                      <Smartphone className="w-4 h-4" />
                      Connect
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => openLinkForm(true)}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors"
                    >
                      Connect a different account
                    </button>
                    <button
                      onClick={handleReconnect}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Consent + linking beat — the stand-in for Meta's embedded signup ── */}
      {consentOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !connecting && setConsentOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="px-6 pt-6 pb-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#15803D] flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
                {connecting ? (
                  <>
                    <h3 className="text-base font-semibold text-[#030213] mb-1">Linking your WhatsApp Business account…</h3>
                    <p className="text-sm text-[#717182] leading-relaxed">Confirming the number and message permissions.</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold text-[#030213] mb-1">Connect {linkForm.businessName.trim()}</h3>
                    <p className="text-sm text-[#717182] leading-relaxed">
                      Smile Genius will send case messages from{' '}
                      <span className="font-semibold text-[#030213] tabular-nums">{linkForm.number.trim()}</span>, and
                      dentist replies come back to this account. You can disconnect at any time.
                    </p>
                  </>
                )}
              </div>
              {!connecting && (
                <div className="flex items-center justify-end gap-2 px-5 py-4 bg-[#F8F9FC] border-t border-[#F0EFF6]">
                  <button onClick={() => setConsentOpen(false)} className="px-3 py-2 rounded-lg text-sm font-medium text-[#5A5568] hover:bg-[#F0EFF6] transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={finishLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Allow &amp; connect
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Disconnect confirmation ── */}
      {disconnectOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDisconnectOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <h3 className="text-base font-semibold text-[#030213] mb-1">Disconnect WhatsApp Business?</h3>
              <p className="text-xs text-[#717182] leading-relaxed">
                Automated WhatsApp messages stop immediately and lab users cannot send a WhatsApp message from a
                case. Anything the automation tries to send while disconnected is recorded on the case as a failure.
              </p>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button onClick={() => setDisconnectOpen(false)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#030213] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors">Cancel</button>
                <button onClick={handleDisconnect} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors">Disconnect</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Message preview — rendered as a WhatsApp bubble so the lab sees
          what actually lands on the dentist's phone. ── */}
      {preview && (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPreview(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-[#15803D]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#030213] truncate">{preview.name}</h3>
                    <p className="text-[10px] text-[#A0A0B0]">
                      From {connection.number ?? MOCK_LAB_WHATSAPP_NUMBER}
                    </p>
                  </div>
                </div>
                <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg text-[#717182] hover:bg-[#F3F3F5] transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 overflow-y-auto bg-[#F7F8FA]">
                <div className="rounded-2xl rounded-tr-sm bg-[#DCFCE7] border border-[#BBF7D0] px-3.5 py-2.5">
                  <p className="text-xs text-[#14532D] leading-relaxed whitespace-pre-line">
                    <MergeText text={preview.body} />
                  </p>
                </div>
                <p className="text-[10px] text-[#A0A0B0] mt-2">
                  Highlighted values are filled in from the case when the message is sent.
                </p>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Custom message editor (create + edit) ── */}
      {editor && (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setEditor(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
                <h3 className="text-sm font-semibold text-[#030213]">
                  {editor.mode === 'edit' ? 'Edit custom message' : 'New custom message'}
                </h3>
                <button onClick={() => setEditor(null)} className="p-1.5 rounded-lg text-[#717182] hover:bg-[#F3F3F5] transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5 space-y-3 overflow-y-auto">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">Name</p>
                  <input
                    value={editor.name}
                    onChange={(e) => setEditor(s => s && ({ ...s, name: e.target.value }))}
                    placeholder="e.g. Chase missing scans"
                    className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] focus:border-[#15803D] focus:outline-none"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1">Message</p>
                  <textarea
                    value={editor.body}
                    onChange={(e) => setEditor(s => s && ({ ...s, body: e.target.value }))}
                    rows={9}
                    placeholder={'Hi {{Dentist Name}}, …'}
                    className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] text-sm text-[#030213] leading-relaxed focus:border-[#15803D] focus:outline-none resize-y"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0B0] mb-1.5">Placeholders — click to copy, then paste where needed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WHATSAPP_PLACEHOLDERS.map(p => (
                      <button
                        key={p}
                        onClick={() => copyPlaceholder(p)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[#15803D] bg-[#F0FDF4] border border-[#BBF7D0] hover:bg-[#DCFCE7] transition-colors"
                      >
                        {copied === p ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#F0EFF6] flex-shrink-0">
                <button onClick={() => setEditor(null)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#030213] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors">Cancel</button>
                <button onClick={saveEditor} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors">
                  {editor.mode === 'edit' ? 'Save changes' : 'Create message'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setConfirmDelete(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
              <h3 className="text-base font-semibold text-[#030213] mb-1">Delete &quot;{confirmDelete.name}&quot;?</h3>
              <p className="text-xs text-[#717182] leading-relaxed">
                Any outcome using it falls back to its default message.
              </p>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button onClick={() => setConfirmDelete(null)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#030213] border border-[#E0E0E6] hover:bg-[#F8F9FC] transition-colors">Cancel</button>
                <button onClick={handleDelete} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
