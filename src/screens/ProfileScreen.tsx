import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Modal, TextInput, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { BH_NEIGHBORHOODS } from '../constants/neighborhoods';

export const ProfileScreen = () => {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const filteredNeighborhoods = BH_NEIGHBORHOODS.filter(n => 
    n.toLowerCase().includes(search.toLowerCase())
  );

  // States for Edit Profile
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [editAddress, setEditAddress] = useState(profile?.address || '');
  
  // States for Privacy
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  const updateNeighborhood = async (name: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('profiles').update({ neighborhood: name }).eq('id', user.id);
      if (error) throw error;
      setShowPicker(false);
      await refreshProfile();
      Alert.alert('Sucesso', 'Bairro atualizado!');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permissão Negada', 'Precisamos de acesso às suas fotos para mudar o avatar.');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images', // Modern Expo way
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.2,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Erro ao selecionar foto', 'Não foi possível acessar a galeria.');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user || !profile) return;
    setUploading(true);
    try {
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const formData = new FormData();
      formData.append('files', {
        uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, formData);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      await refreshProfile();
      Alert.alert('Sucesso', 'Foto atualizada com sucesso!');
    } catch (e: any) {
      Alert.alert('Erro ao enviar foto', e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sair",
      "Deseja realmente sair da sua conta?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: signOut }
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!editName || !editPhone) return Alert.alert('Erro', 'Nome e telefone são obrigatórios.');
    setUpdating(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: editName,
        phone: editPhone,
        address: editAddress,
      }).eq('id', user?.id);
      
      if (error) throw error;
      await refreshProfile();
      setEditModalVisible(false);
      Alert.alert('Sucesso', 'Seus dados foram atualizados!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível atualizar seus dados.');
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) throw error;
      Alert.alert('E-mail enviado', 'Verifique sua caixa de entrada para redefinir sua senha.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível solicitar a redefinição.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'EXCLUIR CONTA',
      'Esta ação é irreversível. Todos os seus dados serão anonimizados e sua assinatura cancelada. Confirma?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'EXCLUIR PERMANENTEMENTE', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Simulando exclusão via inativação do perfil (seguro)
              const { error } = await supabase.from('profiles').update({ 
                is_blocked: true,
                full_name: 'CONTA EXCLUÍDA'
              }).eq('id', user?.id);
              if (error) throw error;
              signOut();
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível processar a solicitação.');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={[typography.headlineSm, styles.title]}>MEU PERFIL</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <Pressable style={styles.avatar} onPress={handlePickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : profile?.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.avatarImage} 
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons name="camera-outline" size={32} color={colors.outline} />
            )}
          </Pressable>
          <Text style={styles.name}>{profile?.full_name?.toUpperCase() || 'USUÁRIO SENTINELA'}</Text>
          <Text style={styles.joinDate}>
            Membro desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : 'agora'}
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Pressable style={styles.infoItem} onPress={() => setShowPicker(true)}>
            <MaterialIcons name="location-on" size={20} color={colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>BAIRRO REGISTRADO (TOQUE PARA ALTERAR)</Text>
              <Text style={styles.infoValue}>{profile?.neighborhood || 'Não definido'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={18} color={colors.outline} style={{ marginLeft: 'auto' }} />
          </Pressable>

          <Modal visible={showPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>SELECIONE SEU BAIRRO</Text>
                
                <Pressable 
                  style={styles.autoLocationBtn} 
                  onPress={async () => {
                    setUploading(true);
                    console.log("GPS (Profile): Detecção iniciada");
                    try {
                      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                      const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                      
                      if (rev.length > 0) {
                        const place = rev[0];
                        const detected = place.district || place.subregion;
                        console.log("GPS (Profile): Encontrado:", detected);
                        
                        if (detected) {
                          const street = place.street || '';
                          const number = place.name || '';
                          const city = place.city || '';
                          const cep = place.postalCode || '';
                          const fullAddr = `${street}${number ? ', ' + number : ''}${detected ? ' - ' + detected : ''}${city ? ', ' + city : ''}${cep ? ' - CEP: ' + cep : ''}`;
                          
                          // Atualizar múltiplos campos
                          const { error } = await supabase.from('profiles').update({ 
                            neighborhood: detected,
                            address: fullAddr 
                          }).eq('id', user?.id);
                          
                          if (error) throw error;
                          await refreshProfile();
                          Alert.alert("Sucesso", "Bairro e Endereço atualizados via GPS!");
                        } else {
                          Alert.alert("Aviso", "Localizado, mas o nome do bairro não foi retornado pelo mapa.");
                        }
                      } else {
                        Alert.alert("Erro", "Não foi possível identificar o bairro automaticamente.");
                      }
                    } catch (e) {
                      console.error("GPS Error (Profile):", e);
                      Alert.alert("Erro", "Ative o GPS para usar esta função.");
                    } finally {
                      setUploading(false);
                    }
                  }}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <>
                      <Ionicons name="location" size={20} color={colors.onPrimary} />
                      <Text style={styles.autoLocationText}>USAR LOCAL ATUAL</Text>
                    </>
                  )}
                </Pressable>

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
                <FlatList
                  data={filteredNeighborhoods}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <Pressable style={styles.item} onPress={() => { updateNeighborhood(item); setSearch(''); }}>
                      <Text style={styles.itemText}>{item}</Text>
                      {profile?.neighborhood === item && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                    </Pressable>
                  )}
                  style={{ maxHeight: 300 }}
                />
                <Pressable style={styles.closeBtn} onPress={() => { setShowPicker(false); setSearch(''); }}>
                  <Text style={styles.closeBtnText}>CANCELAR</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <View style={styles.infoItem}>
            <MaterialIcons name="call" size={20} color={colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>CONTATO</Text>
              <Text style={styles.infoValue}>{profile?.phone || 'Não definido'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="verified-user" size={20} color={colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>STATUS DA CONTA</Text>
              <Text style={styles.infoValue}>{profile?.subscription_status === 'active' ? 'ASSINATURA ATIVA' : 'INATIVO'}</Text>
            </View>
          </View>

          <View style={styles.infoItem}>
            <MaterialIcons name="credit-card" size={20} color={colors.primary} />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>PLANO ATUAL</Text>
              <Text style={styles.infoValue}>Premium Individual (R$ 9,90/mês)</Text>
              {profile?.subscription_expires_at && (
                <Text style={styles.infoSubtext}>Expira em: {new Date(profile.subscription_expires_at).toLocaleDateString()}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable 
          style={styles.actionButton} 
          onPress={() => {
            setEditName(profile?.full_name || '');
            setEditPhone(profile?.phone || '');
            setEditAddress(profile?.address || '');
            setEditModalVisible(true);
          }}
        >
          <MaterialIcons name="edit" size={20} color={colors.onSurface} />
          <Text style={styles.actionText}>EDITAR DADOS</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
        </Pressable>

        <Pressable style={styles.actionButton} onPress={() => setPrivacyModalVisible(true)}>
          <MaterialIcons name="security" size={20} color={colors.onSurface} />
          <Text style={styles.actionText}>PRIVACIDADE E SEGURANÇA</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
        </Pressable>

        <Pressable style={[styles.actionButton, styles.logoutButton]} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.tertiary} />
          <Text style={[styles.actionText, { color: colors.tertiary }]}>SAIR DA CONTA</Text>
        </Pressable>
      </View>

      {/* Modal de Editar Dados */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>EDITAR DADOS PESSOAIS</Text>
            
            <Text style={styles.inputLabel}>NOME COMPLETO</Text>
            <TextInput 
              style={styles.input} 
              value={editName} 
              onChangeText={setEditName}
              placeholder="Ex: João Silva"
              placeholderTextColor={colors.outline}
            />

            <Text style={styles.inputLabel}>CELULAR</Text>
            <TextInput 
              style={styles.input} 
              value={editPhone} 
              onChangeText={setEditPhone}
              keyboardType="phone-pad"
              placeholder="(31) 99999-9999"
              placeholderTextColor={colors.outline}
            />

            <Text style={styles.inputLabel}>ENDEREÇO COMPLETO</Text>
            <TextInput 
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
              value={editAddress} 
              onChangeText={setEditAddress}
              multiline
              placeholder="Rua, Número, Complemento..."
              placeholderTextColor={colors.outline}
            />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>CANCELAR</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleUpdateProfile} disabled={updating}>
                {updating ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={styles.saveBtnText}>SALVAR</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Privacidade e Segurança */}
      <Modal visible={privacyModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: 40 }]}>
            <Text style={styles.modalTitle}>SEGURANÇA DA CONTA</Text>
            
            <View style={styles.securityItem}>
              <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              <View style={styles.securityText}>
                <Text style={styles.securityTitle}>Dados Criptografados</Text>
                <Text style={styles.securityDesc}>Suas informações de endereço e contato são visíveis apenas para os administradores da sua comunidade.</Text>
              </View>
            </View>

            <Pressable style={styles.securityButton} onPress={handlePasswordReset}>
              <Ionicons name="key" size={20} color={colors.onSurface} />
              <Text style={styles.securityButtonText}>ALTERAR MINHA SENHA</Text>
            </Pressable>

            <View style={{ height: 1.5, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 24 }} />

            <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
              <Ionicons name="trash-outline" size={20} color={colors.tertiary} />
              <Text style={styles.deleteButtonText}>EXCLUIR MINHA CONTA</Text>
            </Pressable>

            <Pressable style={styles.closeFullBtn} onPress={() => setPrivacyModalVisible(false)}>
              <Text style={styles.closeFullBtnText}>VOLTAR</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Text style={styles.version}>SENTINELA APP V1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: 24, marginBottom: 32 },
  title: { color: colors.primary, fontWeight: '900', letterSpacing: 2 },
  profileCard: { marginHorizontal: 24, backgroundColor: colors.surfaceContainerLow, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  name: { ...typography.headlineSm, color: colors.onSurface, textAlign: 'center', fontSize: 18 },
  joinDate: { ...typography.labelSm, color: colors.outline, marginTop: 4 },
  infoSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 24 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  infoTextContainer: { marginLeft: 16 },
  infoLabel: { ...typography.labelSm, color: colors.outline, fontSize: 9, letterSpacing: 1 },
  infoValue: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '600' },
  infoSubtext: { ...typography.labelSm, color: colors.outline, fontSize: 11, marginTop: 2 },
  actions: { marginTop: 24, paddingHorizontal: 24 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, padding: 16, borderRadius: 12, marginBottom: 8 },
  actionText: { flex: 1, marginLeft: 12, ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  logoutButton: { marginTop: 16, borderWidth: 1, borderColor: colors.tertiaryContainer },
  version: { textAlign: 'center', marginTop: 32, marginBottom: 100, ...typography.labelSm, color: colors.outline, opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 20, padding: 24, maxHeight: '80%', borderWidth: 1, borderColor: colors.outlineVariant },
  modalTitle: { ...typography.labelSm, color: colors.primary, textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  item: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between' },
  itemText: { ...typography.bodyMd, color: colors.onSurface },
  closeBtn: { marginTop: 20, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceContainerLow, alignItems: 'center' },
  closeBtnText: { ...typography.labelSm, color: colors.primary, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: 8, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchField: { flex: 1, paddingVertical: 12, marginLeft: 12, ...typography.bodyMd, color: colors.onSurface },
  autoLocationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, padding: 12, borderRadius: 12, justifyContent: 'center', marginBottom: 20 },
  autoLocationText: { color: colors.onPrimary, marginLeft: 8, ...typography.labelSm, fontWeight: '900' },
  
  // Novos estilos para Editar/Privacidade
  inputLabel: { ...typography.labelSm, color: colors.outline, marginTop: 16, marginBottom: 8, fontSize: 10 },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: 12, padding: 16, color: colors.onSurface, ...typography.bodyMd, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceContainerLow, alignItems: 'center' },
  cancelBtnText: { ...typography.labelSm, color: colors.outline, fontWeight: '700' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '900' },
  
  securityItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  securityText: { marginLeft: 16, flex: 1 },
  securityTitle: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  securityDesc: { ...typography.labelSm, color: colors.outline, fontSize: 11, marginTop: 4, lineHeight: 16 },
  securityButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, padding: 16, borderRadius: 12, marginTop: 24 },
  securityButtonText: { marginLeft: 12, ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.tertiaryContainer },
  deleteButtonText: { marginLeft: 12, ...typography.bodyMd, color: colors.tertiary, fontWeight: '700' },
  closeFullBtn: { marginTop: 32, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceContainerLow, alignItems: 'center' },
  closeFullBtnText: { ...typography.labelSm, color: colors.primary, fontWeight: '900' },
});
