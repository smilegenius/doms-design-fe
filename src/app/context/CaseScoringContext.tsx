import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import {
  DEFAULT_SCORING_CONFIG, ScoringConfig, ScoreField, CaseScore,
  computeCaseScore, SCORE_FIELD_DEF_MAP,
  DEFAULT_THRESHOLDS, ScoreThreshold, ScoreTierId,
} from '../data/caseScoring';
import {
  DEFAULT_PRESCRIPTION_CONFIG, PrescriptionConfig, isServiceScoringStale, staleScoringFields,
} from '../data/prescriptionBuilder';
import type { Case } from '../pages/CasesPage';

// Holds the lab-configured scoring rules. Provided once at the app root so
// every portal (lab edits it, clinic + dental group read it) shares one source
// of truth — the score a clinic sees is exactly the one the lab set up.
interface CaseScoringContextType {
  config: ScoringConfig;
  /** The lab-configured score tiers (Incomplete / Need Attention / Complete). */
  thresholds: ScoreThreshold[];
  /** The Prescription Builder config — the source of fields for scoring. */
  prescription: PrescriptionConfig;
  /** Enable/disable a prescription field. Returns the scoring field ids that
      become stale as a result (so the caller can warn the lab). */
  setPrescriptionEnabled: (service: string, fieldId: string, enabled: boolean) => void;
  /** Toggle a prescription field required/optional. */
  setPrescriptionRequired: (service: string, fieldId: string, required: boolean) => void;
  /** Add a dropdown option value to a prescription field. */
  addPrescriptionOption: (service: string, fieldId: string, value: string) => void;
  /** Remove a dropdown option value from a prescription field. */
  removePrescriptionOption: (service: string, fieldId: string, value: string) => void;
  /** Which weighted scoring fields are out of sync for a service (stale). */
  staleFieldsForService: (service: string) => string[];
  /** Is the given service's scoring out of sync with the prescription builder? */
  isServiceStale: (service: string) => boolean;
  /** Set (or clear, with weight 0) a single field's weight for a service. */
  setFieldWeight: (service: string, fieldId: string, weight: number) => void;
  /** Toggle a field on/off for a service (on = added with a default weight). */
  toggleField: (service: string, fieldId: string, on: boolean) => void;
  /** Replace the whole field list for a service. */
  setServiceFields: (service: string, fields: ScoreField[]) => void;
  /** Remove all scoring for a service → its cases become "No score applicable". */
  clearService: (service: string) => void;
  /** Edit a tier's upper cut-off %. */
  setThresholdUpTo: (id: ScoreTierId, upTo: number) => void;
  /** Enable/disable a tier (disabled tiers merge into the next enabled one). */
  toggleThreshold: (id: ScoreTierId, on: boolean) => void;
  /** Rename a tier. */
  setThresholdLabel: (id: ScoreTierId, label: string) => void;
  /** Reset everything back to the seeded defaults. */
  resetDefaults: () => void;
  /** Compute a case's score against the current config + thresholds. */
  scoreCase: (c: Case) => CaseScore;
}

const CaseScoringContext = createContext<CaseScoringContextType | null>(null);

export function CaseScoringProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ScoringConfig>(() =>
    // Deep-ish clone so edits never mutate the shared default object.
    Object.fromEntries(Object.entries(DEFAULT_SCORING_CONFIG).map(([k, v]) => [k, v.map(f => ({ ...f }))])),
  );
  const [thresholds, setThresholds] = useState<ScoreThreshold[]>(() => DEFAULT_THRESHOLDS.map(t => ({ ...t })));
  const [prescription, setPrescription] = useState<PrescriptionConfig>(() =>
    Object.fromEntries(Object.entries(DEFAULT_PRESCRIPTION_CONFIG).map(([k, v]) => [k, v.map(f => ({ ...f, options: f.options ? [...f.options] : undefined }))])),
  );

  const setServiceFields = useCallback((service: string, fields: ScoreField[]) => {
    setConfig(prev => ({ ...prev, [service]: fields }));
  }, []);

  const setFieldWeight = useCallback((service: string, fieldId: string, weight: number) => {
    setConfig(prev => {
      const list = prev[service] ? [...prev[service]] : [];
      const idx = list.findIndex(f => f.id === fieldId);
      const safe = Number.isFinite(weight) ? Math.max(0, Math.round(weight)) : 0;
      if (idx >= 0) {
        list[idx] = { ...list[idx], weight: safe };
      } else if (safe > 0) {
        list.push({ id: fieldId, label: SCORE_FIELD_DEF_MAP[fieldId]?.label ?? fieldId, weight: safe });
      }
      return { ...prev, [service]: list };
    });
  }, []);

  const toggleField = useCallback((service: string, fieldId: string, on: boolean) => {
    setConfig(prev => {
      const list = prev[service] ? [...prev[service]] : [];
      const idx = list.findIndex(f => f.id === fieldId);
      if (on && idx < 0) {
        list.push({ id: fieldId, label: SCORE_FIELD_DEF_MAP[fieldId]?.label ?? fieldId, weight: 10 });
      } else if (!on && idx >= 0) {
        list.splice(idx, 1);
      }
      return { ...prev, [service]: list };
    });
  }, []);

  const clearService = useCallback((service: string) => {
    setConfig(prev => ({ ...prev, [service]: [] }));
  }, []);

  const setThresholdUpTo = useCallback((id: ScoreTierId, upTo: number) => {
    const safe = Number.isFinite(upTo) ? Math.min(100, Math.max(0, Math.round(upTo))) : 0;
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, upTo: safe } : t));
  }, []);

  const toggleThreshold = useCallback((id: ScoreTierId, on: boolean) => {
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, enabled: on } : t));
  }, []);

  const setThresholdLabel = useCallback((id: ScoreTierId, label: string) => {
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, label } : t));
  }, []);

  // ── Prescription Builder mutations ──
  const setPrescriptionEnabled = useCallback((service: string, fieldId: string, enabled: boolean) => {
    setPrescription(prev => ({ ...prev, [service]: (prev[service] ?? []).map(f => f.id === fieldId ? { ...f, enabled } : f) }));
  }, []);
  const setPrescriptionRequired = useCallback((service: string, fieldId: string, required: boolean) => {
    setPrescription(prev => ({ ...prev, [service]: (prev[service] ?? []).map(f => f.id === fieldId ? { ...f, required } : f) }));
  }, []);
  const addPrescriptionOption = useCallback((service: string, fieldId: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    setPrescription(prev => ({ ...prev, [service]: (prev[service] ?? []).map(f =>
      f.id === fieldId ? { ...f, options: f.options?.includes(v) ? f.options : [...(f.options ?? []), v] } : f) }));
  }, []);
  const removePrescriptionOption = useCallback((service: string, fieldId: string, value: string) => {
    setPrescription(prev => ({ ...prev, [service]: (prev[service] ?? []).map(f =>
      f.id === fieldId ? { ...f, options: (f.options ?? []).filter(o => o !== value) } : f) }));
  }, []);

  const staleFieldsForService = useCallback((service: string) => staleScoringFields(service, config, prescription), [config, prescription]);
  const isServiceStale = useCallback((service: string) => isServiceScoringStale(service, config, prescription), [config, prescription]);

  const resetDefaults = useCallback(() => {
    setConfig(Object.fromEntries(Object.entries(DEFAULT_SCORING_CONFIG).map(([k, v]) => [k, v.map(f => ({ ...f }))])));
    setThresholds(DEFAULT_THRESHOLDS.map(t => ({ ...t })));
    setPrescription(Object.fromEntries(Object.entries(DEFAULT_PRESCRIPTION_CONFIG).map(([k, v]) => [k, v.map(f => ({ ...f, options: f.options ? [...f.options] : undefined }))])));
  }, []);

  const scoreCase = useCallback(
    (c: Case) => computeCaseScore(c, config, thresholds, (service) => isServiceScoringStale(service, config, prescription)),
    [config, thresholds, prescription],
  );

  const value = useMemo(
    () => ({
      config, thresholds, prescription,
      setPrescriptionEnabled, setPrescriptionRequired, addPrescriptionOption, removePrescriptionOption,
      staleFieldsForService, isServiceStale,
      setFieldWeight, toggleField, setServiceFields, clearService,
      setThresholdUpTo, toggleThreshold, setThresholdLabel, resetDefaults, scoreCase,
    }),
    [
      config, thresholds, prescription,
      setPrescriptionEnabled, setPrescriptionRequired, addPrescriptionOption, removePrescriptionOption,
      staleFieldsForService, isServiceStale,
      setFieldWeight, toggleField, setServiceFields, clearService,
      setThresholdUpTo, toggleThreshold, setThresholdLabel, resetDefaults, scoreCase,
    ],
  );

  return <CaseScoringContext.Provider value={value}>{children}</CaseScoringContext.Provider>;
}

export function useCaseScoring() {
  const ctx = useContext(CaseScoringContext);
  if (!ctx) throw new Error('useCaseScoring must be used within CaseScoringProvider');
  return ctx;
}
