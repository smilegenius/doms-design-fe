// ── Reading the Cases list's own selection ───────────────────────────────────
// CasesPage keeps its bulk selection internal, so Bulk Actions reads it from
// the page: the case IDs of ticked rows in the table view. Relies on the
// table's markup (a checkbox per row, the case ID as a cell's text).

const CASE_ID = /^(SG|CASE|SF)-[A-Z0-9-]+$/i;

export function selectedCaseIds(): string[] {
  const ids: string[] = [];
  for (const row of document.querySelectorAll<HTMLTableRowElement>('main tbody tr')) {
    const box = row.querySelector<HTMLInputElement>('input[type="checkbox"]:not(.sf-draft-box)');
    if (!box?.checked) continue;
    const cell = [...row.querySelectorAll<HTMLElement>('*')].find(e => e.children.length === 0 && CASE_ID.test(e.textContent?.trim() ?? ''));
    if (cell) ids.push(cell.textContent!.trim());
  }
  return [...new Set(ids)];
}
