// ─── New Case Flow · page context ────────────────────────────────────────────
// What every step, drawer and rail card reads from the case page: the draft,
// the derived rules context, navigation and the actions that change the case.

import { createContext, useContext } from 'react';
import type { Lab, LabId, Patient, ProductId, User, Funding } from './data';
import type { CaseDates, CaseDraft, Ctx, NoteDef, ServiceItem, StepNode } from './rules';

export type DrawerState =
  | { kind: 'moreServices' }
  | { kind: 'materials'; itemId: string }
  | { kind: 'shades'; itemId: string; field: 'shade' | 'incisal' | 'cervical' | 'stump'; tab?: 'classical' | '3d' | 'bleach' }
  | { kind: 'photos'; itemId: string }
  | { kind: 'prefs'; itemId: string }
  | { kind: 'fit' }
  | { kind: 'scan' };

export interface CaseApi {
  draft: CaseDraft;
  update: (fn: (d: CaseDraft) => CaseDraft) => void;
  updateItem: (id: string, patch: Partial<ServiceItem> | ((i: ServiceItem) => ServiceItem)) => void;
  ctx: Ctx;
  user: User;
  patient: Patient;
  lab: Lab;
  prescriber?: User;
  prescriberSrc?: string;
  steps: StepNode[];
  step: string;
  go: (id: string) => void;
  /** Teeth "Done" and similar: always move on to the next gap. */
  doneAndAdvance: (fn: () => void) => void;
  dates: CaseDates;
  notes: NoteDef[];
  dismissNote: (id: string) => void;
  gaps: number;
  readOnly: boolean;
  openDrawer: (d: DrawerState) => void;
  addService: (product: ProductId, extra?: Partial<ServiceItem>) => void;
  removeItem: (id: string) => void;
  changeLab: (id: LabId) => void;
  setFunding: (f: Funding) => void;
  /** Opens the patient picker in place on the Patient step (never a popup). */
  openLauncher: () => void;
  pickingPatient: boolean;
  closePatientPicker: () => void;
  changePatient: (patientId: string) => void;
  switchToImplant: (itemId: string) => void;
  sendSeparately: (on: boolean) => void;
  toast: { success: (m: string) => void; info: (m: string) => void; warning: (m: string) => void; error: (m: string) => void };
}

export const CaseContext = createContext<CaseApi | null>(null);
export function useCase(): CaseApi {
  const c = useContext(CaseContext);
  if (!c) throw new Error('useCase outside the case page');
  return c;
}
