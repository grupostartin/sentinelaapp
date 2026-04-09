import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { Image } from 'expo-image';

const CATEGORIES = [
  { id: 'all', label: 'Tudo', icon: 'grid-view' },
  { id: 'tools', label: 'Ferramentas', icon: 'hand-repair' },
  { id: 'transport', label: 'Transporte', icon: 'directions-car' },
  { id: 'pets', label: 'Pets', icon: 'pets' },
  { id: 'food', label: 'Alimentos', icon: 'restaurant' },
  { id: 'services', label: 'Serviços', icon: 'engineering' },
];

const BoostOption = ({ days, price, selected, onPress }: any) => (
  <Pressable style={[styles.boostOpt, selected && styles.boostOptActive]} onPress={onPress}>
    <Text style={[styles.boostDays, selected && { color: colors.onPrimary }]}>{days} {days === 1 ? 'DIA' : 'DIAS'}</Text>
    <Text style={[styles.boostPrice, selected && { color: 'rgba(255,255,255,0.8)' }]}>R$ {price}</Text>
  </Pressable>
);

export const FavoresScreen = () => {
  const navigation = useNavigation<any>();
  const { profile, user } = useAuth();
  const [favors, setFavors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [type, setType] = useState<'need' | 'offer'>('need');
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('tools');
  const [boostPlan, setBoostPlan] = useState<number | null>(null); // null, 1, 7, 30
  const [submitting, setSubmitting] = useState(false);

  const fetchFavors = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('favors')
        .select(`*, profiles (full_name, avatar_url, subscription_status)`)
        .eq('status', 'active')
        .eq('neighborhood', profile?.neighborhood || '')
        .order('boost_expires_at', { ascending: false, nullsFirst: false })
        .order('is_verified_provider', { ascending: false })
        .order('created_at', { ascending: false });

      if (filter !== 'all') query = query.eq('category', filter);
      query = query.eq('type', type);

      const { data, error } = await query;
      if (error) throw error;
      setFavors(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.neighborhood) fetchFavors();
  }, [profile?.neighborhood, filter, type]);

  const handleCreateFavor = async () => {
    if (!title || !description || !category) return Alert.alert('Erro', 'Preencha todos os campos.');
    
    if (boostPlan) {
      Alert.alert(
        'Checkout do Stripe',
        `Você selecionou o plano de ${boostPlan} ${boostPlan === 1 ? 'dia' : 'dias'}.\n\nValor: R$ ${boostPlan === 1 ? '4,90' : boostPlan === 7 ? '29,90' : '59,90'}\n\nDeseja realizar o pagamento agora?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Publicar sem Destaque', onPress: () => finalizePost(false) },
          { text: 'Simular Pagamento', onPress: () => finalizePost(true) },
        ]
      );
    } else {
      finalizePost(false);
    }
  };

  const finalizePost = async (wasPaid: boolean) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from('favors').insert({
        user_id: user?.id,
        type,
        category,
        title,
        description,
        neighborhood: profile?.neighborhood || '',
        is_verified_provider: profile?.subscription_status === 'verified_provider' || wasPaid,
        boost_expires_at: wasPaid ? new Date(Date.now() + (boostPlan || 0) * 24 * 60 * 60 * 1000).toISOString() : null,
      });
      if (error) throw error;
      setModalVisible(false);
      setTitle('');
      setDescription('');
      setBoostPlan(null);
      fetchFavors();
      if (wasPaid) Alert.alert('Sucesso!', 'Seu anúncio foi publicado com destaque no topo!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível publicar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFavor = async (id: string) => {
    Alert.alert(
      'Excluir Anúncio',
      'Tem certeza que deseja remover este anúncio permanentemente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('favors').delete().eq('id', id);
              if (error) throw error;
              fetchFavors();
              Alert.alert('Sucesso', 'Anúncio removido.');
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível excluir.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const isBoosted = item.boost_expires_at && new Date(item.boost_expires_at) > new Date();
    
    return (
      <View style={[styles.card, (item.is_verified_provider || isBoosted) && styles.verifiedCard]}>
        {(item.is_verified_provider || isBoosted) && (
          <View style={[styles.verifiedBadge, isBoosted && { backgroundColor: '#FFD700' }]}>
            <MaterialIcons name={isBoosted ? "stars" : "verified"} size={14} color={isBoosted ? "#000" : colors.onPrimary} />
            <Text style={[styles.verifiedBadgeText, isBoosted && { color: "#000" }]}>
              {isBoosted ? 'DESTAQUE' : 'VERIFICADO'}
            </Text>
          </View>
        )}
        
        <View style={styles.cardHeader}>
          <View style={styles.userSection}>
            <Image source={{ uri: item.profiles?.avatar_url }} style={styles.avatar} />
            <Text style={styles.userName}>{item.profiles?.full_name?.split(' ')[0]}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.timeText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            {(profile?.is_admin || item.user_id === user?.id) && (
              <Pressable onPress={() => handleDeleteFavor(item.id)} style={{ marginLeft: 12 }}>
                <Ionicons name="trash-outline" size={18} color="#FF4444" />
              </Pressable>
            )}
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.categoryBadge}>
            <MaterialIcons name={CATEGORIES.find(c => c.id === item.category)?.icon as any} size={12} color={colors.primary} />
            <Text style={styles.categoryText}>{CATEGORIES.find(c => c.id === item.category)?.label}</Text>
          </View>
          <Pressable 
            style={styles.chatBtn} 
            onPress={() => {
              if (item.user_id === user?.id) return Alert.alert('Aviso', 'Você não pode contatar a si mesmo.');
              navigation.navigate('DirectChat', { 
                receiverId: item.user_id, 
                receiverName: item.profiles?.full_name,
                receiverAvatar: item.profiles?.avatar_url
              });
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color={colors.onPrimary} />
            <Text style={styles.chatBtnText}>CONTATAR</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>FAVORES E SERVIÇOS</Text>
          <Text style={styles.headerSub}>{profile?.neighborhood || 'Seu Bairro'}</Text>
        </View>
        <Pressable 
          style={styles.headerChatBtn} 
          onPress={() => navigation.navigate('ChatList')}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable 
          style={[styles.tab, type === 'need' && styles.tabActive]} 
          onPress={() => setType('need')}
        >
          <Text style={[styles.tabText, type === 'need' && styles.tabTextActive]}>PRECISO</Text>
        </Pressable>
        <Pressable 
          style={[styles.tab, type === 'offer' && styles.tabActive]} 
          onPress={() => setType('offer')}
        >
          <Text style={[styles.tabText, type === 'offer' && styles.tabTextActive]}>OFEREÇO</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {CATEGORIES.map((cat) => (
          <Pressable 
            key={cat.id} 
            style={[styles.filterBtn, filter === cat.id && styles.filterBtnActive]} 
            onPress={() => setFilter(cat.id)}
          >
            <MaterialIcons name={cat.icon as any} size={18} color={filter === cat.id ? colors.onPrimary : colors.outline} />
            <Text style={[styles.filterText, filter === cat.id && styles.filterTextActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={favors}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nenhum anúncio nesta categoria.</Text>
          }
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={30} color={colors.onPrimary} />
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>NOVO ANÚNCIO</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.outline} />
              </Pressable>
            </View>

            <ScrollView>
              <Text style={styles.label}>O que deseja fazer?</Text>
              <View style={styles.typeSelector}>
                <Pressable 
                  style={[styles.typeOption, type === 'need' && styles.typeOptionActive]} 
                  onPress={() => setType('need')}
                >
                  <Text style={[styles.typeText, type === 'need' && styles.typeTextActive]}>PRECISO DE AJUDA</Text>
                </Pressable>
                <Pressable 
                  style={[styles.typeOption, type === 'offer' && styles.typeOptionActive]} 
                  onPress={() => setType('offer')}
                >
                  <Text style={[styles.typeText, type === 'offer' && styles.typeTextActive]}>OFEREÇO SERVIÇO</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { marginTop: 24 }]}>Título do Anúncio</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Ex: Ofereço Manutenção de Ar-Condicionado" 
                placeholderTextColor={colors.outline}
                value={title}
                onChangeText={setTitle}
              />

              {type === 'offer' && (
                <View style={styles.boostSection}>
                  <Text style={[styles.label, { color: colors.primary, marginTop: 0 }]}>🚀 IMPULSIONAR ANÚNCIO (OPCIONAL)</Text>
                  <Text style={styles.boostSub}>Apareça no topo e ganhe selo de destaque.</Text>
                  
                  <View style={styles.boostOptions}>
                    <BoostOption 
                      days={1} price="4,90" 
                      selected={boostPlan === 1} 
                      onPress={() => setBoostPlan(boostPlan === 1 ? null : 1)} 
                    />
                    <BoostOption 
                      days={7} price="29,90" 
                      selected={boostPlan === 7} 
                      onPress={() => setBoostPlan(boostPlan === 7 ? null : 7)} 
                    />
                    <BoostOption 
                      days={30} price="59,90" 
                      selected={boostPlan === 30} 
                      onPress={() => setBoostPlan(boostPlan === 30 ? null : 30)} 
                    />
                  </View>
                  {boostPlan && (
                    <Text style={styles.boostTotal}>
                      Total: R$ {boostPlan === 1 ? '4,90' : boostPlan === 7 ? '29,90' : '59,90'}
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.label}>Categoria</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                  <Pressable 
                    key={cat.id} 
                    style={[styles.catItem, category === cat.id && styles.catItemActive]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <MaterialIcons name={cat.icon as any} size={20} color={category === cat.id ? colors.primary : colors.outline} />
                    <Text style={[styles.catLabel, category === cat.id && { color: colors.primary }]}>{cat.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Mais detalhes</Text>
              <TextInput 
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Descreva aqui..." 
                placeholderTextColor={colors.outline}
                multiline
                value={description}
                onChangeText={setDescription}
              />

              <Pressable 
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]} 
                onPress={handleCreateFavor}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {boostPlan ? 'CONTRATAR DESTAQUE' : 'PUBLICAR NO BAIRRO'}
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { ...typography.headlineSm, color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  headerSub: { ...typography.bodyMd, color: colors.onSurface, opacity: 0.6 },
  headerChatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { ...typography.labelSm, color: colors.outline },
  tabTextActive: { color: colors.onPrimary, fontWeight: '900' },

  filters: { maxHeight: 50, marginBottom: 16 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceContainerLow, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.labelSm, color: colors.outline, marginLeft: 8 },
  filterTextActive: { color: colors.onPrimary, fontWeight: '900' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', color: colors.outline, marginTop: 40, ...typography.bodyMd },

  card: { backgroundColor: colors.surfaceContainerLow, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  verifiedCard: { borderColor: colors.primary, borderWidth: 1.5 },
  verifiedBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  verifiedBadgeText: { color: colors.onPrimary, fontSize: 10, fontWeight: '900', marginLeft: 4 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userSection: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceContainerHigh },
  userName: { ...typography.labelSm, color: colors.onSurface, marginLeft: 8, fontWeight: '700' },
  timeText: { fontSize: 10, color: colors.outline },

  cardTitle: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '900', marginBottom: 4, textTransform: 'uppercase' },
  cardDesc: { ...typography.bodyMd, color: colors.onSurface, opacity: 0.8, fontSize: 13, lineHeight: 18, marginBottom: 16 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(52, 199, 89, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  categoryText: { color: colors.primary, fontSize: 10, fontWeight: '700', marginLeft: 4, textTransform: 'uppercase' },

  chatBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  chatBtnText: { color: colors.onPrimary, fontSize: 11, fontWeight: '900', marginLeft: 6 },

  fab: { position: 'absolute', bottom: 30, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 5 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surfaceContainerHighest, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { ...typography.labelSm, color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  
  typeSelector: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  typeOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { ...typography.labelSm, color: colors.outline, fontSize: 10, fontWeight: '700' },
  typeTextActive: { color: colors.onPrimary, fontWeight: '900' },

  label: { ...typography.labelSm, color: colors.outline, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, color: colors.onSurface, ...typography.bodyMd, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catItem: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', minWidth: '30%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  catItemActive: { borderColor: colors.primary, backgroundColor: 'rgba(52, 199, 89, 0.05)' },
  catLabel: { fontSize: 10, color: colors.outline, fontWeight: '700', marginTop: 4 },

  submitBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 32, marginBottom: 20 },
  submitBtnText: { color: colors.onPrimary, fontWeight: '900', letterSpacing: 1 },

  boostSection: { marginTop: 24, backgroundColor: 'rgba(52, 199, 89, 0.05)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.primary },
  boostSub: { fontSize: 11, color: colors.outline, marginBottom: 12 },
  boostOptions: { flexDirection: 'row', gap: 8 },
  boostOpt: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceContainerLow, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  boostOptActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  boostDays: { fontSize: 14, fontWeight: '900', color: colors.onSurface },
  boostPrice: { fontSize: 10, color: colors.outline, fontWeight: '700' },
  boostTotal: { marginTop: 12, textAlign: 'center', color: colors.primary, fontWeight: '900', fontSize: 14 },
});
