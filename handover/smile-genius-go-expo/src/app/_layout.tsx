// ─── Root layout ─────────────────────────────────────────────────────────────
// Fonts, app state, theme (tokens + background wash), auth redirect, toasts.
import '../../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { GoStoreProvider, useGo } from '../store/store';
import { ThemeRoot } from '../theme/ThemeRoot';
import { Toaster } from '../components/ui';

const PUBLIC = ['signin', 'forgot'];

function Shell() {
  const { ready, signedIn, theme } = useGo();
  const segments = useSegments();
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold });

  // Signed out → Sign in. Signed in on a public screen → Home.
  useEffect(() => {
    if (!ready) return;
    const isPublic = PUBLIC.includes(segments[0] ?? '');
    if (!signedIn && !isPublic) router.replace('/signin');
    else if (signedIn && isPublic) router.replace('/home');
  }, [ready, signedIn, segments]);

  if (!ready || !fontsLoaded) return <View style={{ flex: 1 }} />;
  return (
    <ThemeRoot>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' }, animation: 'slide_from_right' }} />
      <Toaster />
    </ThemeRoot>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GoStoreProvider>
        <Shell />
      </GoStoreProvider>
    </SafeAreaProvider>
  );
}
