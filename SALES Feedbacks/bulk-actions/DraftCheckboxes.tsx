import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearDraftSelection, getDraftSelection, toggleDraft, useDraftSelection } from './draftSelection';

// ── Checkboxes on draft rows ─────────────────────────────────────────────────
// Draft rows in the Cases table leave their checkbox cell empty (the list's
// own bulk selection excludes drafts). The sandbox puts a checkbox there, in
// the same style, and keeps drafts and cases from being ticked together.
// Relies on the table's markup: the first cell of each row, the "Draft" chip
// and the case ID as a cell's text.

const CASE_ID = /^(SG|CASE|SF)-[A-Z0-9-]+$/i;

interface Slot { id: string; cell: HTMLElement }

function findDraftRows(): Slot[] {
  const out: Slot[] = [];
  for (const row of document.querySelectorAll<HTMLTableRowElement>('main tbody tr')) {
    const first = row.firstElementChild as HTMLElement | null;
    if (!first || first.querySelector('input[type="checkbox"]:not(.sf-draft-box)')) continue;
    // The status chip is an icon + "Draft".
    const all = [...row.querySelectorAll<HTMLElement>('*')];
    if (!all.some(e => e.textContent?.trim() === 'Draft' && e.children.length <= 1)) continue;
    const idCell = all.find(e => e.children.length === 0 && CASE_ID.test(e.textContent?.trim() ?? ''));
    if (idCell) out.push({ id: idCell.textContent!.trim(), cell: first });
  }
  return out;
}

/** The list's own ticked rows (not drafts). */
const nativeTicked = () => [...document.querySelectorAll<HTMLInputElement>('main tbody input[type="checkbox"]:not(.sf-draft-box)')].filter(b => b.checked);

export function clearNativeSelection() {
  const btn = [...document.querySelectorAll<HTMLElement>('main button')].find(b => b.textContent?.trim() === 'Clear selection');
  btn?.click();
}

export default function DraftCheckboxes() {
  const selected = useDraftSelection();
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    const sync = () => {
      const next = findDraftRows();
      setSlots(prev => (prev.length === next.length && prev.every((p, i) => p.id === next[i].id && p.cell === next[i].cell) ? prev : next));
      // Cases got ticked while drafts were ticked: drafts give way.
      if (getDraftSelection().length && nativeTicked().length) clearDraftSelection();
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['checked'] });
    document.addEventListener('change', sync, true);
    sync();
    return () => { mo.disconnect(); document.removeEventListener('change', sync, true); };
  }, []);

  return (
    <>
      {slots.map(s => createPortal(
        <input
          key={s.id}
          type="checkbox"
          className="sf-draft-box w-4 h-4 rounded border-[#D4CEE1] accent-[#4D8EF7] cursor-pointer"
          title="Select draft"
          checked={selected.includes(s.id)}
          onClick={e => e.stopPropagation()}
          onChange={() => { if (!selected.includes(s.id) && nativeTicked().length) clearNativeSelection(); toggleDraft(s.id); }}
        />,
        s.cell,
        s.id,
      ))}
    </>
  );
}
