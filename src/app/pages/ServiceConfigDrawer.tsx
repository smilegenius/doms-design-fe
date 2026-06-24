import { useState } from 'react';
import { X, ChevronDown, ChevronRight, Plus, Trash2, Check } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import { useCaseScoring } from '../context/CaseScoringContext';
import { useToast } from '../context/ToastContext';
import { SERVICE_GROUPS } from '../data/caseScoring';
import { isBrandService } from '../data/prescriptionBuilder';
import type { PrescriptionField } from '../data/prescriptionBuilder';
import { BRAND_CATALOG, BrandNode, leafIds } from '../data/implantBrands';
import { MATERIAL_TYPES } from './CreateCasePage';

// ─── Configure Services & Prescriptions — side drawer ─────────────────────────
// Opened from the Prescription Builder. Left rail = services; right = the
// selected service's prescription config: material checkboxes, prescription
// fields (on/off + required/optional + dropdown values), an implant brand tree,
// and a custom-question builder. All edits apply live via CaseScoringContext.

// ── Local primitives (kept local to avoid a circular import with the page) ──
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} role="switch" aria-checked={on}
      className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors ${on ? 'bg-[#4D8EF7]' : 'bg-[#D4CEE1]'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

// Pure checkbox visual (a span, never a button) so it can sit inside clickable
// rows without nesting <button> in <button>.
function CheckVisual({ state }: { state: 'on' | 'off' | 'mixed' }) {
  return (
    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${state === 'off' ? 'bg-white border-[#D4CEE1]' : 'bg-[#4D8EF7] border-[#4D8EF7]'}`}>
      {state === 'on' && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      {state === 'mixed' && <span className="w-2 h-0.5 rounded bg-white" />}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl p-4">
      <p className="text-xs font-bold text-[#030213] uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  );
}

// Inline "add a value" input (chips + brand grids).
function OptionAdder({ onAdd, placeholder = 'Add another option' }: { onAdd: (v: string) => void; placeholder?: string }) {
  const [v, setV] = useState('');
  const commit = () => { if (v.trim()) { onAdd(v.trim()); setV(''); } };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        className="w-40 px-2.5 py-1.5 rounded-lg border border-dashed border-[#C8D8FC] text-xs focus:border-[#4D8EF7] focus:outline-none"
      />
      <button type="button" onClick={commit} className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white flex items-center justify-center hover:opacity-90" title="Add">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

// ── Material (and similar) checkbox grid ──
function MaterialGrid({ selected, master, onToggle, onAdd }: {
  selected: string[]; master: string[]; onToggle: (value: string) => void; onAdd: (value: string) => void;
}) {
  const sel = new Set(selected);
  // Master = canonical list ∪ any custom-added values, de-duplicated, order preserved.
  const all = Array.from(new Set([...master, ...selected]));
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {all.map((opt) => (
          <button
            key={opt} type="button" onClick={() => onToggle(opt)}
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-[#E8E8EC] hover:border-[#C8D8FC] text-left transition-colors"
          >
            <CheckVisual state={sel.has(opt) ? 'on' : 'off'} />
            <span className="text-xs text-[#030213] truncate">{opt}</span>
          </button>
        ))}
      </div>
      <div className="mt-3"><OptionAdder onAdd={onAdd} /></div>
    </div>
  );
}

// ── Implant brand tree (recursive, tri-state) ──
function BrandTree({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const sel = new Set(selected);
  const toggleExpand = (id: string) => setExpanded((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const nodeState = (node: BrandNode): 'on' | 'off' | 'mixed' => {
    const leaves = leafIds(node);
    const on = leaves.filter((id) => sel.has(id)).length;
    if (on === 0) return 'off';
    if (on === leaves.length) return 'on';
    return 'mixed';
  };
  const toggleNode = (node: BrandNode) => {
    const leaves = leafIds(node);
    const allOn = leaves.every((id) => sel.has(id));
    const next = new Set(sel);
    leaves.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    onChange([...next]);
  };
  const renderNode = (node: BrandNode, depth: number): React.ReactNode => {
    const hasChildren = !!node.children?.length;
    const isOpen = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="w-4 h-4 flex items-center justify-center text-[#A0A0B0] hover:text-[#4D8EF7]">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : <span className="w-4 flex-shrink-0" />}
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleNode(node); }} className="flex-shrink-0">
            <CheckVisual state={nodeState(node)} />
          </button>
          <button type="button" onClick={() => hasChildren ? toggleExpand(node.id) : toggleNode(node)} className="text-xs text-[#030213] hover:text-[#1565C0] truncate">
            {node.name}
          </button>
        </div>
        {hasChildren && isOpen && node.children!.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };
  return (
    <div className="max-h-80 overflow-y-auto pr-1 border border-[#F0EFF6] rounded-lg p-2">
      {BRAND_CATALOG.map((n) => renderNode(n, 0))}
    </div>
  );
}

// ── Custom-question builder ──
type AnswerType = 'single' | 'multi' | 'long';
function CustomQuestionBuilder({ onAdd }: { onAdd: (q: { description: string; answerType: AnswerType; options: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [answerType, setAnswerType] = useState<AnswerType>('single');
  const [options, setOptions] = useState<string[]>(['Option 1']);

  const reset = () => { setDescription(''); setAnswerType('single'); setOptions(['Option 1']); };
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const canConfirm = description.trim().length > 0 && (answerType === 'long' || cleanOptions.length > 0);

  const commit = (another: boolean) => {
    if (!canConfirm) return;
    onAdd({ description: description.trim(), answerType, options: answerType === 'long' ? [] : cleanOptions });
    reset();
    if (!another) setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#1565C0] border border-dashed border-[#C8D8FC] bg-[#F5F8FF] hover:border-[#4D8EF7] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add new questions
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#E0E0E6] bg-[#FAFBFC] p-3.5 space-y-3">
      <div>
        <label className="block text-[11px] font-semibold text-[#5A5568] mb-1">Description <span className="text-[#D4183D]">*</span></label>
        <input
          value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter question description…"
          className="w-full px-3 py-2 rounded-lg border border-[#E0E0E6] bg-white text-sm focus:border-[#4D8EF7] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#5A5568] mb-1.5">Answer Type <span className="text-[#D4183D]">*</span></label>
        <div className="flex flex-wrap gap-4">
          {([['single', 'Single Selection'], ['multi', 'Multi Selection'], ['long', 'Long Answer']] as const).map(([id, label]) => (
            <label key={id} className="inline-flex items-center gap-1.5 text-xs text-[#030213] cursor-pointer">
              <input type="radio" name="answerType" checked={answerType === id} onChange={() => setAnswerType(id)} className="appearance-none w-3.5 h-3.5 rounded-full border-2 border-[#C8D8FC] checked:border-[#4D8EF7] checked:bg-[#4D8EF7] relative" />
              {label}
            </label>
          ))}
        </div>
      </div>
      {answerType !== 'long' && (
        <div>
          <label className="block text-[11px] font-semibold text-[#5A5568] mb-1.5">Options</label>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#E0E0E6] bg-white text-xs focus:border-[#4D8EF7] focus:outline-none"
                />
                {options.length > 1 && (
                  <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} className="p-1 text-[#A0A0B0] hover:text-[#D4183D]" title="Remove option">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setOptions((prev) => [...prev, `Option ${prev.length + 1}`])} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#4D8EF7] hover:text-[#1565C0]">
            <Plus className="w-3 h-3" /> Add another option
          </button>
        </div>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={() => { reset(); setOpen(false); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5A5568] border border-[#E0E0E6] bg-white hover:bg-[#F3F3F5]">Back</button>
        <button type="button" disabled={!canConfirm} onClick={() => commit(true)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${canConfirm ? 'text-[#1565C0] border-[#C8D8FC] bg-[#EEF4FF] hover:bg-[#DBEAFE]' : 'text-[#C0C0CC] border-[#EEEEF2] cursor-not-allowed'}`}>Confirm &amp; Add Another</button>
        <button type="button" disabled={!canConfirm} onClick={() => commit(false)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${canConfirm ? 'bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90' : 'bg-[#C8C0F0] opacity-60 cursor-not-allowed'}`}>Confirm</button>
      </div>
    </div>
  );
}

const ANSWER_TYPE_LABEL: Record<AnswerType, string> = { single: 'Single selection', multi: 'Multi selection', long: 'Long answer' };

export default function ServiceConfigDrawer({ service, onSelectService, onClose }: {
  service: string; onSelectService: (s: string) => void; onClose: () => void;
}) {
  const {
    prescription, serviceOffered, setServiceOffered,
    setPrescriptionEnabled, setPrescriptionRequired,
    addPrescriptionOption, removePrescriptionOption, setPrescriptionOptions,
    addPrescriptionField, removePrescriptionField, config,
  } = useCaseScoring();
  const { toast } = useToast();

  const fields = prescription[service] ?? [];
  const materialField = fields.find((f) => f.id === 'material');
  const brandField = fields.find((f) => f.id === 'brand');
  const customFields = fields.filter((f) => f.custom);
  // Standard fields = everything except the material grid + brand tree + custom questions.
  const standardFields = fields.filter((f) => !f.custom && f.id !== 'material' && f.id !== 'brand');
  const offered = serviceOffered[service] !== false;
  const isWeighted = (id: string) => (config[service] ?? []).some((f) => f.id === id && f.weight > 0);

  const addCustom = (q: { description: string; answerType: AnswerType; options: string[] }) => {
    const type = q.answerType === 'single' ? 'select' : q.answerType === 'multi' ? 'multiselect' : 'text';
    const field: PrescriptionField = {
      id: `cq-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      label: q.description,
      type: type as PrescriptionField['type'],
      enabled: true, required: false, scoreable: false, custom: true, answerType: q.answerType,
      options: q.answerType === 'long' ? undefined : q.options,
    };
    addPrescriptionField(service, field);
    toast.success('Custom question added');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[120] flex">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
        <div className="relative md:ml-auto flex flex-col bg-white shadow-2xl w-full md:w-[880px] md:max-w-[94vw] h-full animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EFF6] flex-shrink-0">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#030213]">Configure services &amp; prescriptions</h3>
              <p className="text-[11px] text-[#717182]">Set the fields, materials, brands and custom questions a clinic fills in.</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[#F8F9FC] flex items-center justify-center text-[#717182] transition-colors"><X className="w-4 h-4" /></button>
          </div>

          {/* Body: left service rail + right config */}
          <div className="flex-1 min-h-0 flex">
            <aside className="w-44 sm:w-52 flex-shrink-0 border-r border-[#F0EFF6] overflow-y-auto bg-[#FAFBFC] p-2">
              {SERVICE_GROUPS.map((group) => (
                <div key={group.category} className="mb-1.5">
                  <p className="px-2 pt-1.5 pb-1 text-[9px] font-bold text-[#A0A0B0] uppercase tracking-widest">{group.category}</p>
                  {group.services.map((s) => (
                    <button
                      key={s} onClick={() => onSelectService(s)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-lg text-left text-xs transition-colors ${
                        s === service ? 'bg-white border border-[#C8D8FC] font-semibold text-[#1565C0]' : 'text-[#5A5568] border border-transparent hover:bg-white'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${serviceOffered[s] !== false ? 'bg-[#10B981]' : 'bg-[#D4CEE1]'}`} />
                      <span className="truncate">{s}</span>
                    </button>
                  ))}
                </div>
              ))}
            </aside>

            <div className="flex-1 min-w-0 overflow-y-auto p-5 space-y-4 bg-[#FAFBFC]">
              {/* Service header + offered toggle */}
              <div className="flex items-center justify-between gap-3 bg-white border border-[#E0E0E6] rounded-xl px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4D8EF7] to-[#A59DFF] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">{service.charAt(0)}</span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#030213] truncate">{service}</p>
                    <p className="text-[11px] text-[#717182]">{offered ? 'Offered to clinics' : 'Not offered'}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs font-medium text-[#5A5568] flex-shrink-0">
                  Offered <Toggle on={offered} onClick={() => setServiceOffered(service, !offered)} />
                </span>
              </div>

              {/* Material type checkboxes */}
              {materialField && (
                <Section title="Select Material Type">
                  <MaterialGrid
                    selected={materialField.options ?? []}
                    master={[...MATERIAL_TYPES]}
                    onToggle={(v) => (materialField.options ?? []).includes(v)
                      ? removePrescriptionOption(service, 'material', v)
                      : addPrescriptionOption(service, 'material', v)}
                    onAdd={(v) => addPrescriptionOption(service, 'material', v)}
                  />
                </Section>
              )}

              {/* Implant brand tree */}
              {brandField && isBrandService(service) && (
                <Section title="Select Brand">
                  <BrandTree
                    selected={brandField.options ?? []}
                    onChange={(next) => setPrescriptionOptions(service, 'brand', next)}
                  />
                </Section>
              )}

              {/* Prescription fields (on/off + required/optional + dropdown values) */}
              <Section title="Prescription fields">
                <div className="divide-y divide-[#F6F6F9]">
                  {standardFields.map((field) => {
                    const weighted = isWeighted(field.id);
                    return (
                      <div key={field.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <Toggle
                            on={field.enabled}
                            onClick={() => {
                              if (field.enabled && field.scoreable && weighted) {
                                toast.error(`"${field.label}" is used in Case Scoring — scoring for ${service} will go out of sync.`);
                              }
                              setPrescriptionEnabled(service, field.id, !field.enabled);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm ${field.enabled ? 'text-[#030213] font-medium' : 'text-[#A0A0B0]'}`}>{field.label}</span>
                              {field.scoreable && weighted && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#EEF4FF] text-[#1565C0] border border-[#C8D8FC]">Scored</span>
                              )}
                            </div>
                            {field.hint && <span className="block text-[10px] text-[#A0A0B0] mt-0.5">{field.hint}</span>}
                          </div>
                          <button
                            type="button" disabled={!field.enabled}
                            onClick={() => setPrescriptionRequired(service, field.id, !field.required)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors flex-shrink-0 ${
                              !field.enabled ? 'opacity-40 cursor-not-allowed border-[#EEEEF2] text-[#C0C0CC]'
                                : field.required ? 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] hover:bg-[#FFEDD5]'
                                  : 'bg-[#F8F9FC] text-[#717182] border-[#E0E0E6] hover:border-[#4D8EF7]'
                            }`}
                          >
                            {field.required ? 'Required' : 'Optional'}
                          </button>
                        </div>
                        {field.enabled && (field.type === 'select' || field.type === 'multiselect') && field.options && (
                          <div className="mt-2 ml-12 flex flex-wrap gap-1.5 items-center">
                            {field.options.map((opt) => (
                              <span key={opt} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#F3F3F5] text-[#5A5568] border border-[#E8E8EC]">
                                {opt}
                                <button type="button" onClick={() => removePrescriptionOption(service, field.id, opt)} className="text-[#A0A0B0] hover:text-[#D4183D]" title="Remove value"><X className="w-2.5 h-2.5" /></button>
                              </span>
                            ))}
                            <OptionAdder onAdd={(v) => addPrescriptionOption(service, field.id, v)} placeholder="Add value…" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Custom questions */}
              <Section title="Custom questions">
                <p className="text-[11px] text-[#717182] -mt-1.5 mb-3">Add your own questions to gather exactly the information you need for this service.</p>
                {customFields.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {customFields.map((f) => (
                      <div key={f.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-[#E8E8EC] bg-white">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#030213]">{f.label}</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#F3F3F5] text-[#8B8B9E]">{ANSWER_TYPE_LABEL[f.answerType ?? 'single']}</span>
                          </div>
                          {f.options && f.options.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {f.options.map((o) => <span key={o} className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#F3F3F5] text-[#5A5568] border border-[#E8E8EC]">{o}</span>)}
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => removePrescriptionField(service, f.id)} className="p-1 text-[#A0A0B0] hover:text-[#D4183D] flex-shrink-0" title="Remove question"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <CustomQuestionBuilder onAdd={addCustom} />
              </Section>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#F0EFF6] bg-white flex-shrink-0">
            <span className="mr-auto text-[11px] text-[#717182] inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#15803D]" /> Changes apply live across the lab &amp; clinic.</span>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[#5A5568] border border-[#E0E0E6] bg-white hover:bg-[#F3F3F5] transition-colors">Back</button>
            <button onClick={onClose} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] hover:opacity-90 transition-opacity"><Check className="w-4 h-4" /> Save &amp; Close</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
