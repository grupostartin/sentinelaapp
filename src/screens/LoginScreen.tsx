import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../services/supabase';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert('Erro', 'Informe e-mail e senha');
    setLoading(true);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        Alert.alert('Sucesso', 'Cadastro realizado! Verifique seu e-mail (ou apenas entre se o login automático estiver ativo).');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[typography.headlineSm, styles.title]}>SENTINELA</Text>
          <Text style={[typography.bodyMd, styles.subtitle]}>
            {isRegistering ? 'Crie sua conta tática.' : 'Identifique-se para acessar o comando.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.outline}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.highlight} />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>SENHA</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.outline}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.highlight} />
          </View>

          <Pressable 
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.8, backgroundColor: colors.primaryFixed }
            ]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering ? 'CRIAR CONTA' : 'VERIFICAR ACESSO'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => setIsRegistering(!isRegistering)} style={styles.backButton}>
            <Text style={styles.backButtonText}>
              {isRegistering ? 'JÁ POSSUI CONTA? ENTRAR' : 'NÃO TEM CONTA? CADASTRAR'}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  inner: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 48,
  },
  title: {
    color: colors.primary,
    letterSpacing: 4,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.onSurface,
    opacity: 0.6,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    ...typography.labelSm,
    color: colors.primary,
    marginBottom: 12,
    letterSpacing: 1.5,
  },
  input: {
    ...typography.bodyMd,
    color: colors.onSurface,
    paddingVertical: 12,
    fontSize: 18,
  },
  highlight: {
    height: 2,
    backgroundColor: colors.outline,
    opacity: 0.3,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    fontWeight: '900',
    fontSize: 14,
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButtonText: {
    ...typography.labelSm,
    color: colors.outline,
    fontSize: 11,
  },
});
