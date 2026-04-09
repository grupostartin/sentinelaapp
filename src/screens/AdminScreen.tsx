import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';

export const AdminScreen = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'denuncias' | 'usuarios' | 'notificacoes'>('denuncias');
  const [broadTitle, setBroadTitle] = useState('');
  const [broadBody, setBroadBody] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'denuncias') {
        const { data, error } = await supabase
          .from('reports')
          .select(`
            *,
            reporter:reporter_id(full_name),
            post:post_id(*, profiles(full_name, avatar_url))
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setReports(data || []);
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        if (error) throw error;
        setUsers(data || []);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tab]);

  const handleAction = async (report: any, action: 'delete' | 'dismiss') => {
    try {
      if (action === 'delete') {
        // Delete post
        const { error: postError } = await supabase.from('mural_posts').delete().eq('id', report.post_id);
        if (postError) throw postError;
        // Mark report as resolved
        await supabase.from('reports').update({ status: 'resolved' }).eq('id', report.id);
        Alert.alert('Sucesso', 'Postagem removida.');
      } else {
        // Dismiss report
        await supabase.from('reports').update({ status: 'dismissed' }).eq('id', report.id);
      }
      fetchData();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  const toggleBlock = async (userProfile: any) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: !userProfile.is_blocked })
        .eq('id', userProfile.id);
      if (error) throw error;
      Alert.alert('Sucesso', `Usuário ${!userProfile.is_blocked ? 'bloqueado' : 'desbloqueado'}.`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    }
  };

  const sendBroadcast = async () => {
    if (!broadTitle || !broadBody) return Alert.alert('Erro', 'Preencha título e mensagem.');
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('broadcast-notification', {
        body: { title: broadTitle, body: broadBody }
      });
      if (error) throw error;
      Alert.alert('Sucesso', `Notificação enviada para ${data.sent} aparelhos.`);
      setBroadTitle('');
      setBroadBody('');
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.headlineSm, styles.title]}>ADMINISTRAÇÃO</Text>
      </View>

      <View style={styles.tabContainer}>
        <Pressable 
          style={[styles.tab, tab === 'denuncias' && styles.activeTab]} 
          onPress={() => setTab('denuncias')}
        >
          <Text style={[styles.tabText, tab === 'denuncias' && styles.activeTabText]}>DENÚNCIAS</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, tab === 'usuarios' && styles.activeTab]} 
          onPress={() => setTab('usuarios')}
        >
          <Text style={[styles.tabText, tab === 'usuarios' && styles.activeTabText]}>USUÁRIOS</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, tab === 'notificacoes' && styles.activeTab]} 
          onPress={() => setTab('notificacoes')}
        >
          <Text style={[styles.tabText, tab === 'notificacoes' && styles.activeTabText]}>AVISOS</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : tab === 'denuncias' ? (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.reporterName}>DENUNCIADO POR: {item.reporter?.full_name}</Text>
                <Text style={styles.reason}>MOTIVO: {item.reason}</Text>
              </View>
              {item.post ? (
                <View style={styles.postPreview}>
                  <View style={styles.postHeader}>
                    <Text style={styles.author}>{item.post.profiles?.full_name}</Text>
                    <Text style={styles.postContent}>{item.post.content}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.deletedMsg}>Conteúdo já deletado ou indisponível.</Text>
              )}
              <View style={styles.cardActions}>
                <Pressable style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleAction(item, 'delete')}>
                  <Text style={styles.actionBtnText}>DELETAR POST</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, styles.dismissBtn]} onPress={() => handleAction(item, 'dismiss')}>
                  <Text style={styles.actionBtnText}>DESCARTAR</Text>
                </Pressable>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma denúncia pendente.</Text>}
          contentContainerStyle={styles.list}
        />
      ) : tab === 'usuarios' ? (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <View style={styles.avatar}>
                   {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.img} /> : <Ionicons name="person" size={20} color={colors.outline} />}
                </View>
                <View>
                  <Text style={styles.userName}>{item.full_name}</Text>
                  <Text style={styles.userNeighborhood}>{item.neighborhood}</Text>
                </View>
              </View>
              <Pressable 
                style={[styles.blockBtn, item.is_blocked && styles.unblockBtn]} 
                onPress={() => toggleBlock(item)}
              >
                <Text style={styles.blockBtnText}>{item.is_blocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}</Text>
              </Pressable>
            </View>
          )}
          contentContainerStyle={styles.list}
        />
      ) : (
        <View style={styles.broadcastContainer}>
          <Text style={styles.broadcastLabel}>TÍTULO DA NOTIFICAÇÃO</Text>
          <TextInput
            style={styles.broadcastInput}
            placeholder="Ex: Novo recurso disponível!"
            placeholderTextColor={colors.outline}
            value={broadTitle}
            onChangeText={setBroadTitle}
          />
          <Text style={styles.broadcastLabel}>MENSAGEM (PUSH)</Text>
          <TextInput
            style={[styles.broadcastInput, styles.textArea]}
            placeholder="Digite o texto que todos os usuários receberão..."
            placeholderTextColor={colors.outline}
            multiline
            numberOfLines={4}
            value={broadBody}
            onChangeText={setBroadBody}
          />
          <Pressable 
            style={[styles.sendBroadBtn, sending && { opacity: 0.5 }]} 
            onPress={sendBroadcast}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.sendBroadBtnText}>DISPARAR PARA TODOS</Text>}
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 20 },
  title: { color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { ...typography.labelSm, color: colors.outline },
  activeTabText: { color: colors.primary, fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 24, paddingBottom: 100 },
  card: { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: colors.tertiary },
  cardHeader: { marginBottom: 12 },
  reporterName: { fontSize: 10, color: colors.outline, fontWeight: '700' },
  reason: { fontSize: 12, color: colors.onSurface, marginTop: 4, fontWeight: '800' },
  postPreview: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, marginBottom: 16 },
  postHeader: { marginBottom: 4 },
  author: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  postContent: { fontSize: 13, color: colors.onSurface, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  deleteBtn: { backgroundColor: colors.tertiary },
  dismissBtn: { backgroundColor: colors.surfaceContainerHigh },
  actionBtnText: { fontSize: 10, color: colors.onSurface, fontWeight: '900' },
  userCard: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  userName: { color: colors.onSurface, fontWeight: '700', fontSize: 14 },
  userNeighborhood: { color: colors.outline, fontSize: 11 },
  blockBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.tertiaryContainer },
  unblockBtn: { backgroundColor: '#4CAF50' },
  blockBtnText: { color: colors.onSurface, fontSize: 10, fontWeight: '900' },
  emptyText: { textAlign: 'center', color: colors.outline, marginTop: 40 },
  deletedMsg: { fontSize: 12, color: colors.outline, fontStyle: 'italic', marginBottom: 16 },
  broadcastContainer: { padding: 24 },
  broadcastLabel: { ...typography.labelSm, color: colors.primary, marginBottom: 8, marginTop: 16, letterSpacing: 1 },
  broadcastInput: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, color: colors.onSurface, ...typography.bodyMd, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  textArea: { height: 120, textAlignVertical: 'top' },
  sendBroadBtn: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 12, marginTop: 32, alignItems: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  sendBroadBtnText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '900', letterSpacing: 2 },
});
