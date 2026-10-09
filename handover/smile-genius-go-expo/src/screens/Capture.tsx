// ─── Create case by audio / by photo ─────────────────────────────────────────
// Record (or photograph the lab form) → read it → open the same step-by-step
// form as "Manually", prefilled. Anything the read wasn't sure about is left
// empty and flagged, so the form highlights it until it's checked.
//
// Native: real camera (expo-camera) and real mic (expo-audio). The read itself
// is still canned (readCase / TRANSCRIPT) — see the PROTOTYPE note in toForm.
// Web, or a device with no camera / no recorder: falls back to the prototype's
// mock viewfinder and simulated recording, so the flow can still be reviewed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Camera, Check, ImageUp, Mic, Pause, Play, RotateCcw, Sparkles, Stop, X, Zap, ZapOff } from '../components/icons';
import { Grad, Screen, T, TopBar, cx, useBack } from '../components/ui';
import { useGo } from '../store/store';
import { readCase, TRANSCRIPT } from '../lib/readCase';
import { ReadMode, ReadSource, RxScenario, fmtDur } from '../lib/readSource';
import { PaperRx } from './ReadSource';

type Mode = ReadMode;
type Phase = 'capture' | 'reading';
export type { RxScenario };

const IS_WEB = Platform.OS === 'web';
// The camera viewfinder is always dark, in both themes (fixed by design).
const CAM_BG = '#05050B';
const GUIDE = '#7FB0FF';

// ─── Small animations (the web's go-scanline / go-pulse / animate-ping) ─────

/** A line sweeping up and down over `travel` px. */
function ScanLine({ travel, className, children }: { travel: number; className?: string; children: React.ReactNode }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = 0;
    y.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * travel }] }));
  return <Animated.View pointerEvents="none" className={cx('absolute top-0', className)} style={style}>{children}</Animated.View>;
}

/** Soft blinking dot. */
function PulseDot({ className }: { className: string }) {
  const o = useSharedValue(1);
  useEffect(() => { o.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true); }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View className={className} style={style} />;
}

/** Ring that grows and fades behind a round button. */
function Ping() {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }), -1, false); }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.45 }] }));
  return (
    <Animated.View pointerEvents="none" className="absolute inset-0 rounded-full overflow-hidden" style={style}>
      <Grad className="flex-1 rounded-full" />
    </Animated.View>
  );
}

// ─── Permission notice (no web equivalent — the browser asked for us) ───────

function PermissionCard({ dark, icon, title, body, canAsk, askLabel, onAsk }: {
  dark?: boolean; icon: React.ReactNode; title: string; body: string; canAsk: boolean; askLabel: string; onAsk: () => void;
}) {
  return (
    <View className={cx('w-full rounded-[22px] p-5 items-center gap-3', dark ? 'bg-white/10' : 'bg-go-surface border border-go-line')}>
      <View className={cx('w-14 h-14 rounded-2xl items-center justify-center', dark ? 'bg-white/10' : 'bg-go-brand-soft')}>{icon}</View>
      <T className={cx('text-[17px] font-semibold text-center', dark ? 'text-white' : 'text-go-ink')}>{title}</T>
      <T className={cx('text-[13.5px] text-center leading-[20px]', dark ? 'text-white/70' : 'text-go-muted')}>{body}</T>
      <Pressable onPress={canAsk ? onAsk : () => Linking.openSettings()} accessibilityRole="button"
        className="mt-1 self-stretch active:opacity-90">
        <Grad glow className="h-[52px] rounded-2xl items-center justify-center px-5">
          <T className="text-[15px] font-semibold text-white">{canAsk ? askLabel : 'Open settings'}</T>
        </Grad>
      </Pressable>
    </View>
  );
}

// ─── Photo: take a photo of the lab form ────────────────────────────────────

function CameraScreen({ onShot }: { onShot: (uri: string | null) => void }) {
  const back = useBack('/home');
  const insets = useSafeAreaInsets();
  const [flash, setFlash] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // Live camera on a phone with a camera; the mock viewfinder otherwise.
  const [available, setAvailable] = useState<boolean | null>(IS_WEB ? false : null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cam = useRef<ExpoCameraView>(null);

  useEffect(() => {
    if (IS_WEB) return;
    let live = true;
    ExpoCameraView.isAvailableAsync().then(ok => { if (live) setAvailable(ok); }).catch(() => { if (live) setAvailable(false); });
    return () => { live = false; };
  }, []);

  const live = available === true && !!permission?.granted;
  const needsPermission = available === true && permission != null && !permission.granted;

  const shoot = async () => {
    // Mock viewfinder: carry on with no photo. Still checking the camera / permission: wait.
    if (!live) { if (available === false) onShot(null); return; }
    if (!ready || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current?.takePictureAsync({ quality: 0.8 });
      onShot(pic?.uri ?? null);
    } catch {
      setBusy(false);
    }
  };

  // Web: <input type="file" accept="image/*,application/pdf"> → the photo library.
  const upload = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets?.length) onShot(res.assets[0].uri);
  };

  const onBox = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const paperW = Math.min(box.w * 0.72, (box.h - 24) * (210 / 270));

  return (
    <View className="flex-1" style={{ backgroundColor: CAM_BG, paddingTop: insets.top }}>
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between px-4 h-14">
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Close camera"
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center active:opacity-90">
          <X className="w-5 h-5 text-white" />
        </Pressable>
        <T className="text-[15px] font-semibold text-white">Take a photo of the lab form</T>
        <Pressable onPress={() => setFlash(f => !f)} accessibilityRole="button" accessibilityLabel="Turn the flash on or off"
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center active:opacity-90">
          {flash ? <Zap className="w-5 h-5" color="#FBBF24" /> : <ZapOff className="w-5 h-5 text-white" />}
        </Pressable>
      </View>

      <View onLayout={onBox} className="relative flex-1 mx-5 my-2 rounded-[28px] overflow-hidden">
        <LinearGradient colors={['#2B2B36', '#14141C']} className="absolute inset-0" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {live ? (
          <ExpoCameraView ref={cam} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} facing="back"
            flash={flash ? 'on' : 'off'} onCameraReady={() => setReady(true)} onMountError={() => setAvailable(false)} />
        ) : needsPermission ? (
          <View className="absolute inset-0 items-center justify-center px-5">
            <PermissionCard dark icon={<Camera className="w-7 h-7 text-white" />}
              title="Let Go use your camera"
              body="To take a photo of the lab form, please allow the camera. You can also upload a photo instead."
              canAsk={permission?.canAskAgain !== false} askLabel="Allow camera" onAsk={requestPermission} />
          </View>
        ) : available === false && box.w > 0 ? (
          // Mock viewfinder (web / no camera): the paper form, slightly turned.
          <View className="absolute inset-0 items-center justify-center">
            <View style={{ transform: [{ rotate: '-4deg' }], opacity: 0.95, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12 }}>
              <PaperRx width={paperW} />
            </View>
          </View>
        ) : null}

        {!needsPermission && (
          <>
            {/* Frame guides */}
            {['top-5 left-5 border-t-[3px] border-l-[3px] rounded-tl-2xl', 'top-5 right-5 border-t-[3px] border-r-[3px] rounded-tr-2xl',
              'bottom-5 left-5 border-b-[3px] border-l-[3px] rounded-bl-2xl', 'bottom-5 right-5 border-b-[3px] border-r-[3px] rounded-br-2xl'].map(p => (
              <View key={p} pointerEvents="none" className={cx('absolute w-10 h-10', p)} style={{ borderColor: GUIDE }} />
            ))}
            {box.h > 0 && (
              <ScanLine travel={box.h * 0.8} className="left-6 right-6">
                <View style={{ marginTop: box.h * 0.1, shadowColor: GUIDE, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }}>
                  <LinearGradient colors={['rgba(127,176,255,0)', GUIDE, 'rgba(127,176,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2 }} />
                </View>
              </ScanLine>
            )}
            {/* "Form found" is the mock's fake detection; the live camera doesn't detect the form, so it isn't shown there. */}
            {!live && available === false && (
              <View className="absolute top-4 self-center flex-row items-center gap-1.5 h-7 px-3 rounded-full bg-black/50">
                <PulseDot className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
                <T className="text-[12px] font-medium text-white" numberOfLines={1}>Form found</T>
              </View>
            )}
          </>
        )}
      </View>

      <T className="text-center text-[12.5px] text-white/70 px-10 leading-[20px]">Lay the whole form flat in good light.</T>
      <View className="flex-row items-center justify-between px-10 pt-5" style={{ paddingBottom: insets.bottom + 28 }}>
        <Pressable onPress={upload} accessibilityRole="button" className="items-center gap-1 active:opacity-90">
          <View className="w-12 h-12 rounded-2xl bg-white/10 items-center justify-center"><ImageUp className="w-5 h-5 text-white" /></View>
          <T className="text-[11px] text-white/80">Upload</T>
        </Pressable>
        <Pressable onPress={shoot} disabled={needsPermission || busy} accessibilityRole="button" accessibilityLabel="Take photo"
          className={cx('w-[76px] h-[76px] rounded-full border-4 border-white items-center justify-center active:opacity-80', (needsPermission || (live && !ready)) && 'opacity-40')}>
          <View className="w-[60px] h-[60px] rounded-full bg-white" />
        </Pressable>
        <T className="w-12 text-center text-[11px] text-white/60 leading-[14px]">{'JPG, PNG\nor PDF'}</T>
      </View>
    </View>
  );
}

// ─── Audio: record a voice note ─────────────────────────────────────────────

const BARS = 28;
const RECORDING = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };

function RecordView({ onDone }: { onDone: (secs: number, uri: string | null) => void }) {
  const back = useBack('/home');
  // Real mic on a phone; simulated recording on web (the prototype's behaviour).
  const recorder = useAudioRecorder(RECORDING);
  const state = useAudioRecorderState(recorder, 100);
  const [real, setReal] = useState(!IS_WEB);
  const [perm, setPerm] = useState<{ denied: boolean; canAsk: boolean }>({ denied: false, canAsk: true });
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(0.12));
  const metering = useRef<number | undefined>(undefined);
  metering.current = state.metering;

  useEffect(() => {
    if (!rec) return;
    const t1 = setInterval(() => setSecs(x => x + 1), 1000);
    const t2 = setInterval(() => {
      // Live level from the mic (dBFS, about -60 quiet … 0 loud); random bars when simulated.
      const db = metering.current;
      const level = real && db != null ? Math.min(1, Math.max(0.12, (db + 60) / 60)) : 0.2 + Math.random() * 0.8;
      setBars(b => [...b.slice(1), level]);
    }, 110);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [rec, real]);

  const start = async () => {
    if (!real) { setRec(true); return; }
    try {
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) { setPerm({ denied: true, canAsk: p.canAskAgain }); return; }
      setPerm({ denied: false, canAsk: true });
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRec(true);
    } catch {
      // No recorder on this device: carry on with the simulated recording.
      setReal(false);
      setRec(true);
    }
  };
  const toggle = () => {
    if (real) { if (rec) recorder.pause(); else recorder.record(); }
    setRec(r => !r);
  };
  const stop = async () => {
    setRec(false);
    if (!real) { onDone(Math.max(secs, 18), null); return; }
    try { await recorder.stop(); } catch { /* already stopped */ }
    const s = Math.round((state.durationMillis || secs * 1000) / 1000);
    onDone(Math.max(s, 1), recorder.uri ?? null);
  };
  // Once started, pause/resume and retake appear either side of the main button
  const started = rec || secs > 0;
  const retake = async () => {
    if (real && started) { try { await recorder.stop(); } catch { /* nothing to stop */ } }
    setRec(false); setSecs(0); setBars(Array(BARS).fill(0.12));
  };
  const cancel = async () => {
    if (real && started) { try { await recorder.stop(); } catch { /* nothing to stop */ } }
    back();
  };
  // Web: <input type="file" accept="audio/*">
  const upload = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.length) onDone(42, res.assets[0].uri);
  };

  return (
    <Screen header={<TopBar back fallback="/home" title="Record a voice note" />}>
      <View className="items-center px-6 pt-6">
        <T className="text-[13px] text-go-muted text-center leading-[20px] max-w-[280px]">
          Say the patient’s name, each item with teeth, material and shade, the lab and the delivery date.
        </T>

        {perm.denied && (
          <View className="mt-6 w-full">
            <PermissionCard icon={<Mic className="w-7 h-7 text-go-brand" />}
              title="Let Go use your microphone"
              body="To record a voice note, please allow the microphone. You can also upload a voice note instead."
              canAsk={perm.canAsk} askLabel="Allow microphone" onAsk={start} />
          </View>
        )}

        {/* Waveform */}
        <View className="mt-10 h-24 w-full flex-row items-center justify-center gap-[3px]" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {bars.map((h, i) => rec
            ? <Grad key={i} className="w-[5px] rounded-full" style={{ height: Math.round(h * 96) }} />
            : <View key={i} className="w-[5px] rounded-full bg-go-line" style={{ height: Math.round(h * 96) }} />)}
        </View>
        <T className={cx('mt-4 text-[34px] font-bold tracking-tight', rec ? 'text-go-ink' : 'text-go-faint')} style={{ fontVariant: ['tabular-nums'] }}>{fmtDur(secs)}</T>
        <T className="text-[12.5px] text-go-muted h-5">{rec ? 'Listening… tap stop when you’re done' : secs ? 'Paused' : 'Tap to start'}</T>

        {/* Controls: pause/resume · big mic or finish · retake */}
        <View className="mt-8 flex-row items-center justify-center gap-7">
          <View className="w-14 items-center gap-1">
            {started && (
              <>
                <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel={rec ? 'Pause recording' : 'Resume recording'}
                  className="w-14 h-14 rounded-full bg-white border border-black/5 items-center justify-center active:opacity-90"
                  style={{ shadowColor: '#101840', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
                  {rec ? <Pause className="w-6 h-6" color="#030213" /> : <Play className="w-6 h-6 ml-0.5" color="#030213" />}
                </Pressable>
                <T className="text-[11px] font-medium text-go-muted">{rec ? 'Pause' : 'Resume'}</T>
              </>
            )}
          </View>

          <View className="relative">
            {rec && <Ping />}
            <Pressable onPress={() => (started ? stop() : start())} accessibilityRole="button" accessibilityLabel={started ? 'Finish recording' : 'Start recording'}
              className="active:opacity-90">
              {started ? (
                <View className="w-24 h-24 rounded-full items-center justify-center bg-go-bad">
                  <Stop className="w-9 h-9 text-white" />
                </View>
              ) : (
                <Grad glow className="w-24 h-24 rounded-full items-center justify-center">
                  <Mic className="w-10 h-10 text-white" />
                </Grad>
              )}
            </Pressable>
          </View>

          <View className="w-14 items-center gap-1">
            {started && (
              <>
                <Pressable onPress={retake} accessibilityRole="button" accessibilityLabel="Start the recording again"
                  className="w-14 h-14 rounded-full bg-white border border-black/5 items-center justify-center active:opacity-90"
                  style={{ shadowColor: '#101840', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 4 }}>
                  <RotateCcw className="w-6 h-6" color="#030213" />
                </Pressable>
                <T className="text-[11px] font-medium text-go-muted">Start again</T>
              </>
            )}
          </View>
        </View>

        <View className="mt-10 w-full rounded-[22px] bg-go-surface border border-go-line p-4">
          <T className="text-[11px] font-bold uppercase tracking-[1.5px] text-go-muted mb-2">Try saying</T>
          <T className="text-[13.5px] text-go-ink2 leading-[21px]">“Crown for Tom Hughes, lower left five, e.max shade A2, to Northstar, back by the 16th.”</T>
        </View>

        <Pressable onPress={upload} accessibilityRole="button" className="mt-4 flex-row items-center gap-1.5 self-center active:opacity-90">
          <ImageUp className="w-4 h-4 text-go-brand" />
          <T className="text-[13px] font-semibold text-go-brand">Upload a voice note instead</T>
        </Pressable>
        <Pressable onPress={cancel} accessibilityRole="button" className="mt-3 active:opacity-90">
          <T className="text-[12.5px] text-go-muted">Cancel</T>
        </Pressable>
      </View>
    </Screen>
  );
}

// ─── Reading / transcribing ─────────────────────────────────────────────────

function Reading({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const steps = mode === 'audio'
    ? ['Listening to your voice note', 'Picking out the case details', 'Finding the patient, dentist and lab']
    : ['Finding the form', 'Reading the handwriting', 'Finding the patient, dentist and lab'];
  const [i, setI] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  const fired = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setI(x => x + 1), 650);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (i >= steps.length && !fired.current) { fired.current = true; done.current(); }
  }, [i, steps.length]);
  return (
    <Screen scroll={false}>
      <View className="items-center px-8 pt-20">
        {mode === 'audio' ? (
          <View className="relative w-40 h-40">
            <Ping />
            <Grad glow className="w-40 h-40 rounded-full items-center justify-center">
              <Mic className="w-14 h-14 text-white" />
            </Grad>
          </View>
        ) : (
          <View className="relative w-40 h-52 rounded-xl overflow-hidden items-center justify-center">
            <PaperRx width={160} />
            <ScanLine travel={204} className="left-0 right-0">
              <Grad className="h-1" />
            </ScanLine>
          </View>
        )}
        <View className="mt-8 flex-row items-center gap-2">
          <Sparkles className="w-5 h-5 text-go-lav" />
          <T className="text-[17px] font-semibold text-go-ink">{mode === 'audio' ? 'Writing up your note…' : 'Reading the form…'}</T>
        </View>
        <View className="mt-6 w-full gap-3">
          {steps.map((s, k) => (
            <View key={s} className="flex-row items-center gap-3">
              {k < i ? (
                <Grad className="w-6 h-6 rounded-full items-center justify-center"><Check className="w-3.5 h-3.5 text-white" /></Grad>
              ) : (
                <View className={cx('w-6 h-6 rounded-full items-center justify-center border-2', k === i ? 'border-go-brand' : 'border-go-line')}>
                  {k === i && <PulseDot className="w-2 h-2 rounded-full bg-go-brand" />}
                </View>
              )}
              <T className={cx('text-[14px]', k <= i ? 'text-go-ink' : 'text-go-faint')}>{s}</T>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function CaptureScreen({ mode = 'photo' }: { mode?: Mode }) {
  const { setPendingRead } = useGo();
  const params = useLocalSearchParams<{ rx?: string }>();
  const rx = (['multi', 'clean'].includes(params.rx ?? '') ? params.rx : 'single') as RxScenario;
  const [phase, setPhase] = useState<Phase>('capture');
  const [secs, setSecs] = useState(42);
  // What was captured: the photo (or picked image) / the voice note file.
  const source = useRef<string | null>(null);
  // Jumping between scenarios on the same route restarts the flow.
  useEffect(() => { setPhase('capture'); source.current = null; }, [rx, mode]);

  // Read done → the same form as "Manually", prefilled, with the unsure bits flagged
  const toForm = useCallback(() => {
    // PROTOTYPE: canned read. Replace with the real call here —
    //   audio: speech-to-text on the voice note at `source.current` (an .m4a file URI), then extract the case;
    //   photo: OCR / form reading on the image at `source.current` (file URI; a base64 data URI on web).
    // It must return the same { form, flags } shape as readCase(), and the transcript for a voice note.
    // `source.current` is null when the web fallback (mock viewfinder / simulated recording) was used.
    const { form, flags } = readCase(rx, mode);
    const read: ReadSource = { mode, rx, secs, transcript: TRANSCRIPT[rx], flags };
    setPendingRead({ prefill: form, read });
    router.replace('/new/manual');
  }, [rx, mode, secs, setPendingRead]);

  if (phase === 'capture') return mode === 'audio'
    ? <RecordView onDone={(s, uri) => { source.current = uri; setSecs(s); setPhase('reading'); }} />
    : <CameraScreen onShot={uri => { source.current = uri; setPhase('reading'); }} />;
  return <Reading mode={mode} onDone={toForm} />;
}
