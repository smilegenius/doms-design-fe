import { getVersion, setVersion, useVersion } from '../../portalVersion';

// ── Billing's design: V1 (simpler) only when the portal is on V1 ─────────────
// V0 and V2 both use V0's Billing (V2 builds on V0). The portal-wide switch
// lives in portalVersion.ts; these helpers keep Billing's own buttons working.

export type BillingUi = 'v1' | 'v0';
export function setBillingUi(v: BillingUi) { setVersion(v === 'v1' ? 'v1' : 'v0'); }
export function useBillingUi(): BillingUi { return useVersion() === 'v1' ? 'v1' : 'v0'; }
export const billingUi = (): BillingUi => (getVersion() === 'v1' ? 'v1' : 'v0');
