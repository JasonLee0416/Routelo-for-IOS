import { SafeAreaProvider } from 'react-native-safe-area-context';

import RouteloApp from './app/index';

export default function App() {
  return (
    <SafeAreaProvider>
      <RouteloApp />
    </SafeAreaProvider>
  );
}
