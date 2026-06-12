import { useState } from 'react';
import { ArrowLeft, Globe, Phone, Mail, MapPin, Tag, FileText, Check, ChevronDown, Calendar, User, MoreVertical, Pencil, AlertTriangle, X, Save } from 'lucide-react';
import { GlobalSupplier, PendingSupplierSubmission } from '../../data/globalSuppliersData';
import { COUNTRIES } from '../../components/CountrySelect';

export type GlobalSupplierStatus = 'Approved' | 'Pending' | 'Rejected' | 'Draft' | 'Archived';
const GLOBAL_STATUSES: GlobalSupplierStatus[] = ['Approved', 'Pending', 'Rejected', 'Draft', 'Archived'];

function globalStatusStyle(s: GlobalSupplierStatus) {
  switch (s) {
    case 'Approved': return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Pending':  return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'Rejected': return 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]';
    case 'Draft':    return 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]';
    case 'Archived': return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

type StatusBadgeStatus = PendingSupplierSubmission['status'];

function statusStyle(s: StatusBadgeStatus) {
  switch (s) {
    case 'Pending':  return 'text-[#E65100] bg-[#FFF3E0] border-[#FFCC80]';
    case 'Approved': return 'text-[#2E7D32] bg-[#E8F5E9] border-[#A5D6A7]';
    case 'Rejected': return 'text-[#C62828] bg-[#FFEBEE] border-[#EF9A9A]';
    case 'Draft':    return 'text-[#1565C0] bg-[#E3F2FD] border-[#90CAF9]';
    case 'Archived': return 'text-[#616161] bg-[#F5F5F5] border-[#BDBDBD]';
  }
}

const ALL_SUBMISSION_STATUSES: StatusBadgeStatus[] = ['Pending', 'Approved', 'Rejected', 'Draft', 'Archived'];

function InfoTile({ label, value, href }: { label: string; value: string; href?: string }) {
  if (!value) return null;
  return (
    <div className="bg-[#F8F9FC] rounded-xl p-4">
      <p className="text-[10px] text-[#A0A0B0] uppercase tracking-wide font-semibold mb-1">{label}</p>
      {href ? (
        <a href={href.startsWith('http') ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
          className="text-sm text-[#4D8EF7] hover:underline break-all">{value}</a>
      ) : (
        <p className="text-sm font-medium text-[#030213] break-words">{value}</p>
      )}
    </div>
  );
}

// ── Global Supplier Detail ────────────────────────────────────────────────────
interface GlobalEditableFields {
  name: string;
  taxId: string;
  country: string;
  categories: string;
}

interface GlobalDetailProps {
  supplier: GlobalSupplier;
  currentStatus: GlobalSupplierStatus;
  onBack: () => void;
  onStatusChange: (id: string, status: GlobalSupplierStatus) => void;
  onSave?: (id: string, updates: Partial<GlobalSupplier>) => void;
}

export function AdminGlobalSupplierDetail({ supplier, currentStatus, onBack, onStatusChange, onSave }: GlobalDetailProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [draft, setDraft] = useState<GlobalEditableFields>({
    name:       supplier.name,
    taxId:      supplier.taxId ?? '',
    country:    supplier.country,
    categories: supplier.categories.join(', '),
  });

  const countryName = COUNTRIES.find(c => c.code === supplier.country)?.name ?? supplier.country;

  function handleSave() {
    const cats = draft.categories.split(',').map(s => s.trim()).filter(Boolean);
    onSave?.(supplier.id, {
      name:       draft.name,
      taxId:      draft.taxId || undefined,
      country:    draft.country,
      categories: cats,
    });
    setEditOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Overlays */}
      {statusOpen && <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />}
      {menuOpen   && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}

      {/* Edit panel */}
      {editOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setEditOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E0E6]">
              <h3 className="font-semibold text-[#030213]">Edit Supplier</h3>
              <button onClick={() => setEditOpen(false)} className="p-1.5 hover:bg-[#F3F3F5] rounded-lg transition-colors">
                <X className="w-4 h-4 text-[#717182]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {[
                { label: 'Supplier Name', key: 'name' as const, placeholder: 'e.g. 3Shape' },
                { label: 'Tax ID / VAT',  key: 'taxId' as const, placeholder: 'e.g. DK-38763941' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-[#717182] mb-1.5">{label}</label>
                  <input
                    className="w-full border border-[#E0E0E6] rounded-lg px-3 py-2.5 text-sm text-[#030213] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                    value={draft[key]}
                    placeholder={placeholder}
                    onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-[#717182] mb-1.5">Country</label>
                <select
                  className="w-full border border-[#E0E0E6] rounded-lg px-3 py-2.5 text-sm text-[#030213] bg-white focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                  value={draft.country}
                  onChange={e => setDraft(prev => ({ ...prev, country: e.target.value }))}
                >
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#717182] mb-1.5">Categories <span className="text-[#A0A0B0] font-normal">(comma-separated)</span></label>
                <input
                  className="w-full border border-[#E0E0E6] rounded-lg px-3 py-2.5 text-sm text-[#030213] focus:outline-none focus:ring-2 focus:ring-[#4D8EF7]/30 focus:border-[#4D8EF7]"
                  value={draft.categories}
                  placeholder="e.g. Clinical, Equipment"
                  onChange={e => setDraft(prev => ({ ...prev, categories: e.target.value }))}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-[#E0E0E6] flex items-center gap-3">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#4D8EF7] to-[#A59DFF] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <Save className="w-4 h-4" />Save Changes
              </button>
              <button
                onClick={() => setEditOpen(false)}
                className="px-4 py-2.5 border border-[#E0E0E6] text-[#717182] text-sm font-medium rounded-lg hover:bg-[#F8F9FC] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Header bar */}
      <div className="bg-white border-b border-[#E0E0E6]">
        <div className="px-6 py-4">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213] transition-colors">
                <ArrowLeft className="w-4 h-4" />Global Registry
              </button>
              <span className="text-[#D4CEE1]">/</span>
              <span className="text-sm font-medium text-[#030213]">{supplier.name}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Status dropdown */}
              <div className="relative z-50">
                <button
                  onClick={() => setStatusOpen(v => !v)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 hover:opacity-80 transition-opacity ${globalStatusStyle(currentStatus)}`}
                >
                  {currentStatus}
                  <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
                </button>
                {statusOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1 min-w-[160px] z-50">
                    {GLOBAL_STATUSES.map(st => (
                      <button
                        key={st}
                        onClick={() => { onStatusChange(supplier.id, st); setStatusOpen(false); }}
                        className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-3"
                      >
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${globalStatusStyle(st)}`}>{st}</span>
                        {currentStatus === st && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3-dot menu */}
              <div className="relative z-50">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="p-1.5 rounded-lg hover:bg-[#F3F3F5] transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-[#717182]" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1 min-w-[140px] z-50">
                    <button
                      onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] transition-colors flex items-center gap-2 text-sm text-[#030213]"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#717182]" />Edit Supplier
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${supplier.avatarColor}`}>
              {supplier.initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#030213] mb-1">{supplier.name}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1 text-sm text-[#717182]">
                  <MapPin className="w-3.5 h-3.5" />{countryName}
                </span>
                <span className="text-xs text-[#A0A0B0] bg-[#F0EFF6] px-2 py-0.5 rounded">{supplier.vendorId}</span>
              </div>
            </div>
          </div>

          {/* Pending quick actions */}
          {currentStatus === 'Pending' && (
            <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[#F0EFF6]">
              <button
                onClick={() => onStatusChange(supplier.id, 'Approved')}
                className="flex items-center gap-2 px-4 py-2 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-lg text-sm font-medium hover:bg-[#C8E6C9] transition-colors"
              >
                <Check className="w-4 h-4" />Approve
              </button>
              <button
                onClick={() => onStatusChange(supplier.id, 'Rejected')}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A] rounded-lg text-sm font-medium hover:bg-[#FFCDD2] transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Visibility warning */}
      {currentStatus !== 'Approved' && (
        <div className="mx-6 mt-5 p-4 bg-[#FFF3E0] border border-[#FFCC80] rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-[#E65100] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#E65100] mb-0.5">Not visible in global registry</p>
            <p className="text-xs text-[#BF360C] leading-relaxed">
              This supplier won't appear when dental groups search for suppliers to add to their account. Set the status back to <strong>Approved</strong> to restore visibility.
            </p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-6 py-6 space-y-5">
        {/* Categories */}
        <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
          <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-[#EDE7F6] flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-[#6A1B9A]" />
            </span>
            Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {supplier.categories.map(c => (
              <span key={c} className="px-3 py-1.5 bg-[#F0EFF6] text-[#5A5568] rounded-lg text-xs font-medium">{c}</span>
            ))}
          </div>
        </div>

        {/* Registry Details */}
        <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
          <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-[#E8F0FE] flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-[#4D8EF7]" />
            </span>
            Registry Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoTile label="Tax ID / VAT" value={supplier.taxId ?? '—'} />
            <InfoTile label="Country"      value={countryName} />
            <InfoTile label="Categories"   value={supplier.categories.join(', ')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Submission Detail ─────────────────────────────────────────────────────────
interface SubmissionDetailProps {
  submission: PendingSupplierSubmission;
  onBack: () => void;
  onStatusChange: (id: string, status: StatusBadgeStatus) => void;
}

export function AdminSubmissionDetail({ submission, onBack, onStatusChange }: SubmissionDetailProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const initials = submission.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      {statusOpen && <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />}

      {/* Header bar */}
      <div className="bg-white border-b border-[#E0E0E6]">
        <div className="px-6 py-4">
          {/* Breadcrumb + actions */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#030213] transition-colors">
                <ArrowLeft className="w-4 h-4" />Supplier Submissions
              </button>
              <span className="text-[#D4CEE1]">/</span>
              <span className="text-sm font-medium text-[#030213]">{submission.name}</span>
            </div>

            {/* Status dropdown */}
            <div className="relative z-50">
              <button
                onClick={() => setStatusOpen(v => !v)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-1.5 hover:opacity-80 transition-opacity ${statusStyle(submission.status)}`}
              >
                {submission.status}
                <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E0E0E6] shadow-xl py-1 min-w-[160px] z-50">
                  {ALL_SUBMISSION_STATUSES.map(st => (
                    <button
                      key={st}
                      onClick={() => { onStatusChange(submission.id, st); setStatusOpen(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-[#F8F9FC] transition-colors flex items-center justify-between gap-3"
                    >
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusStyle(st)}`}>{st}</span>
                      {submission.status === st && <Check className="w-3.5 h-3.5 text-[#4D8EF7]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-[#F0EFF6] text-[#5A5568] flex items-center justify-center text-lg font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#030213] mb-1">{submission.name}</h1>
              <div className="flex items-center gap-3 flex-wrap text-sm text-[#717182]">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{submission.submittedBy}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{submission.submittedAt}</span>
              </div>
            </div>
          </div>

          {/* Quick approve/reject for Pending */}
          {submission.status === 'Pending' && (
            <div className="flex items-center gap-3 pt-4 border-t border-[#F0EFF6]">
              <button
                onClick={() => onStatusChange(submission.id, 'Approved')}
                className="flex items-center gap-2 px-4 py-2 bg-[#E8F5E9] text-[#2E7D32] border border-[#A5D6A7] rounded-lg text-sm font-medium hover:bg-[#C8E6C9] transition-colors"
              >
                <Check className="w-4 h-4" />Approve
              </button>
              <button
                onClick={() => onStatusChange(submission.id, 'Rejected')}
                className="flex items-center gap-2 px-4 py-2 bg-[#FFEBEE] text-[#C62828] border border-[#EF9A9A] rounded-lg text-sm font-medium hover:bg-[#FFCDD2] transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 space-y-5">
        {/* Contact Details */}
        <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
          <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-[#E3F2FD] flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-[#4D8EF7]" />
            </span>
            Contact Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InfoTile label="Email"   value={submission.email}   href={`mailto:${submission.email}`} />
            <InfoTile label="Phone"   value={submission.phone} />
            <InfoTile label="Website" value={submission.website} href={submission.website} />
          </div>
          {!submission.email && !submission.phone && !submission.website && (
            <p className="text-sm text-[#A0A0B0] py-4 text-center">No contact details on record.</p>
          )}
        </div>

        {/* Submission Info */}
        <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
          <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-lg bg-[#EDE7F6] flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-[#6A1B9A]" />
            </span>
            Submission Info
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoTile label="Category"     value={submission.category} />
            <InfoTile label="Submitted By" value={submission.submittedBy} />
            <InfoTile label="Submitted At" value={submission.submittedAt} />
          </div>
        </div>

        {/* Notes */}
        {submission.notes && (
          <div className="bg-white rounded-2xl border border-[#E0E0E6] p-6">
            <h2 className="text-sm font-semibold text-[#030213] flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-lg bg-[#FFF3E0] flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-[#E65100]" />
              </span>
              Notes
            </h2>
            <p className="text-sm text-[#5A5568] leading-relaxed">{submission.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
