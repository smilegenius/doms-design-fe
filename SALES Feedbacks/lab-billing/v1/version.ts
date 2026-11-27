// ── Billing's design ─────────────────────────────────────────────────────────
// The simpler Billing (V1) replaced the first design everywhere, in V1 and V2.
// V0's Billing screens stay in the folder (V1 reuses some of its parts) but
// are no longer shown.

export type BillingUi = 'v1' | 'v0';
export function useBillingUi(): BillingUi { return 'v1'; }
export const billingUi = (): BillingUi => 'v1';
