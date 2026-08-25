import { ArrowUpRight, Copy, GitBranch, Link2Off } from 'lucide-react';
import { mockCases, upgradeDemoCase } from '../pages/CasesPage';
import type { Case } from '../pages/CasesPage';
import { useCreatedCases } from '../data/createdCases';
import {
  linkFor,
  originalIdOf,
  rescanIdsOf,
  unlinkRescan,
  useRescanLinks,
} from '../data/rescanDetection';

// ─── Related Cases ───────────────────────────────────────────────────────────
// The relationship section both sides of a rescan pair carry: an original
// lists every rescan submitted against it, a rescan names the original it
// belongs to. Rendered on Case Details so a user can move between linked
// cases without going back to the list.

/** Every case the prototype knows about — mock data plus anything created. */
export function useAllCases(): Case[] {
  const created = useCreatedCases();
  return [...created, upgradeDemoCase, ...mockCases];
}

function RelatedRow({ record, id, kind, onOpenCase, onUnlink }: {
  record?: Case;
  id: string;
  kind: 'original' | 'rescan';
  onOpenCase?: (caseId: string) => void;
  onUnlink?: () => void;
}) {
  const tone = kind === 'original'
    ? { bg: '#EEF4FF', border: '#BFDBFE', text: '#1565C0', label: 'Original Case' }
    : { bg: '#F3EEFF', border: '#DDD6FE', text: '#7C3AED', label: 'Rescan' };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-[#F0EFF6] first:border-t-0">
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0"
        style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
      >
        {tone.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-[#030213]">{id}</p>
        <p className="text-[11px] text-[#717182] truncate">
          {record
            ? `${record.patientName} · ${record.services.join(', ') || '—'} · created ${record.createdAt}`
            : 'Case record not available in this view'}
        </p>
      </div>
      {onUnlink && (
        <button
          onClick={onUnlink}
          title="Remove this rescan relationship"
          className="p-1.5 rounded-lg text-[#A0A0B0] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors flex-shrink-0"
        >
          <Link2Off className="w-3.5 h-3.5" />
        </button>
      )}
      {record && onOpenCase && (
        <button
          onClick={() => onOpenCase(id)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#4D8EF7] hover:bg-[#F5F8FF] transition-colors flex-shrink-0"
        >
          Open <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export default function RelatedCasesCard({ caseId, onOpenCase }: {
  caseId: string;
  onOpenCase?: (id: string) => void;
}) {
  const links = useRescanLinks();
  const all = useAllCases();
  const originalId = originalIdOf(caseId, links);
  const rescanIds = rescanIdsOf(caseId, links);

  // Nothing linked either way — the section stays out of the way entirely.
  if (!originalId && rescanIds.length === 0) return null;

  const find = (id: string) => all.find(c => c.id === id);
  const link = originalId ? linkFor(caseId, links) : undefined;

  return (
    <div className="bg-white border border-[#E0E0E6] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#F8F9FC] border-b border-[#F0EFF6]">
        <GitBranch className="w-3.5 h-3.5 text-[#7C3AED]" />
        {/* A case can be both — a rescan that was itself re-scanned — so the
            heading only says "Related To" when the original is all there is. */}
        <h3 className="text-xs font-bold text-[#030213]">
          {originalId && rescanIds.length === 0 ? 'Related To' : 'Related Cases'}
        </h3>
        <span className="text-[10px] text-[#A0A0B0]">
          {[
            originalId ? `Created as a rescan${link ? ` · linked ${link.linkedAt} by ${link.linkedBy}` : ''}` : '',
            rescanIds.length ? `${rescanIds.length} rescan${rescanIds.length === 1 ? '' : 's'} linked to this case` : '',
          ].filter(Boolean).join(' · ')}
        </span>
      </div>

      <div>
        {originalId && (
          <RelatedRow
            id={originalId}
            record={find(originalId)}
            kind="original"
            onOpenCase={onOpenCase}
            onUnlink={() => unlinkRescan(caseId)}
          />
        )}
        {rescanIds.map(id => (
          <RelatedRow
            key={id}
            id={id}
            record={find(id)}
            kind="rescan"
            onOpenCase={onOpenCase}
            onUnlink={() => unlinkRescan(id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Small pill for the Case Details header — "Original Case" / "Rescan". */
export function RelationshipPill({ caseId }: { caseId: string }) {
  const links = useRescanLinks();
  const originalId = originalIdOf(caseId, links);
  const rescans = rescanIdsOf(caseId, links);
  if (!originalId && rescans.length === 0) return null;

  // Both pills show when a case is a rescan that was itself re-scanned.
  return (
    <>
      {originalId && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3EEFF] text-[#7C3AED] border border-[#DDD6FE]"
          title={`Rescan of ${originalId}`}
        >
          <Copy className="w-3 h-3" />
          Rescan of {originalId}
        </span>
      )}
      {rescans.length > 0 && (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EEF4FF] text-[#1565C0] border border-[#BFDBFE]"
          title={`${rescans.length} rescan${rescans.length === 1 ? '' : 's'} linked to this case`}
        >
          <GitBranch className="w-3 h-3" />
          Original Case · {rescans.length} rescan{rescans.length === 1 ? '' : 's'}
        </span>
      )}
    </>
  );
}
