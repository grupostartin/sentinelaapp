import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';

// Regex para detectar números de telefone (formatos brasileiros comuns)
const PHONE_REGEX = /(\(?\d{2}\)?\s?)?(\d{4,5}[-\s]?\d{4})/g;

export const DirectChatScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { receiverId, receiverName, receiverAvatar } = route.params as any;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`direct_${user?.id}_${receiverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user?.id}`,
        },
        (payload) => {
          if (payload.new.sender_id === receiverId) {
            setMessages((prev) => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [receiverId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user?.id})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // BLOQUEIO DE TELEFONE
    if (PHONE_REGEX.test(inputText)) {
      Alert.alert(
        'Ação Proibida',
        'Por questões de segurança e para garantir a integridade do Sentinela, o compartilhamento de números de telefone no chat é proibido. Use o chat interno para combinar os detalhes.'
      );
      return;
    }

    const newMessage = {
      sender_id: user?.id,
      receiver_id: receiverId,
      content: inputText.trim(),
    };

    // Optimistic update
    setMessages((prev) => [newMessage, ...prev]);
    setInputText('');

    try {
      const { error } = await supabase.from('direct_messages').insert(newMessage);
      if (error) throw error;
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
      fetchMessages(); // Rollback local state
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.messageRow, isMine ? styles.myRow : styles.otherRow]}>
        {!isMine && <Image source={{ uri: receiverAvatar }} style={styles.miniAvatar} />}
        <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isMine ? styles.myText : styles.otherText]}>
            {item.content}
          </Text>
          <Text style={styles.timeText}>
            {new Date(item.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Image source={{ uri: receiverAvatar }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{receiverName}</Text>
          <Text style={styles.headerStatus}>Online</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderItem}
          inverted
          contentContainerStyle={styles.listContent}
        />
      )}

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Mensagem..."
          placeholderTextColor={colors.outline}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <Pressable 
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]} 
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: 60, 
    paddingBottom: 16, 
    paddingHorizontal: 16, 
    backgroundColor: colors.surfaceContainerLow,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  backBtn: { marginRight: 12 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainerHigh },
  headerInfo: { marginLeft: 12 },
  headerName: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  headerStatus: { fontSize: 10, color: colors.primary, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  
  messageRow: { flexDirection: 'row', marginBottom: 16, maxWidth: '85%' },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  
  miniAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, alignSelf: 'flex-start', marginTop: 4 },
  
  messageBubble: { padding: 12, borderRadius: 16 },
  myBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: colors.surfaceContainerHigh, borderBottomLeftRadius: 4 },
  
  messageText: { ...typography.bodyMd, lineHeight: 18 },
  myText: { color: colors.onPrimary },
  otherText: { color: colors.onSurface },
  
  timeText: { fontSize: 9, opacity: 0.5, marginTop: 4, alignSelf: 'flex-end', color: 'inherit' },

  inputArea: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)'
  },
  input: { 
    flex: 1, 
    minHeight: 44, 
    maxHeight: 100, 
    backgroundColor: colors.surfaceContainerHigh, 
    borderRadius: 22, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    color: colors.onSurface,
    ...typography.bodyMd
  },
  sendBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 12 
  },
  sendBtnDisabled: { opacity: 0.5 }
});
