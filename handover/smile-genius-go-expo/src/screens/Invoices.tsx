// ─── Invoices tab ────────────────────────────────────────────────────────────
// Invoices are switched off for now (FEATURES.invoices = false in store.tsx), so
// the tab only shows this quiet "Coming soon" notice (web: InvoicesComingSoon in
// screens/Finance.tsx).
//
// The full invoice screens (invoice list with status tiles, invoice review,
// statement review) live in the web prototype's screens/Finance.tsx
// (FinanceScreen, InvoiceScreen, StatementScreen). Port them when
// FEATURES.invoices is turned on.
import { View } from 'react-native';
import { Monitor } from '../components/icons';
import { Screen, T, TopBar } from '../components/ui';

export function InvoicesComingSoon() {
  return (
    <Screen tabs header={<TopBar title="Invoices" large />}>
      {/* Deliberately quiet: faded icon + muted text, centred in the screen */}
      <View className="px-6 pt-40 items-center">
        <View className="w-16 h-16 rounded-full bg-go-raised border border-go-line items-center justify-center">
          <Monitor className="w-7 h-7 text-go-faint/60" />
        </View>
        <T className="text-[15px] font-medium text-go-muted tracking-[0.4px] mt-4 text-center">Coming soon to the app</T>
        <T className="text-[13px] text-go-faint leading-[20px] mt-1.5 max-w-[250px] text-center">
          For now, you can view and approve invoices on the Smile Genius web portal.
        </T>
      </View>
    </Screen>
  );
}

export default InvoicesComingSoon;
