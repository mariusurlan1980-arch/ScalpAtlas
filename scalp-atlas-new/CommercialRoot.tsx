import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import {
  getCurrentSupabaseSession,
  signInScalpAtlas,
  signOutScalpAtlas,
  signUpScalpAtlas,
  supabase,
  supabaseConfigured,
} from './supabaseAuth';

export default function CommercialRoot() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Conectează-te pentru a păstra cele 5 încercări și abonamentul pe contul tău.');

  useEffect(() => {
    if (!supabaseConfigured || !supabase) return;
    let mounted = true;

    getCurrentSupabaseSession()
      .then((current) => {
        if (mounted) setSession(current);
      })
      .catch((error) => {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Contul nu a putut fi verificat.');
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!supabaseConfigured) return <App />;

  if (!ready) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Verific contul SCALP ATLAS…</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    const submit = async (mode: 'login' | 'signup') => {
      const normalizedEmail = email.trim();
      if (!normalizedEmail || password.length < 6) {
        setMessage('Introdu un e-mail valid și o parolă de minimum 6 caractere.');
        return;
      }

      setBusy(true);
      try {
        if (mode === 'login') {
          const { data, error } = await signInScalpAtlas(normalizedEmail, password);
          if (error) throw error;
          setSession(data.session);
          setMessage('Cont conectat.');
        } else {
          const { data, error } = await signUpScalpAtlas(normalizedEmail, password);
          if (error) throw error;
          if (data.session) {
            setSession(data.session);
            setMessage('Cont creat și conectat.');
          } else {
            setMessage('Cont creat. Verifică e-mailul pentru confirmare, apoi apasă CONECTARE.');
          }
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Autentificarea nu a reușit.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <SafeAreaView style={styles.authPage}>
        <View style={styles.authCard}>
          <Text style={styles.logo}>
            <Text style={{ color: '#20E0FF' }}>SC</Text>
            <Text style={{ color: '#28BFFF' }}>AL</Text>
            <Text style={{ color: '#557FFF' }}>P </Text>
            <Text style={{ color: '#8758FF' }}>AT</Text>
            <Text style={{ color: '#C43AF2' }}>LA</Text>
            <Text style={{ color: '#FF2DB8' }}>S</Text>
          </Text>
          <Text style={styles.title}>CONT CLIENT</Text>
          <Text style={styles.muted}>{message}</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="E-mail"
            placeholderTextColor="#66758b"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            secureTextEntry
            placeholder="Parolă"
            placeholderTextColor="#66758b"
            style={styles.input}
          />

          <Pressable disabled={busy} style={styles.primary} onPress={() => submit('login')}>
            <Text style={styles.primaryText}>{busy ? 'SE VERIFICĂ…' : 'CONECTARE'}</Text>
          </Pressable>
          <Pressable disabled={busy} style={styles.secondary} onPress={() => submit('signup')}>
            <Text style={styles.secondaryText}>CREEAZĂ CONT</Text>
          </Pressable>

          <Text style={styles.note}>
            Cele 5 analize gratuite și abonamentul vor fi asociate contului, nu doar telefonului.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.appShell}>
      <View style={styles.accountBar}>
        <Text style={styles.accountText} numberOfLines={1}>{session.user.email || 'Cont SCALP ATLAS'}</Text>
        <Pressable onPress={() => signOutScalpAtlas().catch(() => {})}>
          <Text style={styles.signOut}>IEȘIRE</Text>
        </Pressable>
      </View>
      <View style={styles.appBody}>
        <App />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerPage: {
    flex: 1,
    backgroundColor: '#070b12',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  authPage: {
    flex: 1,
    backgroundColor: '#070b12',
    justifyContent: 'center',
    padding: 22,
  },
  authCard: {
    borderWidth: 1,
    borderColor: '#263248',
    borderRadius: 20,
    backgroundColor: '#0c121c',
    padding: 22,
    gap: 14,
  },
  logo: {
    color: '#f7fafc',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1.4,
    textAlign: 'center',
    textShadowColor: 'rgba(139,92,246,0.48)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  title: { color: '#f7fafc', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  muted: { color: '#93a1b5', textAlign: 'center', lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: '#31405a',
    borderRadius: 12,
    backgroundColor: '#090e17',
    color: '#f7fafc',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  primary: { backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#090d14', fontWeight: '900' },
  secondary: { borderWidth: 1, borderColor: '#58667e', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#eef2f7', fontWeight: '900' },
  note: { color: '#76859a', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  appShell: { flex: 1, backgroundColor: '#070b12' },
  accountBar: {
    minHeight: 38,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1c2738',
    backgroundColor: '#090e16',
  },
  accountText: { color: '#93a1b5', fontSize: 11, flex: 1, marginRight: 12 },
  signOut: { color: '#c8d2df', fontSize: 11, fontWeight: '900' },
  appBody: { flex: 1 },
});
