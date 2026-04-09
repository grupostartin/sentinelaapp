import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Vibration, Alert, ActivityIndicator, AppState } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';

interface PanicButtonProps {
  size?: number;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ size = 120 }) => {
  const { user, profile } = useAuth();
  const [isPressing, setIsPressing] = useState(false);
  const scaleValue = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [gpsBlocked, setGpsBlocked] = useState(false);

  // Check GPS permission on mount and re-check on foreground resume
  useEffect(() => {
    const checkGps = () => {
      Location.getForegroundPermissionsAsync().then(({ status }) => {
        setGpsBlocked(status !== 'granted');
      });
    };
    checkGps();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkGps();
    });
    return () => sub.remove();
  }, []);

  const ensureGpsPermission = async (): Promise<boolean> => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') { setGpsBlocked(false); return true; }

    const { status: s2 } = await Location.requestForegroundPermissionsAsync();
    if (s2 === 'granted') { setGpsBlocked(false); return true; }

    setGpsBlocked(true);
    Alert.alert(
      '🔒 GPS Necessário',
      'O botão de pânico requer localização ativa para alertar vizinhos. Habilite o GPS nas configurações.',
      [{ text: 'OK' }]
    );
    return false;
  };

  const ringSize = size * 1.2;
  const iconSize = size * 0.25;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.3,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseValue]);

  const recordPanicAlert = async () => {
    setLoading(true);
    try {
      // Get location ultra-fast: Try last known first
      let location = await Location.getLastKnownPositionAsync();
      
      // If no last known or it's old, get current with Low accuracy
      if (!location) {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
      }
      
      let addressString = profile?.address || "Localização capturada";
      if (!user) throw new Error("Usuário não identificado");

      // Attempt reverse geocode without blocking
      try {
        const reverse = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (reverse && reverse.length > 0) {
          const addr = reverse[0];
          addressString = `${addr.street || ''}, ${addr.name || addr.district || ''}`;
          if (addressString.startsWith(',')) addressString = addressString.substring(1).trim();
        }
      } catch (e) {}

      const { error } = await supabase.from('alerts').insert({
        user_id: user.id,
        type: 'panic',
        location_lat: location.coords.latitude,
        location_lng: location.coords.longitude,
        address: addressString,
        neighborhood: profile?.neighborhood || 'BH',
        is_anonymous: false,
        metadata: { full_name: profile?.full_name || 'Vizinho' }
      });

      if (error) throw error;
      
      Vibration.vibrate([100, 200, 100, 800]);
      Alert.alert("🚨 Pânico Disparado", `Vizinhos notificados em ${addressString}.`);
    } catch (error: any) {
      console.error("Panic failure:", error);
      Alert.alert("Falha no Comando", `Não foi possível disparar o pânico.`);
    } finally {
      setLoading(false);
      setCountdown(0);
    }
  };

  const handlePressIn = async () => {
    const hasGps = await ensureGpsPermission();
    if (!hasGps) return;

    Vibration.vibrate(50);
    setIsPressing(true);
    setCountdown(2); // Inicia contagem
    
    Animated.spring(scaleValue, {
      toValue: 0.85,
      useNativeDriver: true,
    }).start();

    countdownInterval.current = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    pressTimer.current = setTimeout(() => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
      recordPanicAlert();
      setIsPressing(false);
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }, 2000);
  };

  const handlePressOut = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setIsPressing(false);
    setCountdown(0);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            transform: [{ scale: pulseValue }],
            opacity: pulseValue.interpolate({
              inputRange: [1, 1.3],
              outputRange: [0.2, 0],
            }),
          },
        ]}
      />
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={loading || gpsBlocked}
        style={({ pressed }) => [
          styles.buttonInner,
          { width: size, height: size, borderRadius: size / 2 },
          (pressed || loading) && styles.pressedState,
          gpsBlocked && styles.blockedState,
        ]}
      >
        <Animated.View style={[styles.content, { transform: [{ scale: scaleValue }] }]}>
          {loading ? (
            <ActivityIndicator color={colors.primary} size="large" />
          ) : gpsBlocked ? (
            <>
              <MaterialIcons name="location-off" size={iconSize * 1.8} color={colors.outline} />
              <Text style={[styles.text, { fontSize: size * 0.1, color: colors.outline }]}>SEM GPS</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="emergency" size={iconSize * 1.8} color={colors.primary} />
              <Text style={[styles.text, { fontSize: size * 0.12 }]}>
                {isPressing ? countdown : 'PANIC'}
              </Text>
            </>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonInner: {
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 2,
    borderColor: 'rgba(86, 228, 114, 0.4)',
  },
  pressedState: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerHigh,
  },
  blockedState: {
    borderColor: colors.outline,
    opacity: 0.5,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '85%',
    height: '85%',
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(86, 228, 114, 0.2)',
    backgroundColor: '#1a1a1a', 
  },
  text: {
    ...typography.labelSm,
    color: colors.onSurface,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 2,
    marginTop: 4,
  },
});
