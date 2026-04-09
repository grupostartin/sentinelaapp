import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList, Alert } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BH_NEIGHBORHOODS } from '../constants/neighborhoods';
import { ImagePopup } from '../components/ImagePopup';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export const MuralScreen = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotoFullscreen, setSelectedPhotoFullscreen] = useState(false);

  const [reportingPost, setReportingPost] = useState<any | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [locatingNeighborhood, setLocatingNeighborhood] = useState(false);

  const handleReport = (post: any) => {
    setReportingPost(post);
  };

  const submitReport = async () => {
    if (!reportReason.trim() || !reportingPost) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user?.id,
        post_id: reportingPost.id,
        reported_user_id: reportingPost.user_id,
        reason: reportReason
      });
      if (error) throw error;
      setReportingPost(null);
      setReportReason('');
      Alert.alert("Sucesso", "Sua denúncia foi enviada para análise.");
    } catch (e) {
      Alert.alert("Erro", "Não foi possível enviar a denúncia.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão Negada', 'Precisamos de acesso à câmera.');
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) { Alert.alert('Erro', 'Não foi possível abrir a câmera.'); }
  };

  const handleDetectNeighborhood = async () => {
    setLocatingNeighborhood(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão Negada', 'Precisamos de acesso à localização.');
      
      // Use last known position first (instant) — falls back to live GPS only if needed
      let loc = await Location.getLastKnownPositionAsync();
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      }

      const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (rev.length > 0) {
        const district = rev[0].district || rev[0].subregion || '';
        const match = BH_NEIGHBORHOODS.find(n =>
          n.toLowerCase().includes(district.toLowerCase()) ||
          district.toLowerCase().includes(n.toLowerCase())
        );
        if (match) {
          await updateNeighborhood(match);
          Alert.alert('Bairro Detectado', `Bairro definido como: ${match}`);
        } else {
          Alert.alert('Não encontrado', `Bairro detectado: "${district}". Selecione manualmente na lista.`);
        }
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível detectar sua localização.');
    } finally {
      setLocatingNeighborhood(false);
    }
  };
  
  const uploadImage = async (uri: string) => {
    try {
      const fileExt = uri.split('.').pop();
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `mural/${fileName}`;
      
      const formData = new FormData();
      formData.append('files', { uri, name: fileName, type: `image/${fileExt}` } as any);
      
      const { error: uploadError } = await supabase.storage.from('mural').upload(filePath, formData);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('mural').getPublicUrl(filePath);
      return publicUrl;
    } catch (e) {
      console.error("Upload error:", e);
      return null;
    }
  };

  const handleDeletePost = async (id: string) => {
    Alert.alert(
      "Excluir Postagem",
      "Deseja remover esta postagem do mural?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Excluir", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.from('mural_posts').delete().eq('id', id);
            if (error) Alert.alert("Erro", error.message);
            else fetchPosts();
          }
        }
      ]
    );
  };

  const filteredNeighborhoods = BH_NEIGHBORHOODS.filter(n => 
    n.toLowerCase().includes(search.toLowerCase())
  );

  const fetchPosts = async () => {
    console.log("Mural: Fetching for neighborhood:", profile?.neighborhood);
    if (!profile?.neighborhood) {
      console.log("Mural: No neighborhood in profile.");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('mural_posts')
        .select(`
          *,
          profiles (
            full_name,
            avatar_url,
            created_at
          )
        `)
        .eq('neighborhood', profile.neighborhood)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Mural: Fetch error:", error);
        throw error;
      }
      
      console.log(`Mural: Found ${data?.length} posts.`);
      if (data) setPosts(data);
    } catch (e: any) {
      Alert.alert("Erro ao carregar", e.message);
    }
  };

  useEffect(() => {
    if (!profile?.neighborhood) return;
    
    fetchPosts();
    
    const channel = supabase
      .channel(`mural-${profile.neighborhood}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'mural_posts',
          filter: `neighborhood=eq.${profile.neighborhood}`
        }, 
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.neighborhood]);

  const handlePost = async () => {
    if (!newPost.trim()) return;
    
    if (!profile?.neighborhood) {
      return Alert.alert("Perfil Incompleto", "Selecione seu bairro no topo antes de postar.");
    }

    setLoading(true);
    let imageUrl = null;
    if (selectedImage) {
      setUploadingImage(true);
      imageUrl = await uploadImage(selectedImage);
      setUploadingImage(false);
      if (!imageUrl) {
        setLoading(false);
        return Alert.alert("Erro", "Não foi possível enviar a imagem.");
      }
    }

    try {
      const { error } = await supabase.from('mural_posts').insert({
        user_id: user?.id,
        content: newPost,
        neighborhood: profile.neighborhood,
        city: 'Belo Horizonte',
        type: 'observation',
        image_url: imageUrl
      });
      if (error) throw error;
      setNewPost('');
      setSelectedImage(null);
      fetchPosts();
    } catch (error: any) {
      Alert.alert("Erro ao postar", error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateNeighborhood = async (name: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ neighborhood: name }).eq('id', user?.id);
      if (error) throw error;
      setShowPicker(false);
      await refreshProfile();
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const getTimeOnPlatform = (createdAt: string) => {
    const days = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days < 1) return 'Hoje';
    if (days < 30) return `${days}d`;
    const months = Math.floor(days / 30);
    return `${months}m`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.headlineSm, styles.title]}>MURAL</Text>
        <Pressable style={styles.neighborhoodBadge} onPress={() => setShowPicker(true)}>
          <MaterialIcons name="location-on" size={12} color={colors.primary} />
          <Text style={styles.neighborhoodText}>
            {profile?.neighborhood?.toUpperCase() || 'SELECIONAR BAIRRO'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={14} color={colors.outline} style={{ marginLeft: 4 }} />
        </Pressable>
      </View>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>MUDAR BAIRRO DE ATUAÇÃO</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.outline} />
              <TextInput
                style={styles.searchField}
                placeholder="Buscar bairro..."
                placeholderTextColor={colors.outline}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <Pressable 
              style={styles.detectLocationBtn} 
              onPress={handleDetectNeighborhood}
              disabled={locatingNeighborhood}
            >
              {locatingNeighborhood 
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <MaterialIcons name="my-location" size={16} color={colors.primary} />
              }
              <Text style={styles.detectLocationText}>
                {locatingNeighborhood ? 'DETECTANDO...' : 'USAR LOCALIZAÇÃO EXATA'}
              </Text>
            </Pressable>
            <FlatList
              data={filteredNeighborhoods}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable style={styles.item} onPress={() => { updateNeighborhood(item); setSearch(''); }}>
                  <Text style={styles.itemText}>{item}</Text>
                  {profile?.neighborhood === item && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyMsg}>Bairro não encontrado.</Text>}
            />
            <Pressable style={styles.closeBtn} onPress={() => { setShowPicker(false); setSearch(''); }}>
              <Text style={styles.closeBtnText}>FECHAR</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView 
        style={styles.feed}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
      {/* Reporting Modal */}
      <Modal visible={!!reportingPost} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>DENUNCIAR CONTEÚDO</Text>
            <Text style={[typography.bodyMd, { color: colors.outline, textAlign: 'center', marginBottom: 20 }]}>
              Selecione o motivo da denúncia:
            </Text>
            
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
              {['SPAM', 'OFENSIVO', 'FALSO ALERTA', 'OUTRO'].map(cat => (
                <Pressable 
                  key={cat}
                  style={[{ padding: 8, borderWidth: 1, borderColor: colors.outline, borderRadius: 8, margin: 4 }, reportReason.startsWith(cat) && { backgroundColor: colors.primaryContainer, borderColor: colors.primary }]}
                  onPress={() => setReportReason(cat + ': ')}
                >
                  <Text style={{ color: colors.onSurface, fontSize: 10 }}>{cat}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={[styles.searchField, { minHeight: 80 }]}
              placeholder="Descreva detalhes..."
              placeholderTextColor={colors.outline}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <Pressable 
              style={[styles.closeBtn, { backgroundColor: colors.primary, marginTop: 24 }]} 
              onPress={submitReport}
              disabled={submittingReport}
            >
              {submittingReport ? <ActivityIndicator color={colors.onPrimary} /> : (
                <Text style={[styles.closeBtnText, { color: colors.onPrimary }]}>ENVIAR DENÚNCIA</Text>
              )}
            </Pressable>
            <Pressable style={[styles.closeBtn, { marginTop: 12 }]} onPress={() => setReportingPost(null)}>
              <Text style={styles.closeBtnText}>CANCELAR</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.postInputSection}>
        {selectedImage && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.previewImg} />
            <Pressable style={styles.removePreview} onPress={() => setSelectedImage(null)}>
              <MaterialIcons name="close" size={16} color="white" />
            </Pressable>
          </View>
        )}
        <View style={styles.postInputContainer}>
          <Pressable style={styles.attachButton} onPress={handlePickImage}>
            <MaterialIcons name="photo-camera" size={20} color={colors.primary} />
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Compartilhar observação..."
            placeholderTextColor={colors.outline}
            multiline
            value={newPost}
            onChangeText={setNewPost}
          />
          <Pressable style={styles.sendButton} onPress={handlePost} disabled={loading || uploadingImage}>
            {loading || uploadingImage ? <ActivityIndicator size="small" color={colors.onPrimary} /> : (
              <MaterialIcons name="send" size={20} color={colors.onPrimary} />
            )}
          </Pressable>
        </View>
      </View>

        {posts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={colors.outline} style={{ opacity: 0.3 }} />
            <Text style={styles.emptyMsg}>
              Nenhuma postagem no bairro {profile?.neighborhood || 'selecionado'}.{'\n'}
              Seja o primeiro a relatar algo aqui!
            </Text>
          </View>
        ) : posts.map((post) => (
          <View key={post.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.userInfo}>
                <Pressable 
                  style={styles.avatar} 
                  onPress={() => { if (post.profiles?.avatar_url) { setSelectedPhotoFullscreen(false); setSelectedPhoto(post.profiles.avatar_url); } }}
                >
                  {post.profiles?.avatar_url ? (
                    <Image 
                      source={{ uri: post.profiles.avatar_url }} 
                      style={styles.avatarImg} 
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons name="person" size={16} color={colors.outline} />
                  )}
                </Pressable>
                <View>
                  <Text style={styles.userName}>{post.profiles?.full_name || 'Vizinho'}</Text>
                  <View style={styles.seniorityBadge}>
                    <Text style={styles.seniorityText}>
                      Sentinela há {getTimeOnPlatform(post.profiles?.created_at)}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.cardHeaderRight}>
                <Text style={styles.time}>
                  {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {profile?.is_admin ? (
                    <Pressable onPress={() => handleDeletePost(post.id)} style={styles.reportBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.tertiary} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => handleReport(post)} style={styles.reportBtn}>
                      <Ionicons name="flag-outline" size={14} color={colors.outline} />
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
            <Text style={styles.cardContent}>{post.content}</Text>
            {post.image_url && (
              <Pressable onPress={() => { setSelectedPhotoFullscreen(true); setSelectedPhoto(post.image_url); }}>
                <Image 
                  source={{ uri: post.image_url }} 
                  style={styles.cardImg} 
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      <ImagePopup 
        visible={!!selectedPhoto} 
        imageUri={selectedPhoto} 
        onClose={() => setSelectedPhoto(null)}
        fullscreen={selectedPhotoFullscreen}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    color: colors.primary,
    fontWeight: '900',
    letterSpacing: 2,
  },
  neighborhoodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  neighborhoodText: {
    ...typography.labelSm,
    color: colors.outline,
    marginLeft: 4,
    fontSize: 10,
    letterSpacing: 1,
  },
  feed: {
    paddingHorizontal: 16,
  },
  postInputSection: {
    marginBottom: 24,
  },
  previewContainer: {
    marginBottom: 8,
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  previewImg: {
    width: '100%',
    height: '100%',
  },
  removePreview: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachButton: {
    padding: 10,
    marginRight: 4,
  },
  postInputContainer: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    ...typography.bodyMd,
    color: colors.onSurface,
    maxHeight: 100,
    paddingTop: 0,
  },
  sendButton: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: 8,
    marginLeft: 12,
  },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryFixed,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportBtn: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  userName: {
    ...typography.labelSm,
    color: colors.primary,
    fontWeight: '700',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerHigh,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  seniorityBadge: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  seniorityText: {
    fontSize: 8,
    color: colors.outline,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  time: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.outline,
  },
  cardContent: {
    ...typography.bodyMd,
    color: colors.onSurface,
    lineHeight: 20,
    marginTop: 12,
  },
  cardImg: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: colors.surfaceContainerHigh,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  modalTitle: {
    ...typography.labelSm,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 2,
  },
  item: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemText: {
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  closeBtn: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceContainerLow,
    alignItems: 'center',
  },
  closeBtnText: {
    ...typography.labelSm,
    color: colors.primary,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchField: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 12,
    ...typography.bodyMd,
    color: colors.onSurface,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyMsg: {
    ...typography.bodyMd,
    color: colors.outline,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 24,
    lineHeight: 20,
    opacity: 0.6,
  },
  detectLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(86, 228, 114, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(86, 228, 114, 0.3)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  detectLocationText: {
    ...typography.labelSm,
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 8,
    fontSize: 11,
  },
});
