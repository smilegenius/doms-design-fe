import { Redirect } from 'expo-router';
import { useGo } from '../store/store';

export default function Index() {
  const { signedIn } = useGo();
  return <Redirect href={signedIn ? '/home' : '/signin'} />;
}
