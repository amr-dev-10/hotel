import React, {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Eye} from '../../../components/icons';
import {colors} from '../../../theme/colors';

type LoginProps = {
  email: string;
  password: string;
  error: string | null;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
};

export function LoginScreen({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onLogin,
}: LoginProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.login}>
      <View style={styles.loginPanel}>
        <View style={styles.loginBrandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>A</Text>
          </View>
          <View>
            <Text style={styles.brandEyebrow}>ARCADIA</Text>
            <Text style={styles.brandSubhead}>Hotel Platform</Text>
          </View>
        </View>
        <Text style={styles.appName}>Hotel operations</Text>
        <Text style={styles.loginSubtitle}>
          Sign in to manage tickets, reservations, rooms, and F&B from staging.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={onEmailChange}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="owner@admin.com"
          placeholderTextColor={colors.disabledText}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            value={password}
            onChangeText={onPasswordChange}
            autoCapitalize="none"
            autoComplete="password"
            placeholder="Password"
            placeholderTextColor={colors.disabledText}
            secureTextEntry={!passwordVisible}
            style={styles.passwordInput}
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setPasswordVisible(current => !current)}>
            <Eye color={colors.textMuted} size={19} strokeWidth={2} />
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Pressable
          style={({pressed}) => [
            styles.primaryButton,
            pressed && styles.pressed,
            loading && styles.disabledButton,
          ]}
          onPress={onLogin}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  login: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  loginPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
  },
  loginBrandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 22,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  brandMarkText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  brandEyebrow: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSubhead: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0,
  },
  loginSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  passwordRow: {
    alignItems: 'center',
    borderColor: colors.divider,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
  },
  passwordInput: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  eyeButton: {
    alignItems: 'center',
    height: 50,
    justifyContent: 'center',
    width: 48,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 52,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.75,
  },
  pressed: {
    opacity: 0.86,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});
