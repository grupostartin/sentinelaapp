import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export const VizinhosScreen = () => {
  const { profile, user } = useAuth();
  const [vizinhos, setVizinhos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportingUser, setReportingUser] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<any>(null);

  const fetchVizinhos = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id)
        .eq('neighborhood', profile?.neighborhood);

      if (error) throw error;
      setVizinhos(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVizinhos();

    // Track online presence
    const ch = supabase.channel('online-users-vizinhos', { config: { presence: { key: user?.id } } });
    presenceChannelRef.current = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const ids = new Set<string>(
        Object.values(state).flatMap((presences: any) => presences.map((p: any) => p.user_id))
      );
      setOnlineIds(ids);
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ user_id: user?.id, neighborhood: profile?.neighborhood });
      }
    });

    return () => {
      supabase.removeChannel(ch);
    };
  }, [profile?.neighborhood]);

  const submitReport = async () => {
    if (!reportReason.trim() || !reportingUser) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user?.id,
        reported_user_id: reportingUser.id,
        reason: reportReason
      });
      if (error) throw error;
      setReportingUser(null);
      setReportReason('');
      Alert.alert("Sucesso", "O usuário foi denunciado para a moderação.");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível enviar a denúncia.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const onlineCount = onlineIds.size;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.headlineSm, styles.title]}>VIZINHOS</Text>
          <Text style={styles.subtitle}>{profile?.neighborhood?.toUpperCase() || 'MEU BAIRRO'}</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineBadgeText}>{onlineCount} online</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={vizinhos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const isOnline = onlineIds.has(item.id);
            return (
              <View style={styles.card}>
                <View style={styles.userInfo}>
                  <View style={styles.avatarWrap}>
                    <View style={styles.avatar}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={24} color={colors.outline} />
                      )}
                    </View>
                    {isOnline && <View style={styles.onlineBadgeDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{item.full_name || 'Vizinho'}</Text>
                    <Text style={[styles.userStatus, isOnline && styles.userStatusOnline]}>
                      {isOnline ? '● Online agora' : 'Sentinela Ativo'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setReportingUser(item)} style={styles.reportBtn}>
                    <Ionicons name="flag-outline" size={20} color={colors.outline} />
                  </Pressable>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyMsg}>Nenhum vizinho encontrado neste bairro ainda.</Text>
          }
        />
      )}

      {/* Reporting Modal */}
      <Modal visible={!!reportingUser} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>DENUNCIAR PERFIL</Text>
            <Text style={[typography.bodyMd, { color: colors.outline, textAlign: 'center', marginBottom: 20 }]}>
              Por que você deseja denunciar este Sentinela?
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Descreva o motivo..."
              placeholderTextColor={colors.outline}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <Pressable 
              style={[styles.mainBtn, { backgroundColor: colors.primary, marginTop: 24 }]} 
              onPress={submitReport}
              disabled={submittingReport}
            >
              {submittingReport ? <ActivityIndicator color={colors.onPrimary} /> : (
                <Text style={styles.btnText}>ENVIAR DENÚNCIA</Text>
              )}
            </Pressable>
            <Pressable style={[styles.mainBtn, { marginTop: 12 }]} onPress={() => setReportingUser(null)}>
              <Text style={[styles.btnText, { color: colors.outline }]}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: colors.outline, fontSize: 10, letterSpacing: 1, marginTop: 4 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(86, 228, 114, 0.08)', borderWidth: 1, borderColor: 'rgba(86, 228, 114, 0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  onlineBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '700', marginLeft: 6 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.8, shadowRadius: 4, elevation: 4 },
  card: { backgroundColor: colors.surfaceContainerLow, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  onlineBadgeDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.surfaceContainerLow },
  userName: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  userStatus: { ...typography.labelSm, color: colors.outline, fontSize: 10, marginTop: 2 },
  userStatusOnline: { color: colors.primary },
  reportBtn: { padding: 8 },
  emptyMsg: { textAlign: 'center', color: colors.outline, marginTop: 40, ...typography.bodyMd },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.outline },
  modalTitle: { ...typography.labelSm, color: colors.primary, textAlign: 'center', marginBottom: 10, letterSpacing: 2 },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, color: colors.onSurface, minHeight: 100, textAlignVertical: 'top' },
  mainBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { ...typography.labelSm, fontWeight: '900' }
});
