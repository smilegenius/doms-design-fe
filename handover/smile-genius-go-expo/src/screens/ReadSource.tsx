// ─── What audio / photo read — UI shared by Capture and the case form ───────
// The voice note + transcript (or the prescription photo) shown on step 1 of
// the form, and the "please check" line under fields the read wasn't sure of.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { ChevronDown, Mic, RotateCcw } from '../components/icons';
import { Card, Grad, T, cx } from '../components/ui';
import { ReadFlag, ReadMode, ReadSource, fmtDur } from '../lib/readSource';

/** Stylised paper prescription used as the "photo" — fixed light colours, like paper. */
export function PaperRx({ width = 40 }: { width?: number }) {
  return (
    <Svg viewBox="0 0 210 270" width={width} height={width * (270 / 210)}>
      <Rect width="210" height="270" rx="6" fill="#FBFBF8" />
      <Rect x="16" y="16" width="90" height="10" rx="3" fill="#4D8EF7" opacity={0.85} />
      <Rect x="150" y="14" width="44" height="14" rx="3" fill="#E0E0E6" />
      {[44, 58, 72].map(y => <Rect key={y} x="16" y={y} width={y === 58 ? 120 : 160} height="5" rx="2.5" fill="#C9C9D3" />)}
      <Rect x="16" y="92" width="178" height="62" rx="5" fill="none" stroke="#D4D4DD" />
      <Path d="M30 128c10-14 20 14 30 0s20 14 30 0 20 14 30 0" stroke="#2A2A3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <SvgText x="140" y="130" fontSize="16" fill="#2A2A3A">LL5</SvgText>
      {[168, 182, 196, 210].map((y, i) => <Path key={y} d={`M16 ${y} q ${40 + i * 6} -6 ${120 - i * 14} 0`} stroke="#3A3A4A" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      <SvgText x="16" y="240" fontSize="13" fill="#2A2A3A">A2/3 ?</SvgText>
      <Path d="M120 244c10-16 18 10 26-4s12 8 22 0" stroke="#1565C0" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Voice note + collapsible transcript, or the prescription photo — on top of the form's first step. */
export function SourceCard({ src, toCheck }: { src: ReadSource; toCheck: number }) {
  const [open, setOpen] = useState(false);
  const audio = src.mode === 'audio';
  const again = () => router.replace({ pathname: audio ? '/new/audio' : '/new/capture', params: src.rx === 'single' ? {} : { rx: src.rx } });
  return (
    <Card className="p-3.5">
      <View className="flex-row items-center gap-3">
        {audio
          ? <Grad className="w-10 h-10 rounded-full items-center justify-center"><Mic className="w-5 h-5 text-white" /></Grad>
          : <View className="rounded-md overflow-hidden border border-go-line"><PaperRx width={40} /></View>}
        <View className="flex-1 min-w-0">
          <T className="text-[14px] font-semibold">{audio ? `Voice note · ${fmtDur(src.secs)}` : 'Prescription photo'}</T>
          <T className={cx('text-[12px] font-medium', toCheck ? 'text-go-warn' : 'text-go-ok')}>
            {toCheck ? `${toCheck} detail${toCheck > 1 ? 's' : ''} to check` : 'Everything is filled in. Please check it before sending.'}
          </T>
        </View>
        <Pressable onPress={again} accessibilityRole="button" className="flex-row items-center gap-1">
          <RotateCcw className="w-4 h-4 text-go-brand" />
          <T className="text-[12.5px] font-semibold text-go-brand">{audio ? 'Record again' : 'Take again'}</T>
        </Pressable>
      </View>
      {audio && (
        // What you said — 3 lines by default, tap to expand / collapse
        <Pressable onPress={() => setOpen(o => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} className="mt-3 w-full p-3 rounded-2xl bg-go-raised">
          <T className="text-[13px] leading-[20px] text-go-ink2" numberOfLines={open ? undefined : 3}>
            “{src.transcript.map((s, i) => s.flag
              ? <T key={i} className="text-[13px] font-semibold text-go-warn bg-go-warn-soft">{s.t}</T>
              : <T key={i} className="text-[13px] text-go-ink2">{s.t}</T>)}”
          </T>
          <View className="mt-1.5 flex-row items-center gap-1">
            <T className="text-[12px] font-semibold text-go-brand">{open ? 'Show less' : 'Show everything you said'}</T>
            <ChevronDown className={cx('w-3.5 h-3.5 text-go-brand', open && 'rotate-180')} />
          </View>
        </Pressable>
      )}
    </Card>
  );
}

/** Warn line under a field the read wasn't sure about. */
export function ReadHint({ flag, mode }: { flag?: ReadFlag; mode?: ReadMode }) {
  if (!flag) return null;
  return (
    <T className="text-[12px] text-go-warn font-medium mt-1.5 px-1">
      {flag.missing ? (mode === 'audio' ? 'Not mentioned in your voice note.' : 'Not found on the prescription.') : `${mode === 'audio' ? 'You said' : 'On the prescription'}: “${flag.heard}”.`} Please check.
    </T>
  );
}
