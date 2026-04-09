import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { typography } from '../theme/typography';

import { HomeScreen } from '../screens/HomeScreen';
import { FavoresScreen } from '../screens/FavoresScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MuralScreen } from '../screens/MuralScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { IncidentChatScreen } from '../screens/IncidentChatScreen';
import { CompleteProfileScreen } from '../screens/CompleteProfileScreen';
import { SubscriptionScreen } from '../screens/SubscriptionScreen';
import { DirectChatScreen } from '../screens/DirectChatScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { PanicButton } from '../components/PanicButton';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const activeSize = (focused: boolean) => focused ? 28 : 24;

const PanicOverlay = ({ state }: any) => {
  const currentRoute = state.routes[state.index].name;
  
  // Esconder na HOME
  if (currentRoute === 'HOME') return null;

  return (
    <View style={{ position: 'absolute', bottom: 105, left: 0, right: 0, alignItems: 'center', zIndex: 999 }}>
      <PanicButton size={65} />
    </View>
  );
};

const TabNavigator = () => {
  const { profile } = useAuth();
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.surfaceContainerLow,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.05)',
            height: 70,
            paddingBottom: 12,
            paddingTop: 8,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.outline,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            ...typography.labelSm,
            fontSize: 10,
            marginTop: -4,
          },
          tabBarIcon: ({ color, focused }) => {
            const size = focused ? 28 : 24;
            if (route.name === 'HOME') {
              return <MaterialIcons name="sensors" size={size} color={color} />;
            } else if (route.name === 'MURAL') {
              return <MaterialIcons name="dashboard-customize" size={size} color={color} />;
            } else if (route.name === 'FAVORES') {
              return <MaterialIcons name="handshake" size={size} color={color} />;
            } else if (route.name === 'PERFIL') {
              return <MaterialIcons name="account-circle" size={size} color={color} />;
            } else if (route.name === 'ADMIN') {
              return <MaterialIcons name="security" size={size} color={color} />;
            }
            return <Ionicons name="help-circle" size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="HOME" component={HomeScreen} />
        <Tab.Screen name="MURAL" component={MuralScreen} />
        <Tab.Screen name="FAVORES" component={FavoresScreen} />
        <Tab.Screen name="PERFIL" component={ProfileScreen} />
        {profile?.is_admin && <Tab.Screen name="ADMIN" component={AdminScreen} />}
      </Tab.Navigator>
      
      <FloatingPanic />
    </View>
  );
};

const FloatingPanic = () => {
  const state = useNavigationState(s => s);
  if (!state) return null;
  
  const activeRoute = state.routes[state.index];
  const currentName = activeRoute.state 
    ? activeRoute.state.routes[activeRoute.state.index || 0].name 
    : activeRoute.name;

  if (currentName === 'HOME') return null;

  return (
    <View style={{ position: 'absolute', bottom: 85, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
      <PanicButton size={65} />
    </View>
  );
};

export const AppNavigator = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (profile?.is_blocked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="lock-closed" size={80} color={colors.tertiary} />
        <Text style={[typography.headlineSm, { color: colors.tertiary, marginTop: 20, textAlign: 'center' }]}>CONTA BLOQUEADA</Text>
        <Text style={[typography.bodyMd, { color: colors.outline, marginTop: 12, textAlign: 'center' }]}>
          Sua conta foi suspensa por violar as diretrizes da comunidade Sentinela.
        </Text>
      </View>
    );
  }

  const navigatorKey = user ? 'auth-flow' : 'guest-flow';
  
  // Verificar se o perfil está incompleto (Campos Obrigatórios)
  const isProfileIncomplete = user && (
    !profile?.full_name || 
    !profile?.phone || 
    !profile?.birth_date || 
    !profile?.address || 
    !profile?.neighborhood ||
    !profile?.avatar_url
  );

  // Verificar se a assinatura está ativa (Admins entram direto)
  const isSubscriptionInactive = user && profile && !isProfileIncomplete && 
    !profile.is_admin && 
    profile.subscription_status !== 'active' && 
    profile.subscription_status !== 'syndic_pro';

  return (
    <NavigationContainer>
      <Stack.Navigator key={navigatorKey} screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : isProfileIncomplete ? (
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
        ) : isSubscriptionInactive ? (
          <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="IncidentChat" component={IncidentChatScreen} />
            <Stack.Screen name="DirectChat" component={DirectChatScreen} />
            <Stack.Screen name="ChatList" component={ChatListScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
