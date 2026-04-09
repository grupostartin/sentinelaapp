import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { BH_NEIGHBORHOODS } from '../constants/neighborhoods';

export const OnboardingScreen = () => {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [cep, setCep] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const filteredNeighborhoods = BH_NEIGHBORHOODS.filter(n => 
    n.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    handleGetLocation();
  }, []);

  const handleGetLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      setCoords({ lat: location.coords.latitude, lng: location.coords.longitude });

      const reverse = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      if (reverse && reverse.length > 0) {
        setNeighborhood(reverse[0].district || '');
      }
    } catch (error) {
      console.log('GPS Error:', error);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!name || !cep || !houseNumber || !neighborhood) {
      return Alert.alert('Campos Obrigatórios', 'Preencha todos os campos e confirme seu bairro.');
    }
    setLoading(true);
    try {
      if (!coords) {
        let loc = await Location.getCurrentPositionAsync({});
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          cep: cep,
          house_number: houseNumber,
          phone: phone,
          neighborhood: neighborhood,
          location_lat: coords?.lat || 0,
          location_lng: coords?.lng || 0,
          updated_at: new Date(),
        })
        .eq('id', user?.id);

      if (error) throw error;
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={[typography.headlineSm, styles.title]}>CONFIGURAÇÃO</Text>
          <Text style={[typography.bodyMd, styles.subtitle]}>Identificando sua zona de patrulha...</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>NOME COMPLETO</Text>
            <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor={colors.outline} value={name} onChangeText={setName} />
            <View style={styles.highlight} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>CEP</Text>
            <TextInput style={styles.input} placeholder="00000-000" placeholderTextColor={colors.outline} value={cep} onChangeText={setCep} keyboardType="numeric" />
            <View style={styles.highlight} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>NÚMERO DA CASA</Text>
            <TextInput style={styles.input} placeholder="123" placeholderTextColor={colors.outline} value={houseNumber} onChangeText={setHouseNumber} keyboardType="numeric" />
            <View style={styles.highlight} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>CELULAR (OPCIONAL)</Text>
            <TextInput style={styles.input} placeholder="(31) 99999-9999" placeholderTextColor={colors.outline} value={phone} onChangeText={setPhone} keyboardType="numeric" />
            <View style={styles.highlight} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>BAIRRO (TOQUE PARA ALTERAR)</Text>
            <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
              <Text style={{ color: neighborhood ? colors.onSurface : colors.outline }}>
                {neighborhood || 'Selecionar Bairro'}
              </Text>
            </Pressable>
            <View style={styles.highlight} />
          </View>

          <Modal visible={showPicker} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>SELECIONE SEU BAIRRO</Text>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={18} color={colors.outline} />
                  <TextInput style={styles.searchInput} placeholder="Buscar..." placeholderTextColor={colors.outline} value={search} onChangeText={setSearch} />
                </View>
                <FlatList
                  data={filteredNeighborhoods}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <Pressable style={styles.neighborhoodItem} onPress={() => { setNeighborhood(item); setShowPicker(false); setSearch(''); }}>
                      <Text style={styles.neighborhoodItemText}>{item}</Text>
                      {neighborhood === item && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                    </Pressable>
                  )}
                  ListEmptyComponent={<Text style={styles.emptyText}>Bairro não encontrado.</Text>}
                />
                <Pressable style={styles.closeButton} onPress={() => { setShowPicker(false); setSearch(''); }}>
                  <Text style={styles.closeButtonText}>CANCELAR</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <View style={styles.gpsStatus}>
            <View style={[styles.dot, { backgroundColor: coords ? '#4CAF50' : '#FFC107' }]} />
            <Text style={styles.gpsText}>{coords ? 'LOCALIZAÇÃO CAPTURADA' : 'AGUARDANDO GPS...'}</Text>
          </View>
        </View>

        <Pressable style={[styles.mainButton, loading && { opacity: 0.7 }]} onPress={handleCompleteRegistration} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.mainButtonText}>CONCLUIR CADASTRO</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60 },
  header: { marginBottom: 32 },
  title: { color: colors.primary, letterSpacing: 2, fontWeight: '900', marginBottom: 8 },
  subtitle: { color: colors.outline, opacity: 0.8 },
  form: { marginBottom: 32 },
  inputContainer: { marginBottom: 24, paddingBottom: 8 },
  label: { ...typography.labelSm, color: colors.primary, marginBottom: 8, letterSpacing: 1 },
  input: { ...typography.bodyMd, color: colors.onSurface, paddingVertical: 8, fontSize: 16 },
  highlight: { height: 1, backgroundColor: colors.outlineVariant, marginTop: 4, opacity: 0.3 },
  gpsStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  gpsText: { ...typography.labelSm, color: colors.outline, fontSize: 10 },
  mainButton: { backgroundColor: colors.primary, paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  mainButtonText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '900', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { width: '100%', maxHeight: '80%', backgroundColor: colors.surfaceContainerHighest, borderRadius: 16, padding: 24 },
  modalTitle: { ...typography.labelSm, color: colors.primary, marginBottom: 24, textAlign: 'center', letterSpacing: 2 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceContainerLow, borderRadius: 8, paddingHorizontal: 16, marginBottom: 16 },
  searchInput: { flex: 1, paddingVertical: 12, marginLeft: 12, color: colors.onSurface },
  neighborhoodItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', flexDirection: 'row', justifyContent: 'space-between' },
  neighborhoodItemText: { ...typography.bodyMd, color: colors.onSurface },
  emptyText: { color: colors.outline, textAlign: 'center', marginTop: 24 },
  closeButton: { marginTop: 24, paddingVertical: 16, backgroundColor: colors.surfaceContainerLow, borderRadius: 8, alignItems: 'center' },
  closeButtonText: { color: colors.outline, fontWeight: '700' },
});
