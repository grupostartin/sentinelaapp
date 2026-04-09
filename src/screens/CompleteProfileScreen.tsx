import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList, Modal } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { BH_NEIGHBORHOODS } from '../constants/neighborhoods';

export const CompleteProfileScreen = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  
  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [whatsapp, setWhatsapp] = useState(profile?.phone || '');
  const [birthDate, setBirthDate] = useState(formatDateToBR(profile?.birth_date || ''));
  const [street, setStreet] = useState(profile?.address || '');
  const [houseNumber, setHouseNumber] = useState(profile?.house_number || '');
  const [cep, setCep] = useState(profile?.cep || '');
  const [neighborhood, setNeighborhood] = useState(profile?.neighborhood || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (profile) {
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.phone) setWhatsapp(profile.phone);
      if (profile.birth_date) setBirthDate(formatDateToBR(profile.birth_date));
      if (profile.address) setStreet(profile.address);
      if (profile.house_number) setHouseNumber(profile.house_number);
      if (profile.cep) setCep(profile.cep);
      if (profile.neighborhood) setNeighborhood(profile.neighborhood);
      if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const filteredNeighborhoods = BH_NEIGHBORHOODS.filter(n => 
    n.toLowerCase().includes(search.toLowerCase())
  );

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permissão Negada', 'Precisamos de acesso às suas fotos.');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.2 });
      if (!result.canceled && result.assets && result.assets.length > 0) uploadAvatar(result.assets[0].uri);
    } catch (error) { Alert.alert('Erro', 'Não foi possível acessar a galeria.'); }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploading(true);
    try {
      const fileExt = uri.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, { uri, name: fileName, type: `image/${fileExt}` } as any);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setAvatarUrl(publicUrl);
    } catch (e: any) { Alert.alert('Erro ao enviar foto', e.message); } finally { setUploading(false); }
  };

  const handleDateChange = (text: string) => {
    const clean = text.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 2) formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    if (clean.length > 4) formatted = `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4, 8)}`;
    setBirthDate(formatted);
  };

  const handlePhoneChange = (text: string) => {
    const clean = text.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 0) {
      formatted = `(${clean.slice(0, 2)}`;
      if (clean.length > 2) formatted += `) ${clean.slice(2, 7)}`;
      if (clean.length > 7) formatted += `-${clean.slice(7, 11)}`;
    }
    setWhatsapp(formatted);
  };

  const handleCepChange = (text: string) => {
    const clean = text.replace(/\D/g, '');
    let formatted = clean;
    if (clean.length > 5) formatted = `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
    setCep(formatted);
  };

  const handleAutoLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permissão necessária", "Ative o GPS.");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const rev = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (rev.length > 0) {
        const place = rev[0];
        setStreet(place.street || '');
        setHouseNumber(place.name || '');
        setCep(place.postalCode || '');
        setNeighborhood(place.district || place.subregion || '');
        Alert.alert("Localização Encontrada", "Endereço preenchido automaticamente via GPS.");
      }
    } catch (e) { Alert.alert("Erro", "Erro ao acessar GPS."); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!fullName || !whatsapp || !birthDate || !street || !neighborhood || !avatarUrl) {
      return Alert.alert("Campos Obrigatórios", "Por favor, preencha todos os campos e a foto.");
    }
    const parts = birthDate.split('/');
    const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName,
        phone: whatsapp,
        birth_date: isoDate,
        address: street,
        house_number: houseNumber,
        cep: cep,
        neighborhood: neighborhood,
        avatar_url: avatarUrl
      }).eq('id', user?.id);
      if (error) throw error;
      await refreshProfile();
    } catch (e: any) { Alert.alert("Erro", e.message); } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <MaterialIcons name="shield" size={50} color={colors.primary} />
          <Text style={styles.title}>DADOS OBRIGATÓRIOS</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarCircle} onPress={handlePickImage} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.primary} />
              ) : avatarUrl ? (
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ) : (
                <MaterialIcons name="photo-camera" size={30} color={colors.outline} />
              )}
            </Pressable>
            <Text style={styles.label}>FOTO DE PERFIL *</Text>
          </View>

          <View style={styles.inputGroup}><Text style={styles.label}>NOME COMPLETO *</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Seu nome" placeholderTextColor={colors.outline} /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>WHATSAPP *</Text><TextInput style={styles.input} value={whatsapp} onChangeText={handlePhoneChange} keyboardType="phone-pad" maxLength={15} placeholder="(00) 00000-0000" placeholderTextColor={colors.outline} /></View>
          <View style={styles.inputGroup}><Text style={styles.label}>DATA NASCIMENTO *</Text><TextInput style={styles.input} value={birthDate} onChangeText={handleDateChange} keyboardType="numeric" maxLength={10} placeholder="DD/MM/AAAA" placeholderTextColor={colors.outline} /></View>
          
          <View style={styles.divider}><Text style={styles.dividerText}>LOCALIZAÇÃO</Text></View>
          
          <Pressable style={styles.gpsBtn} onPress={handleAutoLocation} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onPrimary} /> : <><MaterialIcons name="my-location" size={18} color={colors.onPrimary} /><Text style={styles.gpsText}>USAR LOCAL ATUAL (GPS)</Text></>}
          </Pressable>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>BAIRRO *</Text>
            <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
              <Text style={{ color: neighborhood ? colors.onSurface : colors.outline }}>{neighborhood || 'Selecionar Bairro'}</Text>
            </Pressable>
          </View>

          <Modal visible={showPicker} transparent animationType="fade">
            <View style={styles.modalOverlay}><View style={styles.modalContent}>
              <TextInput style={styles.input} placeholder="Buscar bairro..." value={search} onChangeText={setSearch} placeholderTextColor={colors.outline} />
              <FlatList
                data={filteredNeighborhoods}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable style={styles.item} onPress={() => { setNeighborhood(item); setShowPicker(false); }}><Text style={styles.itemText}>{item}</Text></Pressable>
                )}
                style={{ maxHeight: 300, marginTop: 10 }}
              />
              <Pressable style={styles.closeBtn} onPress={() => setShowPicker(false)}><Text style={styles.closeBtnText}>FECHAR</Text></Pressable>
            </View></View>
          </Modal>

          <View style={styles.inputGroup}><Text style={styles.label}>RUA / LOGRADOURO *</Text><TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Nome da rua" placeholderTextColor={colors.outline} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={[styles.inputGroup, { width: '48%' }]}><Text style={styles.label}>NÚMERO</Text><TextInput style={styles.input} value={houseNumber} onChangeText={setHouseNumber} placeholder="Ex: 123" placeholderTextColor={colors.outline} /></View>
            <View style={[styles.inputGroup, { width: '48%' }]}><Text style={styles.label}>CEP</Text><TextInput style={styles.input} value={cep} onChangeText={handleCepChange} keyboardType="numeric" maxLength={9} placeholder="00000-000" placeholderTextColor={colors.outline} /></View>
          </View>

          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>SALVAR CADASTRADO</Text>}
          </Pressable>

          <Pressable style={styles.signOutBtn} onPress={signOut}><Text style={styles.signOutBtnText}>CANCELAR / SAIR</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { ...typography.headlineSm, color: colors.primary, fontWeight: '900', marginTop: 10 },
  form: { width: '100%' },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.primary, overflow: 'hidden' },
  inputGroup: { marginBottom: 16 },
  label: { ...typography.labelSm, color: colors.primary, marginBottom: 6, fontSize: 10, letterSpacing: 1 },
  input: { backgroundColor: colors.surfaceContainerLow, borderRadius: 10, padding: 14, color: colors.onSurface, ...typography.bodyMd, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  divider: { marginVertical: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  dividerText: { backgroundColor: colors.background, paddingHorizontal: 10, color: colors.outline, fontSize: 10, top: 8 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, padding: 14, borderRadius: 10, justifyContent: 'center', marginBottom: 20 },
  gpsText: { color: '#FFF', marginLeft: 8, fontWeight: '900', fontSize: 12 },
  saveBtn: { backgroundColor: colors.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontWeight: '900', letterSpacing: 1 },
  signOutBtn: { padding: 16, marginTop: 10, alignItems: 'center' },
  signOutBtnText: { color: colors.outline, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.surfaceContainerHighest, borderRadius: 20, padding: 20 },
  item: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  itemText: { color: colors.onSurface },
  closeBtn: { marginTop: 20, padding: 15, alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: 10 },
  closeBtnText: { color: colors.primary, fontWeight: '700' }
});
