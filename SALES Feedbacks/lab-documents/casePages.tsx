import type { ReactElement } from 'react';
import type { Case } from '../../src/app/pages/CasesPage';
import { SgOrderFormPrint } from '../bulk-actions/printForms';
import { getDocs, type DocsSettings } from './docsStore';

// ── What prints for one case ─────────────────────────────────────────────────
// One sheet: the order form, with the short statement at the bottom when it's
// switched on. The technician can leave the statement off for one print
// without touching settings. Used by the print preview, the case tab and
// Bulk Actions → Print.

export function casePrintPages(c: Case, opts: { withStatement?: boolean } = {}, docs?: DocsSettings): { key: string; node: ReactElement }[] {
  return [{ key: `${c.id}-sg`, node: <SgOrderFormPrint c={c} docs={docs ?? getDocs()} statement={opts.withStatement !== false} /> }];
}
