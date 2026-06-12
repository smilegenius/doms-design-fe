import { X, UserPlus, Mail, Building2, User, ChevronDown, ChevronUp, RotateCcw, Bold, Italic, List, ListOrdered, AlignLeft, Minus, Pencil, Hash } from 'lucide-react';
import { Practice, StaffMember } from '../data/clinicsData';
import { useState, useRef } from 'react';
import AddStaffModal, { StaffFormData } from './AddStaffModal';
import ModalPortal from './ModalPortal';

interface InviteModalProps {
  onClose: () => void;
  selectedPractices?: Practice[];
  selectedStaff?: StaffMember[];
  onSendInvites: (emails: { practice?: string; dentists: string[] }[]) => void;
  onEditTemplate: () => void;
}

interface PersonEntry {
  name: string;
  email: string;
  practiceCode: string;
}

interface InviteItem {
  id: string;
  type: 'practice' | 'staff';
  name: string;
  managerName: string;
  practiceEmail: string;
  dentistEntries: PersonEntry[];
  otherStaffEntries: PersonEntry[];
}

interface SubModalState {
  open: boolean;
  kind: 'dentist' | 'staff';
  itemId: string;
  editIndex: number | null;
  initialData: Partial<StaffFormData>;
}

const EMPTY_INITIAL: Partial<StaffFormData> = {};

const DEFAULT_SUBJECT = 'Invitation to Join Our Platform';
const DEFAULT_BODY = `Hello {{name}},

We're excited to invite you to join our dental practice management platform.

Your practice code is: {{practiceCode}}

Click the link below to get started:
{{inviteLink}}

Best regards,
The Team`;

const inputCls = 'flex-1 px-3 py-2 text-xs border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]';
const labelCls = 'block text-[10px] font-semibold text-[#717182] uppercase tracking-wider mb-1';

const fieldWrap = 'flex items-center gap-1.5 px-3 py-2 text-xs border border-[#E0E0E6] rounded-lg focus-within:ring-2 focus-within:ring-[#4D8EF7]/20 focus-within:border-[#4D8EF7]';
const bareInput = 'flex-1 bg-transparent outline-none text-xs text-[#030213] placeholder-[#A0A0B0]';

export default function InviteModal({
  onClose,
  selectedPractices = [],
  selectedStaff = [],
  onSendInvites,
}: InviteModalProps) {
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [inviteData, setInviteData] = useState<InviteItem[]>(() => {
    const data: InviteItem[] = [];
    selectedPractices.forEach(practice => {
      data.push({
        id: practice.id,
        type: 'practice',
        name: practice.name,
        managerName: practice.managers[0]?.name || '',
        practiceEmail: practice.managers[0]?.email || '',
        dentistEntries: practice.dentists.map(d => ({ name: d.name, email: d.email || '', practiceCode: '' })),
        otherStaffEntries: (practice.staff ?? []).map(s => ({ name: (s as any).name || '', email: (s as any).email || '', practiceCode: '' })),
      });
    });
    selectedStaff.forEach(staff => {
      data.push({
        id: staff.id,
        type: 'staff',
        name: staff.name,
        managerName: staff.name,
        practiceEmail: staff.email || '',
        dentistEntries: [],
        otherStaffEntries: [],
      });
    });
    return data;
  });

  // Sub-modal state — uses AddStaffModal
  const [sub, setSub] = useState<SubModalState>({
    open: false, kind: 'dentist', itemId: '', editIndex: null, initialData: EMPTY_INITIAL,
  });

  const openSub = (kind: 'dentist' | 'staff', itemId: string, editIndex: number | null = null) => {
    const item = inviteData.find(i => i.id === itemId)!;
    let initialData: Partial<StaffFormData> = {
      practiceId: itemId,
      staffType: kind === 'dentist' ? 'Dentist' : 'Other',
    };
    if (editIndex !== null) {
      const entries = kind === 'dentist' ? item.dentistEntries : item.otherStaffEntries;
      const existing = entries[editIndex];
      initialData = {
        ...initialData,
        name: existing.name,
        email: existing.email,
      };
    }
    setSub({ open: true, kind, itemId, editIndex, initialData });
  };

  const closeSub = () => setSub(s => ({ ...s, open: false }));

  const handleStaffSubmit = (data: StaffFormData) => {
    const { kind, itemId, editIndex } = sub;
    const matchingPractice = selectedPractices.find(p => p.id === data.practiceId);
    const entry: PersonEntry = {
      name: data.name,
      email: data.email || '',
      practiceCode: matchingPractice?.practiceCode || '',
    };
    setInviteData(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const key = kind === 'dentist' ? 'dentistEntries' : 'otherStaffEntries';
      const entries = [...item[key]];
      if (editIndex !== null) {
        entries[editIndex] = entry;
      } else {
        entries.push(entry);
      }
      return { ...item, [key]: entries };
    }));
  };

  const removeEntry = (kind: 'dentist' | 'staff', itemId: string, index: number) => {
    const key = kind === 'dentist' ? 'dentistEntries' : 'otherStaffEntries';
    setInviteData(prev => prev.map(item =>
      item.id !== itemId ? item : { ...item, [key]: item[key].filter((_, i) => i !== index) }
    ));
  };

  const update = (id: string, patch: Partial<InviteItem>) =>
    setInviteData(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));

  const handleSend = () => {
    onSendInvites(inviteData.map(item => ({ practice: item.practiceEmail, dentists: item.dentistEntries.map(e => e.email) })));
    onClose();
  };

  // ── Toolbar helpers ──────────────────────────────────────────────────────
  function insertFormat(prefix: string, suffix = '') {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.slice(start, end);
    const replacement = prefix + (selected || 'text') + suffix;
    const next = body.slice(0, start) + replacement + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + prefix.length + (selected || 'text').length + suffix.length;
      ta.setSelectionRange(newPos, newPos);
    });
  }

  function insertBullet() {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = body.lastIndexOf('\n', start - 1) + 1;
    const next = body.slice(0, lineStart) + '• ' + body.slice(lineStart);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 2, start + 2); });
  }

  function insertNumbered() {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = body.lastIndexOf('\n', start - 1) + 1;
    const next = body.slice(0, lineStart) + '1. ' + body.slice(lineStart);
    setBody(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + 3, start + 3); });
  }

  function insertDivider() {
    const ta = bodyRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const ins = '\n\n---\n\n';
    setBody(body.slice(0, start) + ins + body.slice(start));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start + ins.length, start + ins.length); });
  }

  const toolbarBtn = 'p-1.5 rounded text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] transition-colors';

  const currentPractice = selectedPractices.find(p => p.id === sub.itemId);

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-[#F0EFF6]">
          <div>
            <h2 className="text-lg font-semibold text-[#030213]">Send Invitations</h2>
            <p className="text-xs text-[#717182] mt-0.5">
              {selectedPractices.length > 0 && `${selectedPractices.length} practice${selectedPractices.length !== 1 ? 's' : ''}`}
              {selectedPractices.length > 0 && selectedStaff.length > 0 && ', '}
              {selectedStaff.length > 0 && `${selectedStaff.length} staff member${selectedStaff.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-[#717182] hover:text-[#030213] hover:bg-[#F0EFF6] rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {inviteData.map(item => (
            <div key={item.id} className="border border-[#E0E0E6] rounded-xl p-4 space-y-4">
              {/* Entity header */}
              <div className="flex items-center gap-2">
                {item.type === 'practice'
                  ? <Building2 className="w-4 h-4 text-[#4D8EF7]" />
                  : <User className="w-4 h-4 text-[#4D8EF7]" />}
                <h3 className="font-semibold text-sm text-[#030213]">{item.name}</h3>
              </div>

              {/* Manager */}
              <div>
                <p className="text-xs font-semibold text-[#717182] mb-2">
                  {item.type === 'practice' ? 'Practice Manager' : 'Contact'} <span className="text-[#D4183D]">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Name <span className="text-[#D4183D]">*</span></label>
                    <div className={fieldWrap + ' bg-[#F8F9FC]'}>
                      <User className="w-3 h-3 text-[#A0A0B0] flex-shrink-0" />
                      <input type="text" value={item.managerName} onChange={e => update(item.id, { managerName: e.target.value })} required placeholder="Full name" className={bareInput} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Email <span className="text-[#D4183D]">*</span></label>
                    <div className={fieldWrap}>
                      <Mail className="w-3 h-3 text-[#A0A0B0] flex-shrink-0" />
                      <input type="email" value={item.practiceEmail} onChange={e => update(item.id, { practiceEmail: e.target.value })} required placeholder="email@practice.com" className={bareInput} />
                    </div>
                  </div>
                </div>
              </div>

              {item.type === 'practice' && (
                <>
                  {/* Dentists */}
                  <div>
                    <p className="text-xs font-semibold text-[#717182] mb-2">Dentists <span className="font-normal">(Optional)</span></p>
                    <div className="space-y-2">
                      {item.dentistEntries.map((entry, index) => (
                        <PersonChip
                          key={index}
                          entry={entry}
                          onEdit={() => openSub('dentist', item.id, index)}
                          onRemove={() => removeEntry('dentist', item.id, index)}
                        />
                      ))}
                      <button onClick={() => openSub('dentist', item.id)} className="text-xs text-[#4D8EF7] hover:text-[#3D7DE7] font-medium">
                        + Add Dentist
                      </button>
                    </div>
                  </div>

                  {/* Other staff */}
                  <div>
                    <p className="text-xs font-semibold text-[#717182] mb-2">Other Staff <span className="font-normal">(Optional)</span></p>
                    <div className="space-y-2">
                      {item.otherStaffEntries.map((entry, index) => (
                        <PersonChip
                          key={index}
                          entry={entry}
                          onEdit={() => openSub('staff', item.id, index)}
                          onRemove={() => removeEntry('staff', item.id, index)}
                        />
                      ))}
                      <button onClick={() => openSub('staff', item.id)} className="text-xs text-[#4D8EF7] hover:text-[#3D7DE7] font-medium">
                        + Add Staff Member
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Template editor */}
          {showTemplateEditor && (
            <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-[#F8F9FC] border-b border-[#E0E0E6]">
                <h3 className="text-sm font-semibold text-[#030213]">Email Template</h3>
                <button onClick={() => { setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY); }} className="text-xs text-[#717182] hover:text-[#030213] flex items-center gap-1 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Reset to Default
                </button>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div>
                  <label className="block text-xs font-medium text-[#030213] mb-1.5">Subject Line</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7]" placeholder="Email subject" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#030213] mb-1.5">Message Body</label>
                  <div className="flex items-center gap-0.5 px-2 py-1.5 border border-[#E0E0E6] border-b-0 rounded-t-lg bg-[#F8F9FC]">
                    <button type="button" title="Bold" onClick={() => insertFormat('**', '**')} className={toolbarBtn}><Bold className="w-3.5 h-3.5" /></button>
                    <button type="button" title="Italic" onClick={() => insertFormat('_', '_')} className={toolbarBtn}><Italic className="w-3.5 h-3.5" /></button>
                    <span className="w-px h-4 bg-[#E0E0E6] mx-1" />
                    <button type="button" title="Bullet list" onClick={insertBullet} className={toolbarBtn}><List className="w-3.5 h-3.5" /></button>
                    <button type="button" title="Numbered list" onClick={insertNumbered} className={toolbarBtn}><ListOrdered className="w-3.5 h-3.5" /></button>
                    <span className="w-px h-4 bg-[#E0E0E6] mx-1" />
                    <button type="button" title="Paragraph break" onClick={() => insertFormat('\n\n', '')} className={toolbarBtn}><AlignLeft className="w-3.5 h-3.5" /></button>
                    <button type="button" title="Horizontal divider" onClick={insertDivider} className={toolbarBtn}><Minus className="w-3.5 h-3.5" /></button>
                    <span className="ml-auto text-[10px] text-[#A0A0B0] pr-1">Variables: {'{{name}}'} {'{{practiceCode}}'} {'{{inviteLink}}'}</span>
                  </div>
                  <textarea ref={bodyRef} value={body} onChange={e => setBody(e.target.value)} rows={9} className="w-full px-3 py-2 text-sm border border-[#E0E0E6] rounded-b-lg focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/20 focus:border-[#4D8EF7] resize-none" placeholder="Email body" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="px-7 py-4 border-t border-[#F0EFF6] flex items-center justify-between bg-white flex-shrink-0">
          <button onClick={() => setShowTemplateEditor(v => !v)} className="flex items-center gap-1.5 text-sm font-medium text-[#4D8EF7] hover:text-[#3578e5] transition-colors">
            {showTemplateEditor ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showTemplateEditor ? 'Hide template' : 'Edit template'}
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium border border-[#E0E0E6] rounded-lg text-[#5A5568] hover:bg-[#F8F9FC] transition-colors">Cancel</button>
            <button onClick={handleSend} className="px-6 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Send {inviteData.length > 1 ? 'Invitations' : 'Invitation'}
            </button>
          </div>
        </div>
      </div>

      {/* Reuses existing AddStaffModal — pre-filled with practice + staff type */}
      {currentPractice && (
        <AddStaffModal
          isOpen={sub.open}
          onClose={closeSub}
          practices={[currentPractice]}
          defaultPracticeId={sub.itemId}
          onSubmit={handleStaffSubmit}
          mode={sub.editIndex !== null ? 'edit' : 'add'}
          initialData={sub.initialData}
          hideDraft
          lockPractice
          lockStaffType={sub.kind === 'dentist'}
        />
      )}
    </div>
    </ModalPortal>
  );
}

// ── Person chip (read-only row with edit + remove) ─────────────────────────
function PersonChip({ entry, onEdit, onRemove }: { entry: PersonEntry; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E0E0E6] bg-[#F8F9FC] group">
      <div className="w-6 h-6 rounded-full bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
        <User className="w-3 h-3 text-[#4D8EF7]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-[#030213] truncate">{entry.name || '—'}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-[#717182] truncate">{entry.email || '—'}</span>
          {entry.practiceCode && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#E8F0FE] text-[#4D8EF7] text-[10px] font-semibold flex-shrink-0">
              <Hash className="w-2.5 h-2.5" />{entry.practiceCode}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          title="Edit"
          className="p-1.5 rounded-lg text-[#717182] hover:text-[#4D8EF7] hover:bg-[#EEF4FF] transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="p-1.5 rounded-lg text-[#717182] hover:text-[#D4183D] hover:bg-[#FEE2E2] transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
