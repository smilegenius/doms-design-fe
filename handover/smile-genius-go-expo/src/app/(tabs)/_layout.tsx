// Bottom tabs: Home · Lab work · (+ Create lab work) · Invoices · Account — our floating tab bar.
import { Tabs } from 'expo-router';
import { TabBar } from '../../components/ui';

export default function TabsLayout() {
  return (
    <Tabs tabBar={() => <TabBar />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="work" />
      <Tabs.Screen name="invoices" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
