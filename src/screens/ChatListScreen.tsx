import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';

export const ChatListScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    try {
      // Esta query pega as conversas únicas onde o usuário esteve envolvido
      // No Supabase, para fazer um 'Distinct' mais limpo em DMs seria melhor uma RPC, 
      // mas vamos filtrar as mensagens enviadas/recebidas.
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender:sender_id (id, full_name, avatar_url),
          receiver:receiver_id (id, full_name, avatar_url)
        `)
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por usuário (para não aparecer a mesma pessoa várias vezes)
      const uniqueChats: any[] = [];
      const seenUsers = new Set();

      data?.forEach(msg => {
        const otherUser = msg.sender_id === user?.id ? msg.receiver : msg.sender;
        if (!seenUsers.has(otherUser.id)) {
          seenUsers.add(otherUser.id);
          uniqueChats.push({
            ...msg,
            otherUser
          });
        }
      });

      setChats(uniqueChats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable 
      style={styles.chatItem} 
      onPress={() => navigation.navigate('DirectChat', { 
        receiverId: item.otherUser.id, 
        receiverName: item.otherUser.full_name,
        receiverAvatar: item.otherUser.avatar_url
      })}
    >
      <Image source={{ uri: item.otherUser.avatar_url }} style={styles.avatar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{item.otherUser.full_name}</Text>
          <Text style={styles.time}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.lastMsg} numberOfLines={1}>{item.content}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.outline} />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>SUAS MENSAGENS</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={60} color={colors.outline} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyText}>Você ainda não possui conversas.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenHeader: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  title: { ...typography.headlineSm, color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  
  chatItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.surfaceContainerHigh },
  content: { flex: 1, marginLeft: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  time: { fontSize: 10, color: colors.outline },
  lastMsg: { ...typography.labelSm, color: colors.outline, fontSize: 13 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { ...typography.bodyMd, color: colors.outline, marginTop: 16 },
});
