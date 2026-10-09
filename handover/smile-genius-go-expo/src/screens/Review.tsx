// ─── Review scenarios (development builds only) ──────────────────────────────
// Replaces the web prototype's desktop side panel (GoApp.tsx: ThemeSwitch +
// "Jump to screen" with JUMPS / jump()). Reached from Account › Review scenarios,
// which only shows when __DEV__ is true. Delete for production along with
// demoFill / soloPractice in the store.
//
// Differences from the web panel (phone has no side panel):
//  • The "Sign in" group is left out (signing out is on the Account screen).
//  • No "you are here" highlight per row, as this screen is never visible next
//    to the screen it opens. The Filled statuses picks show the current fill.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronDown, Monitor, Moon, Sun } from '../components/icons';
import { DemoFill, FEATURES, ThemePref, useGo } from '../store/store';
import type { PracticeId } from '../data/data';
import { Card, Grad, Rows, Screen, SearchBox, Section, T, TopBar, cx } from '../components/ui';

interface Scenario { label: string; to: string; practice?: PracticeId | 'all'; solo?: PracticeId; fill?: DemoFill; fills?: { label: string; fill: DemoFill }[] }
interface Jump extends Scenario { group: string; scenarios?: Scenario[] }

// Same list as the web panel (paths without the /go prefix). `fill` sets the
// review data (see DemoFill); `fills` renders the quick picks 1 · 2 · 3 · All.
const JUMPS: Jump[] = [
  { group: 'Start', label: 'Home', to: '/home', scenarios: [
    { label: 'Multiple practices', to: '/home', practice: 'all' },
    { label: 'Single practice · no dropdown', to: '/home', solo: 'isc' },
    { label: 'Filled statuses', to: '/home', fill: 4, fills: [
      { label: '1', fill: 1 }, { label: '2', fill: 2 }, { label: '3', fill: 3 }, { label: 'All', fill: 4 },
    ] },
    { label: 'Empty dashboard', to: '/home', fill: 0 },
  ] },
  { group: 'Start', label: 'Notifications', to: '/notifications' },
  { group: 'Lab work', label: 'All lab work', to: '/work', scenarios: [
    { label: 'All cases', to: '/work' },
    { label: 'Overdue', to: '/work?f=overdue' },
    { label: 'Ready to dispatch', to: '/work?f=ready' },
    { label: 'On hold', to: '/work?f=on-hold' },
    { label: 'Draft', to: '/work?f=draft' },
    { label: 'Arriving from lab', to: '/work?f=arriving' },
    { label: 'Additional information required', to: '/work?f=questions' },
    { label: 'At risk only', to: '/work?r=at-risk' },
    { label: 'Tomorrow’s appointments', to: '/work?day=1' },
  ] },
  { group: 'Lab work', label: 'Case detail', to: '/work/SG-28491', scenarios: [
    { label: 'Single service · not sent yet', to: '/work/SG-28491' },
    { label: 'Multi-service case · on hold', to: '/work/SG-28472' },
    { label: 'Multi-service · 2 dentures in stages + crown', to: '/work/SG-28526' },
    { label: 'Denture in stages · single service', to: '/work/SG-28497' },
    { label: 'Clear aligners in phases + retainer', to: '/work/SG-28520' },
    { label: 'Arrives after the fit (at risk)', to: '/work/SG-28466' },
    { label: 'In practice, ready for patient', to: '/work/SG-28460' },
  ] },
  { group: 'Lab work', label: 'Reply to the lab', to: '/work/SG-28485', scenarios: [
    { label: 'Case overview', to: '/work/SG-28485' },
    { label: 'Straight to comments', to: '/work/SG-28485?tab=messages' },
  ] },
  { group: 'Lab work', label: 'Print label and dispatch', to: '/work/SG-28491/dispatch', scenarios: [
    { label: 'Crown · private', to: '/work/SG-28491/dispatch' },
    { label: 'Partial denture · NHS', to: '/work/SG-28497/dispatch' },
  ] },
  // Web /go/work/:id/receive redirects to the case with ?receive=1 (opens the Mark as received sheet)
  { group: 'Lab work', label: 'Mark as received', to: '/work/SG-28488?receive=1', scenarios: [
    { label: 'Arrives before the appointment', to: '/work/SG-28488?receive=1' },
    { label: 'Arrives after the fit (at risk)', to: '/work/SG-28466?receive=1' },
  ] },
  { group: 'Lab work', label: 'Chase overdue work', to: '/work/SG-28479' },
  { group: 'Create', label: 'Dictate a case (audio)', to: '/new/audio', scenarios: [
    { label: 'Single service', to: '/new/audio' },
    { label: 'Multi-service case', to: '/new/audio?rx=multi' },
    { label: 'Everything heard, no review', to: '/new/audio?rx=clean' },
  ] },
  { group: 'Create', label: 'Photograph a lab form', to: '/new/capture', scenarios: [
    { label: 'Single service', to: '/new/capture' },
    { label: 'Multi-service case', to: '/new/capture?rx=multi' },
    { label: 'Everything read, no review', to: '/new/capture?rx=clean' },
  ] },
  { group: 'Create', label: 'Fill in a case', to: '/new/manual', scenarios: [
    { label: 'New case', to: '/new/manual' },
    { label: 'Finish a draft · single service', to: '/new/manual?draft=SG-D1004' },
    { label: 'Finish a draft · multi-service', to: '/new/manual?draft=SG-D1007' },
    { label: 'Finish a draft · stages + phases + crown', to: '/new/manual?draft=SG-D1012' },
  ] },
  // Hidden while FEATURES.invoices is false. The invoice/statement routes need porting first (see screens/Invoices.tsx).
  { group: 'Invoices', label: 'All invoices', to: '/invoices', scenarios: [
    { label: 'All invoices', to: '/invoices' },
    { label: 'QC · needs review', to: '/invoices?s=qc' },
    { label: 'Duplicates', to: '/invoices?s=duplicate' },
    { label: 'Awaiting approval', to: '/invoices?s=awaiting' },
    { label: 'Approved', to: '/invoices?s=approved' },
    { label: 'Disputed', to: '/invoices?s=disputed' },
    { label: 'Sent to Xero failed', to: '/invoices?s=xero-failed' },
    { label: 'Statements', to: '/invoices?tab=statements' },
  ] },
  { group: 'Invoices', label: 'Invoice review', to: '/invoices/invoice/PDW-7731', scenarios: [
    { label: 'Amount flagged', to: '/invoices/invoice/PDW-7731' },
    { label: 'All checks passed', to: '/invoices/invoice/NDL-10482' },
    { label: 'Possible duplicate', to: '/invoices/invoice/DE-2026-118' },
  ] },
  { group: 'Invoices', label: 'Statement review', to: '/invoices/statement/ST-DSU-0926', scenarios: [
    { label: 'Two lines to resolve', to: '/invoices/statement/ST-DSU-0926' },
    { label: 'All lines matched', to: '/invoices/statement/ST-NDL-0926' },
  ] },
  { group: 'Account', label: 'Account & appearance', to: '/account' },
];

function ThemeSwitch() {
  const { themePref, setThemePref } = useGo();
  const opts: { v: ThemePref; icon: (cls: string) => React.ReactNode; label: string }[] = [
    { v: 'light', icon: cls => <Sun className={cls} />, label: 'Light' },
    { v: 'dark', icon: cls => <Moon className={cls} />, label: 'Dark' },
    { v: 'system', icon: cls => <Monitor className={cls} />, label: 'Auto' },
  ];
  return (
    <View className="flex-row p-1 rounded-2xl bg-go-surface border border-go-line">
      {opts.map(o => {
        const on = themePref === o.v;
        const inner = (
          <>
            {o.icon(cx('w-4 h-4', on ? 'text-white' : 'text-go-muted'))}
            <T className={cx('text-[12.5px] font-semibold', on ? 'text-white' : 'text-go-muted')}>{o.label}</T>
          </>
        );
        return (
          <Pressable key={o.v} onPress={() => setThemePref(o.v)} accessibilityRole="button" accessibilityLabel={o.label} accessibilityState={{ selected: on }}
            className="flex-1">
            {on
              ? <Grad className="h-9 px-3 rounded-xl flex-row items-center justify-center gap-1.5">{inner}</Grad>
              : <View className="h-9 px-3 rounded-xl flex-row items-center justify-center gap-1.5">{inner}</View>}
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReviewScreen() {
  const { setPractice, setSoloPractice, soloPractice, demoFill, setDemoFill } = useGo();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const jump = (s: Scenario) => {
    setSoloPractice(s.solo ?? null);
    // 4 = every status filled = the normal seed data
    setDemoFill(s.fill === undefined || s.fill === 4 ? null : s.fill);
    setPractice(s.solo ?? s.practice ?? 'all');
    router.push(s.to as never);
  };
  const toggle = (k: string) => setOpen(o => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  // Which Filled statuses pick matches the current review data
  const fillOn = (f: DemoFill) => !soloPractice && (f === 4 ? demoFill === null : demoFill === f);

  // Search matches the item, its group or any of its scenarios; scenario hits auto-expand.
  const term = q.trim().toLowerCase();
  const hit = (t: string) => t.toLowerCase().includes(term);
  // Hidden features drop out of the review index too
  const jumps = JUMPS.filter(j => FEATURES.invoices || j.group !== 'Invoices');
  const shown = jumps.map(j => {
    if (!term) return { j, scen: j.scenarios ?? [] };
    const self = hit(j.label) || hit(j.group);
    const scen = (j.scenarios ?? []).filter(s => self || hit(s.label));
    return self || scen.length ? { j, scen } : null;
  }).filter(Boolean) as { j: Jump; scen: Scenario[] }[];
  const groups = [...new Set(shown.map(x => x.j.group))];
  const total = jumps.reduce((n, j) => n + 1 + (j.scenarios?.length ?? 0), 0);

  return (
    <Screen header={<TopBar back fallback="/account" title="Review scenarios" />}>
      <Section title="Appearance" className="!mt-3">
        <ThemeSwitch />
      </Section>

      <Section title="Jump to screen" action={<T className="text-[11px] text-go-faint">{total} views</T>}>
        <SearchBox value={q} onChange={setQ} placeholder="Search screens & scenarios" />
      </Section>

      {groups.map(g => (
        <Section key={g} title={g} className="!mt-5">
          <Card className="overflow-hidden">
            <Rows>
              {shown.filter(x => x.j.group === g).map(({ j, scen }) => {
                const expanded = !!scen.length && (!!term || open.has(j.label));
                return (
                  <View key={j.label}>
                    <View className="flex-row items-center">
                      <Pressable onPress={() => jump(j)} accessibilityRole="button" accessibilityLabel={j.label}
                        className="flex-1 pl-4 py-3.5 active:bg-go-raised">
                        <T className="text-[15px] font-semibold text-go-ink">{j.label}</T>
                      </Pressable>
                      {!!j.scenarios?.length && (
                        <Pressable onPress={() => toggle(j.label)} accessibilityRole="button" accessibilityState={{ expanded }}
                          accessibilityLabel={`${expanded ? 'Hide' : 'Show'} scenarios for ${j.label}`}
                          className="h-11 px-3 mr-1 rounded-xl flex-row items-center gap-1 active:bg-go-raised">
                          <T className="text-[12px] text-go-faint">{j.scenarios.length}</T>
                          <ChevronDown className="w-4 h-4 text-go-faint" style={expanded ? { transform: [{ rotate: '180deg' }] } : undefined} />
                        </Pressable>
                      )}
                    </View>
                    {expanded && (
                      <View className="ml-5 mr-2 mb-2 pl-3 border-l border-go-line">
                        {scen.map(s => s.fills ? (
                          <View key={s.label} className="flex-row items-center gap-2 pl-1 pr-1 py-1.5">
                            <View className="w-1 h-1 rounded-full bg-go-muted" />
                            <T className="flex-1 text-[13.5px] text-go-muted">{s.label}</T>
                            <View className="flex-row gap-1.5">
                              {s.fills.map(f => {
                                const on = fillOn(f.fill);
                                const label = <T className={cx('text-[12px] font-semibold', on ? 'text-white' : 'text-go-ink2')}>{f.label}</T>;
                                return (
                                  <Pressable key={f.label} onPress={() => jump({ ...s, fill: f.fill })} accessibilityRole="button"
                                    accessibilityState={{ selected: on }} accessibilityLabel={`${s.label}: ${f.label}`}>
                                    {on
                                      ? <Grad className="h-8 min-w-[34px] px-2 rounded-lg items-center justify-center">{label}</Grad>
                                      : <View className="h-8 min-w-[34px] px-2 rounded-lg items-center justify-center bg-go-surface border border-go-line">{label}</View>}
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ) : (
                          <Pressable key={s.label} onPress={() => jump(s)} accessibilityRole="button" accessibilityLabel={s.label}
                            className="flex-row items-center gap-2 pl-1 pr-2 py-2.5 rounded-lg active:bg-go-raised">
                            <View className="w-1 h-1 rounded-full bg-go-muted" />
                            <T className="flex-1 text-[13.5px] text-go-muted">{s.label}</T>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </Rows>
          </Card>
        </Section>
      ))}
      {!shown.length && <T className="text-[12.5px] text-go-muted px-6 py-4">No screens match “{q}”.</T>}
    </Screen>
  );
}

export default ReviewScreen;
