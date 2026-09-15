import { useMemo, useState } from 'react';
import { Search, XCircle, CheckCircle2, Ban } from 'lucide-react';
import Modal from '../Modal';
import type { CaseLike, EntityMapping } from '../../data/carestack';
import { locationForPractice, retryEntityLookup, searchCsPatients, searchCsProviders } from '../../data/carestack';
import { CS_CURRENT_USER, inputCls, primaryBtn, ghostBtn } from './shared';

// "Correct details" — the practice user picks the right CareStack record for
// a patient / dentist that failed exact matching, then the lookup re-runs.
// V1 rule: never create a patient from a lab case (no silent duplicates).
export default function CorrectDetailsModal({
  caseData, entity, mapping, onClose, currentUser = CS_CURRENT_USER,
}: {
  caseData: CaseLike;
  entity: 'patient' | 'dentist';
  mapping: EntityMapping;
  onClose: () => void;
  currentUser?: string;
}) {
  const current = entity === 'patient' ? caseData.patientName : caseData.dentist;
  const loc = locationForPractice(caseData.practice);
  const [query, setQuery] = useState(current);
  const [picked, setPicked] = useState<{ csId: string; csLabel: string } | null>(null);

  const patients = useMemo(() => (entity === 'patient' ? searchCsPatients(query, loc?.id) : []), [entity, query, loc?.id]);
  const providers = useMemo(() => (entity === 'dentist' ? searchCsProviders(query, loc?.id) : []), [entity, query, loc?.id]);

  const retry = () => {
    if (!picked) return;
    retryEntityLookup(caseData, entity, picked, currentUser);
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={entity === 'patient' ? 'Correct patient details' : 'Correct dentist details'}
      size="lg"
      footer={
        <>
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button onClick={retry} disabled={!picked} className={primaryBtn}>Retry lookup</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-lg bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center flex-shrink-0 mt-0.5">
            <XCircle className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#B91C1C]">
              {entity === 'patient' ? 'Patient' : 'Dentist'} not found in CareStack
              <span className="font-medium text-[#DC2626]"> · Smile Genius has “{current}”</span>
            </p>
            {mapping.reason && <p className="text-[11px] text-[#B91C1C]/90 leading-relaxed mt-0.5">{mapping.reason}</p>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider mb-1">
            Search CareStack {entity === 'patient' ? 'patients' : 'providers'}{loc ? ` · ${loc.name}` : ''}
          </p>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#A0A0B0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); setPicked(null); }}
              placeholder={entity === 'patient' ? 'Patient name or CareStack ID…' : 'Provider name or CareStack ID…'}
              className={`${inputCls} pl-8`}
            />
          </div>
          <p className="text-[10px] text-[#A0A0B0] mt-1">Exact, one-to-one matching only — pick the record that is this {entity}.</p>
        </div>

        <div className="border border-[#E0E0E6] rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-4 py-2 bg-[#F8F9FC] border-b border-[#F0EFF6]">
            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{entity === 'patient' ? 'Patient' : 'Provider'}</p>
            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">{entity === 'patient' ? 'DOB' : 'Status'}</p>
            <p className="text-[10px] font-semibold text-[#A0A0B0] uppercase tracking-wider">CareStack ID</p>
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-[#F0EFF6]">
            {entity === 'patient' && patients.map(p => {
              const label = `${p.firstName} ${p.lastName} · DOB ${p.dob}`;
              const active = picked?.csId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPicked({ csId: p.id, csLabel: label })}
                  className={`w-full grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-2.5 text-left transition-colors ${active ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {active ? <CheckCircle2 className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" /> : <span className="w-4 h-4 rounded-full border border-[#D4CEE1] flex-shrink-0" />}
                    <span className="text-xs font-semibold text-[#030213] truncate">{p.firstName} {p.lastName}</span>
                  </span>
                  <span className="text-[11px] text-[#5A5568] tabular-nums">{p.dob}</span>
                  <span className="text-[11px] font-mono text-[#717182]">{p.id}</span>
                </button>
              );
            })}
            {entity === 'dentist' && providers.map(p => {
              const active = picked?.csId === p.id;
              const disabled = !p.active;
              return (
                <button
                  key={p.id}
                  disabled={disabled}
                  onClick={() => setPicked({ csId: p.id, csLabel: `${p.name} · Active` })}
                  title={disabled ? 'Inactive — cannot be selected' : undefined}
                  className={`w-full grid grid-cols-[1fr_auto_auto] gap-x-4 items-center px-4 py-2.5 text-left transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed' : active ? 'bg-[#EEF4FF]' : 'hover:bg-[#F8F9FC]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {disabled
                      ? <Ban className="w-4 h-4 text-[#A0A0B0] flex-shrink-0" />
                      : active ? <CheckCircle2 className="w-4 h-4 text-[#4D8EF7] flex-shrink-0" /> : <span className="w-4 h-4 rounded-full border border-[#D4CEE1] flex-shrink-0" />}
                    <span className="text-xs font-semibold text-[#030213] truncate">{p.name}</span>
                    <span className="text-[10px] text-[#A0A0B0] truncate">{p.locationId === '*' ? 'All locations' : loc?.name ?? p.locationId}</span>
                  </span>
                  <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${p.active ? 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]' : 'bg-[#F3F3F5] text-[#717182] border-[#E0E0E6]'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-[11px] font-mono text-[#717182]">{p.id}</span>
                </button>
              );
            })}
            {((entity === 'patient' && patients.length === 0) || (entity === 'dentist' && providers.length === 0)) && (
              <p className="text-xs text-[#A0A0B0] italic text-center py-8">No CareStack records match “{query}”.</p>
            )}
          </div>
        </div>

        <p className="text-[10px] text-[#A0A0B0] leading-relaxed">
          {entity === 'patient'
            ? 'Smile Genius never creates patients in CareStack from lab cases. If the patient does not exist yet, add them in CareStack first and retry.'
            : 'Only active providers mapped to a Smile Genius dentist can be selected. Provider mapping is managed by your DSO admin.'}
        </p>
      </div>
    </Modal>
  );
}
