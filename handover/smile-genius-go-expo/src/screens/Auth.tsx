// ─── Sign in · Forgot password ───────────────────────────────────────────────
// Ported from the web prototype's screens/Auth.tsx.
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import { Eye, EyeOff, Lock, Mail, MailCheck } from '../components/icons';
import { ME, useGo } from '../store/store';
import { BrandWordmark, Btn, Grad, Input, Label, Screen, T, TopBar, cx } from '../components/ui';
import { useTheme } from '../theme/ThemeRoot';

const GoogleG = () => (
  <Svg width={18} height={18} viewBox="0 0 48 48">
    <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </Svg>
);
const MsLogo = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16">
    <Rect width="7.5" height="7.5" fill="#F25022" />
    <Rect x="8.5" width="7.5" height="7.5" fill="#7FBA00" />
    <Rect y="8.5" width="7.5" height="7.5" fill="#00A4EF" />
    <Rect x="8.5" y="8.5" width="7.5" height="7.5" fill="#FFB900" />
  </Svg>
);

export function SignInScreen() {
  const { signIn } = useGo();
  const { c } = useTheme();
  const [email, setEmail] = useState(ME.email);
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | 'google' | 'microsoft' | 'email'>(null);

  const go = (via: 'google' | 'microsoft' | 'email') => {
    setBusy(via);
    setTimeout(() => { signIn(); router.replace('/home'); }, 900);
  };
  const submit = () => { if (email && pw && !busy) go('email'); };

  const sso = (via: 'google' | 'microsoft', icon: React.ReactNode, label: string) => (
    <Pressable onPress={() => go(via)} disabled={!!busy} accessibilityRole="button" accessibilityLabel={label}
      className={cx('flex-1 h-12 rounded-2xl bg-go-surface border border-go-line flex-row items-center justify-center gap-2 active:opacity-90', !!busy && 'opacity-60')}>
      {busy === via ? <ActivityIndicator size="small" color={c.ink} /> : icon}
      <T className="text-[14px] font-semibold text-go-ink">{label}</T>
    </Pressable>
  );

  return (
    <Screen scroll={false}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* The web's two blurred glow blobs are dropped (no blur natively); the app wash still shows through. */}
        <View className="flex-1 px-6">
          <View className="pt-16">
            <T className="text-[28px] font-bold text-go-ink tracking-tight">Welcome back</T>
            {/* Web uses gradient text (go-grad-text) for the product name; brand colour is the closest native equivalent without a masked view. */}
            <T className="text-[14px] text-go-muted mt-1">Sign in to <T className="text-[14px] text-go-brand font-semibold">Smile Genius Go</T></T>
          </View>

          <View className="mt-9 gap-3">
            <View>
              <Input keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Work email" placeholder="Work email" value={email}
                onChangeText={setEmail} autoComplete="username" textContentType="username" className="pl-11" returnKeyType="next" />
              <View pointerEvents="none" className="absolute left-4 top-0 bottom-0 justify-center">
                <Mail className="w-[18px] h-[18px] text-go-faint" />
              </View>
            </View>
            <View>
              <Input secureTextEntry={!show} accessibilityLabel="Password" placeholder="Password" value={pw} onChangeText={setPw}
                autoComplete="current-password" textContentType="password" autoCapitalize="none" className="pl-11 pr-12"
                returnKeyType="go" onSubmitEditing={submit} />
              <View pointerEvents="none" className="absolute left-4 top-0 bottom-0 justify-center">
                <Lock className="w-[18px] h-[18px] text-go-faint" />
              </View>
              <View className="absolute right-2 top-0 bottom-0 justify-center">
                <Pressable onPress={() => setShow(s => !s)} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}
                  className="w-10 h-10 rounded-xl items-center justify-center">
                  {show ? <EyeOff className="w-5 h-5 text-go-muted" /> : <Eye className="w-5 h-5 text-go-muted" />}
                </Pressable>
              </View>
            </View>
            <View className="flex-row justify-end">
              <Pressable onPress={() => router.push('/forgot')} accessibilityRole="button" hitSlop={6}>
                <T className="text-[12.5px] font-semibold text-go-brand">Forgot password?</T>
              </Pressable>
            </View>
            {/* Spinner goes in the icon slot: Btn wraps its children in <T>, which can't hold a View */}
            <Btn block disabled={!email || !pw || !!busy} onPress={submit}
              icon={busy === 'email' ? <ActivityIndicator size="small" color="white" /> : undefined}>
              {busy === 'email' ? '' : 'Sign in'}
            </Btn>
          </View>

          <View className="flex-row items-center gap-3 my-6">
            <View className="h-px flex-1 bg-go-line" /><T className="text-[12px] text-go-faint">or</T><View className="h-px flex-1 bg-go-line" />
          </View>
          <View className="flex-row gap-3">
            {sso('google', <GoogleG />, 'Google')}
            {sso('microsoft', <MsLogo />, 'Microsoft')}
          </View>

          {/* Full brand wordmark at the foot of the screen, centred and soft */}
          <View pointerEvents="none" className="mt-auto pt-10 pb-8 items-center">
            <View className="opacity-50"><BrandWordmark width={120} /></View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function ForgotScreen() {
  const [email, setEmail] = useState(ME.email);
  const [sent, setSent] = useState(false);
  return (
    <Screen header={<TopBar back fallback="/signin" />}>
      <View className="px-6 pt-2">
        {!sent ? (
          <>
            <T className="text-[26px] font-bold text-go-ink tracking-tight">Reset your password</T>
            <T className="text-[14px] text-go-muted mt-2 leading-[22px]">Enter your work email. We’ll send you a link to set a new password.</T>
            <View className="mt-6">
              <Label>Work email</Label>
              <Input keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Work email" value={email} onChangeText={setEmail} />
            </View>
            <View className="mt-4 p-3.5 rounded-2xl bg-go-brand-soft">
              <T className="text-[12.5px] text-go-brand-ink leading-[20px]">
                If you sign in with Google or Microsoft, please ask your IT provider to reset your password.
              </T>
            </View>
            <Btn block className="mt-6" disabled={!email} onPress={() => setSent(true)}>Send reset link</Btn>
          </>
        ) : (
          <View className="items-center pt-10">
            <Grad glow className="w-20 h-20 rounded-[28px] items-center justify-center"><MailCheck className="w-9 h-9 text-white" /></Grad>
            <T className="text-[24px] font-bold text-go-ink mt-6 text-center">Check your email</T>
            <T className="text-[14px] text-go-muted mt-2 leading-[22px] text-center">
              We sent a reset link to <T className="text-[14px] font-semibold text-go-ink">{email}</T>. It expires in 30 minutes.
            </T>
            <Btn block className="mt-8" onPress={() => router.replace('/signin')}>Back to sign in</Btn>
            <Pressable onPress={() => setSent(false)} accessibilityRole="button" className="mt-4" hitSlop={6}>
              <T className="text-[13px] font-semibold text-go-brand">Didn’t get it? Send again</T>
            </Pressable>
            <T className="text-[12px] text-go-faint mt-6 text-center">Can’t see it? Please check your junk or spam folder.</T>
          </View>
        )}
      </View>
    </Screen>
  );
}
