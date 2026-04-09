import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { OneSignal } from 'react-native-onesignal';

interface Profile {
  full_name?: string;
  address?: string;
  cep?: string;
  house_number?: string;
  phone?: string;
  neighborhood?: string;
  location_lat?: number;
  location_lng?: number;
  avatar_url?: string;
  created_at?: string;
  is_admin?: boolean;
  is_blocked?: boolean;
  expo_push_token?: string;
  birth_date?: string;
  subscription_status?: string;
  subscription_expires_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile(data);
    setLoading(false); // only mark done once profile is fetched
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        registerForPushNotificationsAsync(session.user.id);
        OneSignal.login(session.user.id);
        // loading=false is set inside fetchProfile
      } else {
        setLoading(false); // no user, done immediately
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true); // Garante que o loading volte a ser true ao logar
        fetchProfile(session.user.id);
        registerForPushNotificationsAsync(session.user.id);
        OneSignal.login(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    // Refresh profile when app comes to foreground (e.g. after Stripe checkout)
    const subscriptionAppState = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        refreshProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
      subscriptionAppState.remove();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      OneSignal.logout();
    } finally {
      // Garantir que os estados sejam limpos independente do erro de rede
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
