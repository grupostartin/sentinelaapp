import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, RefreshControl, Pressable, Vibration, Modal, Image, TextInput, Alert, ActivityIndicator, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { PanicButton } from '../components/PanicButton';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { isInRadius, getDistanceInMeters } from '../services/location';
import { useNavigation } from '@react-navigation/native';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { ImagePopup } from '../components/ImagePopup';

const { width } = Dimensions.get('window');

export const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const { profile, user, signOut } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [inRange, setInRange] = useState(true);
  const [emergency, setEmergency] = useState<any>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reporting, setReporting] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; addr: string; isExact: boolean } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [locationStatus, setLocationStatus] = useState<'ok' | 'denied' | 'checking'>('checking');
  const [tick, setTick] = useState(0); // updates every minute to refresh countdowns
  const [showBetaModal, setShowBetaModal] = useState(false);

  // Tick every 60 seconds to refresh countdown displays
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Check for first-time Beta warning
  useEffect(() => {
    const checkBetaWarning = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem('HAS_SEEN_BETA_WARNING');
        if (!hasSeen) {
          setShowBetaModal(true);
        }
      } catch (e) {
        console.error("Error checking beta warning", e);
      }
    };
    checkBetaWarning();
  }, []);

  const dismissBetaWarning = async () => {
    try {
      await AsyncStorage.setItem('HAS_SEEN_BETA_WARNING', 'true');
      setShowBetaModal(false);
    } catch (e) {
      setShowBetaModal(false);
    }
  };

  // Returns formatted time remaining until 24h since created_at
  const getTimeRemaining = (createdAt: string): string => {
    const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'EXPIRADO';
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(25);
      
      if (error) throw error;
      if (!data) return;

      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = data.filter(alert => {
        // Drop alerts older than 24h
        if (new Date(alert.created_at).getTime() < cutoff) return false;
        if (alert.user_id === user?.id) return true;
        if (profile?.location_lat) {
          const dist = getDistanceInMeters(
            alert.location_lat,
            alert.location_lng,
            profile.location_lat,
            profile.location_lng as number
          );
          return dist <= 1000;
        }
        return true;
      });
      setAlerts(filtered);
    } catch (e) {
      console.error("Fetch alerts failed", e);
    }
  };

  const handleNewAlert = async (payload: any) => {
    const newAlert = payload.new;
    await fetchAlerts();

    if (newAlert.type === 'panic' && newAlert.user_id !== user?.id) {
      if (profile?.location_lat) {
        const dist = getDistanceInMeters(
          newAlert.location_lat,
          newAlert.location_lng,
          profile.location_lat,
          profile.location_lng as number
        );
        
        if (dist <= 1000) {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', newAlert.user_id).single();
          setEmergency({ ...newAlert, full_name: p?.full_name });
          Vibration.vibrate([0, 500, 200, 500]);
        }
      }
    }
  };

  // Starts fetching GPS as soon as the modal opens (background)
  const openReportModal = () => {
    if (locationStatus === 'denied') {
      Alert.alert(
        '📍 GPS Necessário',
        'Para relatar uma ocorrência precisamos da sua localização. Ative o GPS e tente novamente.',
        [
          { text: 'Ativar GPS', onPress: () => requestLocationPermission() },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
      return;
    }

    setLiveLocation(null);
    setShowReportModal(true);

    Location.getLastKnownPositionAsync()
      .then(async (lastLoc) => {
        // Step 1: Show cached position immediately (instant)
        if (lastLoc) {
          let lastAddr = profile?.address || 'Localização anterior';
          try {
            const rev = await Location.reverseGeocodeAsync({ latitude: lastLoc.coords.latitude, longitude: lastLoc.coords.longitude });
            if (rev.length > 0) {
              const r = rev[0];
              lastAddr = `${r.street || ''}, ${r.name || r.district || ''}`.replace(/^,\s*/, '');
            }
          } catch (_) {}
          setLiveLocation({ lat: lastLoc.coords.latitude, lng: lastLoc.coords.longitude, addr: lastAddr, isExact: false });
        }

        // Step 2: Upgrade to exact live GPS silently
        const liveLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        let liveAddr = profile?.address || 'Localização capturada';
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude: liveLoc.coords.latitude, longitude: liveLoc.coords.longitude });
          if (rev.length > 0) {
            const r = rev[0];
            liveAddr = `${r.street || ''}, ${r.name || r.district || ''}`.replace(/^,\s*/, '');
          }
        } catch (_) {}
        setLiveLocation({ lat: liveLoc.coords.latitude, lng: liveLoc.coords.longitude, addr: liveAddr, isExact: true });
      })
      .catch(() => {});
  };

  const handleQuickReport = async () => {
    if (!reportText.trim()) return;
    setReporting(true);
    try {
      // Use pre-fetched live location if available, else fall back to profile
      const lat = liveLocation?.lat ?? profile?.location_lat ?? null;
      const lng = liveLocation?.lng ?? profile?.location_lng ?? null;
      const addr = liveLocation?.addr ?? profile?.address ?? 'Localização não disponível';

      const { error } = await supabase.from('alerts').insert({
        user_id: user?.id,
        type: 'warning',
        description: reportText,
        location_lat: lat,
        location_lng: lng,
        address: addr,
        neighborhood: profile?.neighborhood || 'BH',
        metadata: { full_name: profile?.full_name }
      });

      if (error) throw error;
      setReportText('');
      setShowReportModal(false);
      Alert.alert("Enviado!", "Ocorrência relatada aos vizinhos.");
    } catch (e: any) {
      Alert.alert("Erro ao enviar", "Verifique sua conexão e tente novamente.");
    } finally {
      setReporting(false);
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setLocationStatus('ok');
      return true;
    }
    // If denied, show alert with option to try again
    Alert.alert(
      'Localização Necessária',
      'O Sentinela precisa da sua localização para alertar vizinhos próximos. Por favor, permita o acesso.',
      [
        {
          text: 'Tentar Novamente',
          onPress: async () => {
            const { status: s2 } = await Location.requestForegroundPermissionsAsync();
            if (s2 === 'granted') {
              setLocationStatus('ok');
              checkRange();
            } else {
              setLocationStatus('denied');
            }
          }
        },
        {
          text: 'Ignorar',
          style: 'cancel',
          onPress: () => setLocationStatus('denied')
        }
      ]
    );
    return false;
  };

  const checkRange = async () => {
    if (!profile?.location_lat) return;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const inR = isInRadius(
        loc.coords.latitude,
        loc.coords.longitude,
        profile.location_lat,
        profile.location_lng as number
      );
      setInRange(inR);
      setLocationStatus('ok');
    } catch (e) {
      setLocationStatus('denied');
    }
  };

  useEffect(() => {
    fetchAlerts();
    registerForPushNotificationsAsync && user && profile && !profile.expo_push_token && registerForPushNotificationsAsync(user.id);

    // Request location permission on mount
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status === 'granted') {
        setLocationStatus('ok');
        checkRange();
      } else {
        requestLocationPermission();
      }
    });

    const rangeInterval = setInterval(checkRange, 30000);

    // Re-check GPS when app returns to foreground (user may have enabled GPS in settings)
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        Location.getForegroundPermissionsAsync().then(({ status }) => {
          if (status === 'granted') {
            setLocationStatus('ok');
            checkRange();
          } else {
            setLocationStatus('denied');
          }
        });
      }
    });

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, handleNewAlert)
      .subscribe();

    // Realtime presence for online neighbor count
    const presenceChannel = supabase.channel('online-users-home', { config: { presence: { key: user?.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user?.id, neighborhood: profile?.neighborhood });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
      clearInterval(rangeInterval);
      appStateSub.remove();
    };
  }, [profile]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    Alert.alert(
      "Excluir Atividades",
      `Tem certeza que deseja excluir ${selectedIds.length} atividades de uma vez?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir Todas", 
          style: "destructive",
          onPress: async () => {
             try {
               const { error } = await supabase.from('alerts').delete().in('id', selectedIds);
               if (error) throw error;
               setAlerts(prev => prev.filter(a => !selectedIds.includes(a.id)));
               setSelectedIds([]);
               setSelectionMode(false);
             } catch (e) {
               Alert.alert("Erro", "Falha ao excluir atividades.");
             }
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const handleDeleteAlert = async (id: string) => {
    Alert.alert(
      "Confirmar Exclusão",
      "Tem certeza que deseja remover esta atividade?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('alerts').delete().eq('id', id);
            if (error) Alert.alert("Erro", error.message);
            else fetchAlerts();
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Quick Report Modal */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>RELATAR OCORRÊNCIA</Text>
              <Pressable onPress={() => setShowReportModal(false)}>
                <Ionicons name="close" size={24} color={colors.outline} />
              </Pressable>
            </View>
            <View style={styles.locationBadge}>
              <MaterialIcons 
                name={liveLocation?.isExact ? 'my-location' : 'location-searching'} 
                size={14} 
                color={liveLocation?.isExact ? colors.primary : colors.outline} 
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.locationBadgeLabel}>
                  {liveLocation ? (liveLocation.isExact ? 'LOCALIZAÇÃO EXATA' : 'ÚLTIMA LOCALIZAÇÃO') : 'BUSCANDO LOCALIZAÇÃO...'}
                </Text>
                {liveLocation && (
                  <Text style={styles.locationBadgeAddr} numberOfLines={1}>{liveLocation.addr}</Text>
                )}
              </View>
              {liveLocation && !liveLocation.isExact && (
                <ActivityIndicator size="small" color={colors.outline} style={{ marginLeft: 6 }} />
              )}
              {liveLocation?.isExact && (
                <MaterialIcons name="check-circle" size={16} color={colors.primary} />
              )}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Carro estranho parado na rua tal..."
              placeholderTextColor={colors.outline}
              multiline
              numberOfLines={4}
              value={reportText}
              onChangeText={setReportText}
            />
            <Pressable 
              style={[styles.modalSubmit, reporting && { opacity: 0.7 }]} 
              onPress={handleQuickReport}
              disabled={reporting}
            >
              {reporting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.modalSubmitText}>ENVIAR ALERTA</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Emergency Modal */}
      <Modal visible={!!emergency} transparent animationType="slide">
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyCard}>
            <Ionicons name="alert-circle" size={80} color={colors.tertiary} />
            <Text style={styles.emergencyTitle}>EMERGÊNCIA PRÓXIMA</Text>
            <Text style={styles.emergencyName}>{emergency?.full_name || 'Vizinho'}</Text>
            <View style={styles.emergencyAddressContainer}>
              <Ionicons name="location" size={16} color={colors.onSurface} />
              <Text style={styles.emergencyAddress}>{emergency?.address}</Text>
            </View>
            <View style={styles.emergencyActions}>
              <Pressable 
                style={[styles.emergencyButton, { backgroundColor: colors.primary, marginBottom: 12 }]} 
                onPress={() => {
                  const id = emergency.id;
                  const name = emergency.full_name || 'Vizinho';
                  setEmergency(null);
                  navigation.navigate('IncidentChat', { alertId: id, alertTitle: `Emergência: ${name}` });
                }}
              >
                <Ionicons name="chatbubbles" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
                <Text style={styles.emergencyButtonText}>ABRIR SALA DE CRISE</Text>
              </Pressable>

              <Pressable style={[styles.emergencyButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.outline }]} onPress={() => setEmergency(null)}>
                <Text style={[styles.emergencyButtonText, { color: colors.outline }]}>IGNORAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialIcons name="signal-cellular-alt" size={20} color={colors.primary} />
          <Text style={[typography.headlineSm, styles.headerTitle]}>SENTINELA</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusVertical}>
            <Text style={[styles.statusLabel, locationStatus === 'denied' && { color: colors.tertiary }]}>
              {locationStatus === 'denied' ? 'STATUS: SEM GPS' : 'STATUS: ATIVO'}
            </Text>
            <Text style={[styles.statusSubtext, locationStatus === 'denied' && { color: colors.tertiary }]}>
              {locationStatus === 'denied' ? 'ALCANCE: ERRO' : locationStatus === 'checking' ? 'VERIFICANDO...' : inRange ? 'ALCANCE: OK' : 'FORA DE ÁREA'}
            </Text>
          </View>
          <Pressable style={styles.headerAvatar} onPress={() => navigation.navigate('PERFIL')}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.headerAvatarImg} />
            ) : (
              <Ionicons name="person" size={20} color={colors.outline} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.panicSection}>
          <View style={styles.radarLayout}>
            <View style={styles.radarCircle1} />
            <View style={styles.radarCircle2} />
            <PanicButton size={width * 0.55} />
          </View>
          <Text style={styles.instruction}>PRESSIONE E SEGURE PARA ATIVAR</Text>
          
          <View style={styles.gridContainer}>
             <View style={styles.gridCard}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                   <Text style={styles.gridCardTitle}>Sua Localização</Text>
                   <Text style={styles.gridCardSub} numberOfLines={1}>{profile?.address || 'BH'}</Text>
                </View>
             </View>
             <View style={styles.gridCard}>
                <Ionicons name="people" size={18} color={colors.primary} />
                <View style={{ marginLeft: 8 }}>
                   <Text style={styles.gridCardTitle}>Online Agora</Text>
                   <Text style={styles.gridCardSub}>{onlineCount} vizinho{onlineCount !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.onlineDot} />
             </View>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Pressable 
            style={styles.reportQuickBtn} 
            onPress={openReportModal}
          >
            <MaterialIcons name="report-problem" size={20} color={colors.primary} />
            <Text style={styles.reportQuickBtnText}>RELATAR OCORRÊNCIA</Text>
          </Pressable>
        </View>

        <View style={styles.muralHeader}>
          <Text style={styles.muralTitle}>ATIVIDADE RECENTE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {selectionMode && selectedIds.length > 0 && (
              <Pressable style={styles.bulkDeleteBtn} onPress={handleBulkDelete}>
                <Ionicons name="trash" size={16} color={colors.onTertiary} />
                <Text style={styles.bulkDeleteText}>EXCLUIR ({selectedIds.length})</Text>
              </Pressable>
            )}
            {profile?.is_admin && (
              <Pressable
                style={[styles.selectModeBtn, selectionMode && styles.selectModeBtnActive]}
                onPress={() => { setSelectionMode(v => !v); setSelectedIds([]); }}
              >
                <MaterialIcons
                  name={selectionMode ? 'close' : 'checklist'}
                  size={16}
                  color={selectionMode ? colors.tertiary : colors.outline}
                />
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.feed}>
          {alerts.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma atividade registrada.</Text>
          ) : (
            alerts.map((alert) => {
              const isSelected = selectedIds.includes(alert.id);
              return (
                <Pressable 
                  key={alert.id} 
                  onPress={() => selectionMode ? toggleSelection(alert.id) : null}
                  style={[
                    styles.feedCard, 
                    alert.type === 'panic' && { backgroundColor: 'rgba(255, 59, 48, 0.05)', borderColor: colors.tertiary, borderWidth: 1 },
                    isSelected && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: 'rgba(52, 199, 89, 0.05)' }
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardUserContainer}>
                      {selectionMode ? (
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
                        </View>
                      ) : (
                        <Pressable 
                          style={styles.cardAvatar}
                          onPress={() => alert.profiles?.avatar_url && setSelectedPhoto(alert.profiles.avatar_url)}
                        >
                          {alert.profiles?.avatar_url ? (
                            <Image source={{ uri: alert.profiles.avatar_url }} style={styles.cardAvatarImg} />
                          ) : (
                            <Ionicons name="person" size={12} color={colors.outline} />
                          )}
                        </Pressable>
                      )}
                      <View style={[
                        styles.tag,
                        alert.type === 'panic' && styles.tagPanic,
                        alert.type === 'warning' && styles.tagWarning,
                      ]}>
                        <Text style={[
                          styles.tagText,
                          alert.type === 'panic' && styles.tagTextPanic,
                          alert.type === 'warning' && styles.tagTextWarning,
                        ]}>
                          {alert.type === 'panic' ? '🚨 PÂNICO' : '⚠️ ALERTA'}
                        </Text>
                      </View>
                      {!selectionMode && (
                        <Pressable 
                          style={styles.chatActionBtn}
                          onPress={() => navigation.navigate('IncidentChat', { alertId: alert.id, alertTitle: `Incidente: ${alert.profiles?.full_name?.split(' ')[0] || 'Vizinho'}`, alertCreatedAt: alert.created_at })}
                        >
                          <Ionicons name="chatbubbles" size={14} color={colors.primary} />
                          <Text style={styles.chatActionText}>CHAT AO VIVO</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.timeText}>
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <Text style={[styles.countdownText, getTimeRemaining(alert.created_at) === 'EXPIRADO' && { color: colors.tertiary }]}>
                        ⏱ {getTimeRemaining(alert.created_at)}
                      </Text>
                      {profile?.is_admin && !selectionMode && (
                        <Pressable onPress={() => handleDeleteAlert(alert.id)} style={{ marginTop: 4 }}>
                          <Ionicons name="trash-outline" size={15} color={colors.tertiary} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <Text style={styles.cardText}>
                    {alert.type === 'panic' 
                      ? `${alert.profiles?.full_name || 'Vizinho'} solicitou socorro imediato.` 
                      : alert.description || 'Alerta emitido.'}
                  </Text>
                  {alert.address && (
                    <View style={styles.addressContainer}>
                      <Ionicons name="location" size={12} color={colors.primary} />
                      <Text style={styles.addressText}>{alert.address}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <ImagePopup 
        visible={!!selectedPhoto} 
        imageUri={selectedPhoto} 
        onClose={() => setSelectedPhoto(null)} 
      />

      {/* Beta Warning Modal (First Time Only) */}
      <Modal visible={showBetaModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.betaModalCard}>
            <View style={styles.betaIconContainer}>
              <MaterialIcons name="construction" size={50} color={colors.primary} />
            </View>
            <Text style={styles.betaModalTitle}>VERSÃO BETA</Text>
            <Text style={styles.betaModalText}>
              Seja bem-vindo ao Sentinela! Esta é uma versão de testes (Beta).
              {"\n\n"}
              Algumas funcionalidades ainda estão sendo aprimoradas. Seu feedback é fundamental para construirmos uma comunidade mais segura.
            </Text>
            <Pressable style={styles.betaModalBtn} onPress={dismissBetaWarning}>
              <Text style={styles.betaModalBtnText}>ENTENDI E QUERO AJUDAR</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: colors.primary, fontWeight: '900', fontSize: 16, letterSpacing: 2, marginLeft: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  statusVertical: { alignItems: 'flex-end', marginRight: 12 },
  statusLabel: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  statusSubtext: { color: 'rgba(229, 226, 225, 0.5)', fontSize: 7, textTransform: 'uppercase', marginTop: 2 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(86, 228, 114, 0.2)', overflow: 'hidden' },
  headerAvatarImg: { width: '100%', height: '100%' },
  panicSection: { alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 40 },
  radarLayout: { width: width, height: width * 0.7, justifyContent: 'center', alignItems: 'center' },
  radarCircle1: { position: 'absolute', width: width * 0.6, height: width * 0.6, borderRadius: 1000, borderWidth: 1, borderColor: 'rgba(86, 228, 114, 0.1)' },
  radarCircle2: { position: 'absolute', width: width * 0.9, height: width * 0.9, borderRadius: 1000, borderWidth: 1, borderColor: 'rgba(86, 228, 114, 0.05)', borderStyle: 'dashed' },
  gridContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginTop: 30 },
  gridCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(61, 74, 60, 0.15)' },
  gridCardTitle: { color: colors.onSurfaceVariant, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  gridCardSub: { color: 'rgba(229, 226, 225, 0.6)', fontSize: 9, marginTop: 2 },
  instruction: { ...typography.labelSm, color: colors.onSurface, marginTop: 40, opacity: 0.6, letterSpacing: 2, textAlign: 'center' },
  muralHeader: { paddingHorizontal: 24, marginBottom: 10, marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muralTitle: { ...typography.labelSm, color: colors.outline, letterSpacing: 2 },
  adminModeBtn: { marginRight: 15, padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  adminModeBtnActive: { backgroundColor: 'rgba(255,59,48,0.1)' },
  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  bulkDeleteText: { color: colors.onTertiary, fontSize: 10, fontWeight: '900', marginLeft: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.outline, marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  feed: { paddingHorizontal: 16 },
  feedCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 8, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardUserContainer: { flexDirection: 'row', alignItems: 'center' },
  cardAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  cardAvatarImg: { width: '100%', height: '100%' },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  tagText: { ...typography.labelSm, fontSize: 9, fontWeight: '900' },
  tagPanic: { backgroundColor: 'rgba(255, 59, 48, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.4)' },
  tagWarning: { backgroundColor: 'rgba(255, 184, 0, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 184, 0, 0.4)' },
  tagTextPanic: { color: '#ff6b63' },
  tagTextWarning: { color: '#ffcc00' },
  timeText: { ...typography.labelSm, fontSize: 9, color: colors.outline },
  countdownText: { fontSize: 8, color: colors.outline, marginTop: 2, fontWeight: '700', opacity: 0.8 },
  cardText: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14, lineHeight: 18, marginBottom: 8 },
  addressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, opacity: 0.8 },
  addressText: { ...typography.labelSm, fontSize: 11, color: colors.primary, marginLeft: 4, fontWeight: '600' },
  emptyText: { textAlign: 'center', opacity: 0.5, marginTop: 20, color: colors.onSurface },
  emergencyOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  emergencyCard: { width: '100%', backgroundColor: colors.surfaceContainerHighest, borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: colors.tertiary },
  emergencyTitle: { ...typography.headlineSm, color: colors.tertiary, marginTop: 16, fontWeight: '900', letterSpacing: 2 },
  emergencyName: { ...typography.headlineSm, color: colors.onSurface, marginTop: 8, fontSize: 28, textAlign: 'center' },
  emergencyAddressContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24, backgroundColor: 'rgba(255, 255, 255, 0.05)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  emergencyAddress: { ...typography.bodyMd, color: colors.onSurface, marginLeft: 8, flexShrink: 1, fontSize: 14 },
  emergencyButton: { backgroundColor: colors.tertiary, width: '100%', paddingVertical: 20, borderRadius: 12, marginTop: 32, alignItems: 'center' },
  emergencyButtonText: { ...typography.labelSm, color: colors.onTertiary, fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  reportQuickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerHigh, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, marginTop: 24, borderWidth: 1, borderColor: colors.primary },
  reportQuickBtnText: { ...typography.labelSm, color: colors.primary, marginLeft: 8, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { ...typography.labelSm, color: colors.primary, letterSpacing: 2 },
  modalSub: { ...typography.bodyMd, color: colors.outline, fontSize: 13, marginBottom: 20 },
  modalInput: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, color: colors.onSurface, ...typography.bodyMd, minHeight: 120, textAlignVertical: 'top' },
  modalSubmit: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, marginTop: 24, alignItems: 'center' },
  modalSubmitText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '900' },
  emergencyActions: { width: '100%', marginTop: 24 },
  chatActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 12 },
  chatActionText: { ...typography.labelSm, color: colors.primary, fontSize: 10, marginLeft: 4, fontWeight: '800' },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  locationBadgeLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: colors.outline,
    textTransform: 'uppercase',
  },
  locationBadgeAddr: {
    ...typography.bodyMd,
    fontSize: 13,
    color: colors.onSurface,
    marginTop: 2,
  },
  selectModeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  selectModeBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: colors.tertiary,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 'auto',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  betaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
    opacity: 0.9,
  },
  betaBadgeText: {
    color: colors.onPrimary,
    fontSize: 8,
    fontWeight: '900',
  },
  betaModalCard: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  betaIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  betaModalTitle: {
    ...typography.headlineSm,
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 16,
  },
  betaModalText: {
    ...typography.bodyMd,
    color: colors.onSurface,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: 30,
  },
  betaModalBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  betaModalBtnText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
