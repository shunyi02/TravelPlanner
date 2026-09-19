import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../src/theme';
import { api, initAuth, setSessionExpiredHandler, type CurrentUser } from '../src/api';
import { AuthScreen } from '../src/components/AuthScreen';
import { AuthContext } from '../src/authContext';

export default function RootLayout() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    initAuth().then((loggedIn) => {
      setAuthed(loggedIn);
      setChecking(false);
      if (loggedIn) {
        api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
      }
    });
    // If a background token refresh ever fails (refresh token expired or
    // revoked), drop back to the login screen instead of leaving the user
    // stuck on failing requests.
    setSessionExpiredHandler(() => setAuthed(false));
  }, []);

  const logout = () => {
    api.logout().then(() => {
      setAuthed(false);
      setCurrentUser(null);
    });
  };

  if (checking) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.route} />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!authed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthScreen
          onAuthed={() => {
            setAuthed(true);
            api.getMe().then(setCurrentUser).catch(() => setCurrentUser(null));
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={{ logout, currentUser }}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Travel Planner' }} />
          <Stack.Screen name="trip/[tripId]" options={{ title: '' }} />
        </Stack>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
