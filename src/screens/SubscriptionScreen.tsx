import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAuth } from '../context/AuthContext';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export const SubscriptionScreen = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-session', {
        body: {
          success_url: 'sentinela://payment-success',
          cancel_url: 'sentinela://payment-cancel',
        },
      });

      if (error) throw error;
      if (data?.url) {
        const supported = await Linking.canOpenURL(data.url);
        if (supported) await Linking.openURL(data.url);
        else Alert.alert('Erro', 'Não foi possível abrir o link de pagamento.');
      }
    } catch (err: any) {
      console.error('Subscription error:', err);
      Alert.alert('Erro', 'Não foi possível iniciar o processo de assinatura.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshProfile();
      setTimeout(() => {
        if (profile?.subscription_status !== 'active') {
          Alert.alert(
            'Aguardando Confirmação',
            'Ainda não recebemos a confirmação do Stripe. Se você já pagou, aguarde um instante e tente novamente.'
          );
        }
        setChecking(false);
      }, 1500);
    } catch (e) {
      setChecking(false);
      Alert.alert('Erro', 'Não foi possível verificar o status agora.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <MaterialIcons name="security" size={60} color={colors.primary} />
        <Text style={[typography.headlineSm, styles.title]}>SENTINELA PREMIUM</Text>
        <Text style={styles.subtitle}>Proteção total para você e sua vizinhança.</Text>
      </View>

      <View style={styles.features}>
        <FeatureItem 
          icon="notifications-active" 
          title="Alertas em Tempo Real" 
          desc="Receba avisos instantâneos de pânico e ocorrências no seu bairro." 
        />
        <FeatureItem 
          icon="chat" 
          title="Sala de Crise" 
          desc="Coordene ações emergenciais com seus vizinhos em tempo real." 
        />
        <FeatureItem 
          icon="people" 
          title="Comunidade Verificada" 
          desc="Acesso exclusivo ao mural e diretório de vizinhos do seu bairro." 
        />
        <FeatureItem 
          icon="verified-user" 
          title="Modo Sentinela" 
          desc="Faça parte da rede de proteção ativa 24h por dia." 
        />
      </View>

      <View style={styles.pricingCard}>
        <Text style={styles.planName}>Plano Individual</Text>
        <View style={styles.priceRow}>
          <Text style={styles.priceSymbol}>R$</Text>
          <Text style={styles.priceValue}>9,90</Text>
          <Text style={styles.pricePeriod}>/mês</Text>
        </View>
        <Text style={styles.planDesc}>Sem fidelidade. Cancele quando quiser.</Text>

        <Pressable 
          style={[styles.subscribeBtn, loading && styles.disabledBtn]} 
          onPress={handleSubscribe}
          disabled={loading || checking}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.subscribeBtnText}>ASSINAR AGORA</Text>
          )}
        </Pressable>
      </View>

      <Pressable 
        style={styles.checkStatusBtn} 
        onPress={handleCheckStatus}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.checkStatusText}>Já assinei? Verificar status</Text>
        )}
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={() => signOut()}>
        <Text style={styles.logoutText}>Sair</Text>
      </Pressable>
    </ScrollView>
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <View style={styles.featureItem}>
    <View style={styles.featureIcon}>
      <MaterialIcons name={icon} size={24} color={colors.primary} />
    </View>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 60, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { color: colors.onSurface, fontWeight: '900', letterSpacing: 2, marginTop: 16 },
  subtitle: { color: colors.outline, textAlign: 'center', marginTop: 8, ...typography.bodyMd },
  
  features: { width: '100%', marginBottom: 40 },
  featureItem: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  featureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(52, 199, 89, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  featureText: { flex: 1 },
  featureTitle: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700' },
  featureDesc: { ...typography.labelSm, color: colors.outline, marginTop: 2, lineHeight: 16 },

  pricingCard: { 
    width: '100%', 
    backgroundColor: colors.surfaceContainerLow, 
    borderRadius: 24, 
    padding: 32, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  planName: { ...typography.labelSm, color: colors.primary, fontWeight: '900', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12 },
  priceSymbol: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700', marginTop: 8, marginRight: 4 },
  priceValue: { fontSize: 48, fontWeight: '900', color: colors.onSurface },
  pricePeriod: { ...typography.bodyMd, color: colors.outline, alignSelf: 'flex-end', marginBottom: 12, marginLeft: 4 },
  planDesc: { ...typography.labelSm, color: colors.outline, marginBottom: 24 },
  
  subscribeBtn: { 
    width: '100%', 
    backgroundColor: colors.primary, 
    paddingVertical: 16, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: { opacity: 0.6 },
  subscribeBtnText: { ...typography.labelSm, color: colors.onPrimary, fontWeight: '900', letterSpacing: 1 },
  
  checkStatusBtn: { marginTop: 24, padding: 12 },
  checkStatusText: { ...typography.labelSm, color: colors.primary, textDecorationLine: 'underline' },
  
  logoutBtn: { marginTop: 20, padding: 12 },
  logoutText: { ...typography.labelSm, color: colors.outline },
});
