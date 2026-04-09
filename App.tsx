import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, Inter_900Black, Inter_700Bold, Inter_400Regular } from '@expo-google-fonts/inter';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { OneSignal } from 'react-native-onesignal';
import Constants from 'expo-constants';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_900Black,
    Inter_700Bold,
    Inter_400Regular,
  });

  React.useEffect(() => {
    // OneSignal Initialization
    const osId = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || "";
    if (osId) OneSignal.initialize(osId);
    
    // Also request permissions (required for iOS)
    OneSignal.Notifications.requestPermission(true);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor={colors.surfaceContainerLowest} />
      <AppNavigator />
    </AuthProvider>
  );
}
