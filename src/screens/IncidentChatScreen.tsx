import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePopup } from '../components/ImagePopup';

export const IncidentChatScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { alertId, alertTitle, alertCreatedAt } = route.params as { alertId: string; alertTitle: string; alertCreatedAt?: string };
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const getTimeRemaining = (): string => {
    if (!alertCreatedAt) return '';
    const expiresAt = new Date(alertCreatedAt).getTime() + 24 * 60 * 60 * 1000;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'ENCERRADO';
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const timeLeft = getTimeRemaining();
  const isUrgent = alertCreatedAt && (new Date(alertCreatedAt).getTime() + 23 * 60 * 60 * 1000) < Date.now();

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('incident_messages')
        .select(`*, profiles (full_name, avatar_url)`)
        .eq('alert_id', alertId)
        .order('created_at', { ascending: true });
      if (!error && data) setMessages(data);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão Negada', 'Precisamos de acesso à câmera.');
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
      if (!result.canceled && result.assets?.length > 0) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch { Alert.alert('Erro', 'Não foi possível abrir a câmera.'); }
  };

  const uploadImage = async (uri: string) => {
    try {
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
      const filePath = `chat/${fileName}`;
      const formData = new FormData();
      formData.append('files', { uri, name: fileName, type: `image/${fileExt}` } as any);
      const { error: uploadError } = await supabase.storage.from('chat').upload(filePath, formData);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat').getPublicUrl(filePath);
      return publicUrl;
    } catch (e) {
      console.error('Chat upload error:', e);
      return null;
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedImage) return;
    if (!user) return;

    let imageUrl = null;
    if (selectedImage) {
      setUploadingImage(true);
      imageUrl = await uploadImage(selectedImage);
      setUploadingImage(false);
      if (!imageUrl) return Alert.alert('Erro', 'Não foi possível enviar a imagem.');
    }

    const msgText = newMessage.trim();
    setNewMessage('');
    setSelectedImage(null);

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      alert_id: alertId,
      user_id: user.id,
      message: msgText,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      sending: true,
      profiles: { full_name: profile?.full_name, avatar_url: profile?.avatar_url }
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data, error } = await supabase
      .from('incident_messages')
      .insert({ alert_id: alertId, user_id: user.id, message: msgText, image_url: imageUrl })
      .select(`*, profiles (full_name, avatar_url)`)
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Erro', 'Falha ao enviar mensagem.');
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }
  };

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat_${alertId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'incident_messages',
        filter: `alert_id=eq.${alertId}`
      }, async (payload) => {
        if (payload.new.user_id !== user?.id) {
          const { data: profileData } = await supabase
            .from('profiles').select('full_name, avatar_url')
            .eq('id', payload.new.user_id).single();
          const fullMsg = { ...payload.new, profiles: profileData };
          setMessages(prev => {
            if (prev.find((m: any) => m.id === (fullMsg as any).id)) return prev;
            return [...prev, fullMsg];
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [alertId]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>SALA DE CRISE</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{alertTitle}</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
          {timeLeft ? (
            <Text style={[styles.countdownText, isUrgent && { color: '#ff6b63' }]}>
              {' '}⏱ {timeLeft}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.user_id === user?.id;
            const firstName = item.profiles?.full_name?.split(' ')[0] || 'Vizinho';
            return (
              <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                {/* Avatar — only on other side */}
                {!isMe && (
                  <View style={styles.avatarWrap}>
                    {item.profiles?.avatar_url ? (
                      <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Ionicons name="person" size={14} color={colors.outline} />
                      </View>
                    )}
                  </View>
                )}

                <View style={[styles.msgContent, isMe ? styles.msgContentMe : styles.msgContentOther]}>
                  {/* Sender name */}
                  {!isMe && (
                    <Text style={styles.senderName}>{firstName}</Text>
                  )}

                  {/* Bubble */}
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther, item.sending && { opacity: 0.5 }]}>
                    {item.image_url && (
                      <Pressable onPress={() => setViewingImage(item.image_url)}>
                        <Image
                          source={{ uri: item.image_url }}
                          style={styles.msgImage}
                          contentFit="cover"
                          transition={200}
                        />
                      </Pressable>
                    )}
                    {item.message ? (
                      <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                        {item.message}
                      </Text>
                    ) : null}
                  </View>

                  {/* Time */}
                  <Text style={[styles.timeText, isMe ? styles.timeTextMe : styles.timeTextOther]}>
                    {fmtTime(item.created_at)}{item.sending ? ' ···' : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Input area */}
      <View style={styles.inputSection}>
        {selectedImage && (
          <View style={styles.previewBar}>
            <Image source={{ uri: selectedImage }} style={styles.previewThumb} contentFit="cover" />
            <Text style={styles.previewLabel}>Foto pronta para enviar</Text>
            <Pressable onPress={() => setSelectedImage(null)} style={styles.previewClose}>
              <MaterialIcons name="close" size={16} color={colors.outline} />
            </Pressable>
          </View>
        )}
        <View style={styles.inputRow}>
          <Pressable style={styles.cameraBtn} onPress={handlePickImage} disabled={uploadingImage}>
            {uploadingImage
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <MaterialIcons name="photo-camera" size={22} color={colors.primary} />
            }
          </Pressable>
          <TextInput
            style={styles.input}
            placeholder="Mensagem..."
            placeholderTextColor={colors.outline}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendBtn, (!newMessage.trim() && !selectedImage) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={uploadingImage || (!newMessage.trim() && !selectedImage)}
          >
            <MaterialIcons name="send" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>

      {/* Fullscreen image viewer — same as Mural */}
      <ImagePopup
        visible={!!viewingImage}
        imageUri={viewingImage}
        onClose={() => setViewingImage(null)}
        fullscreen
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { marginRight: 12, padding: 4 },
  headerTitle: { ...typography.labelSm, color: colors.tertiary, letterSpacing: 2, fontSize: 9 },
  headerSub: { ...typography.bodyMd, color: colors.onSurface, fontSize: 14, fontWeight: '700', marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderWidth: 1, borderColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 6 },
  liveText: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  countdownText: { color: colors.primary, fontSize: 9, fontWeight: '700' },

  // List
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8 },

  // Message rows
  msgRow: { flexDirection: 'row', marginBottom: 14, maxWidth: '82%' },
  msgRowMe: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  msgRowOther: { alignSelf: 'flex-start' },

  avatarWrap: { marginRight: 8, marginTop: 18 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: { backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center' },

  msgContent: { flex: 1 },
  msgContentMe: { alignItems: 'flex-end' },
  msgContentOther: { alignItems: 'flex-start' },

  senderName: {
    ...typography.labelSm,
    fontSize: 10,
    color: colors.primary,
    marginBottom: 3,
    marginLeft: 2,
    fontWeight: '700',
  },

  bubble: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '100%',
    borderWidth: 1,
  },
  bubbleMe: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: 'rgba(52, 199, 89, 0.18)',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceContainerLow,
    borderColor: 'rgba(255,255,255,0.06)',
    borderBottomLeftRadius: 4,
  },

  msgImage: {
    width: 220,
    height: 150,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: colors.surfaceContainerHigh,
  },
  msgText: { ...typography.bodyMd, fontSize: 14, lineHeight: 20 },
  msgTextMe: { color: colors.onSurface },
  msgTextOther: { color: colors.onSurface },

  timeText: { fontSize: 9, marginTop: 3, color: colors.outline, opacity: 0.6, letterSpacing: 0.5 },
  timeTextMe: { textAlign: 'right', marginRight: 2 },
  timeTextOther: { textAlign: 'left', marginLeft: 2 },

  // Input
  inputSection: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  previewThumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.surfaceContainerHigh },
  previewLabel: { flex: 1, ...typography.labelSm, color: colors.outline, marginLeft: 10, fontSize: 11 },
  previewClose: { padding: 6 },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10 },
  cameraBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: colors.onSurface,
    maxHeight: 120,
    ...typography.bodyMd,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
