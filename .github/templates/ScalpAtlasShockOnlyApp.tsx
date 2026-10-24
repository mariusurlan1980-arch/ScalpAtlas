import React, { useState } from 'react';
import { NativeModules, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

const overlay = NativeModules.ScalpOverlay;

export default function App() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Pregătit pentru suprapunere. Semnalele sunt dezactivate până la verificarea datelor.');
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS !== 'android' || !overlay) {
        setMessage('Serviciul Android de suprapunere nu este disponibil.');
      } else if (running) {
        await overlay.stopOverlayMode();
        setRunning(false);
        setMessage('Suprapunere oprită.');
      } else {
        const result = await overlay.startOverlayMode();
        if (result === 'OVERLAY_PERMISSION_REQUIRED') {
          setMessage('Activează permisiunea „Afișare peste alte aplicații”, apoi apasă din nou.');
        } else if (result === 'STARTED') {
          setRunning(true);
          setMessage('Suprapunere ȘOC pornită. Deschide Pocket Option pe DEMO.');
        } else {
          setMessage('Serviciul nu a confirmat pornirea.');
        }
      }
    } catch (error) {
      setRunning(false);
      setMessage('Pornirea a eșuat. Verifică permisiunea de capturare a ecranului.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor="#060c16" />
      <Text style={styles.brand}>SCALP ATLAS</Text>
      <Text style={styles.subtitle}>ȘOC LIVE • O SINGURĂ STRATEGIE</Text>
      <View style={styles.preview}>
        <View style={styles.candle}><Text style={styles.wick}>│</Text><View style={styles.body}/><Text style={styles.wick}>│</Text></View>
        <View style={styles.circle}><Text style={styles.percent}>—</Text><Text style={styles.circleLabel}>ȘOC</Text></View>
      </View>
      <Text style={styles.caption}>Lumânare în formare • Revenire verificată</Text>
      <Pressable disabled={busy} onPress={toggle} style={[styles.button, running && styles.stop, busy && styles.disabled]}>
        <Text style={styles.buttonText}>{busy ? 'SE PROCESEAZĂ…' : running ? 'OPREȘTE SUPRAPUNEREA' : 'PORNEȘTE SUPRAPUNEREA'}</Text>
      </Pressable>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.note}>Fără 70 de modele • Fără camera telefonului • Fără semnale inventate</Text>
      <Text style={styles.warning}>TEST DEMO: nu folosi pentru tranzacții reale până când citirea OHLC și alertele ȘOC sunt validate.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#060c16', paddingHorizontal: 22, paddingTop: 26 },
  brand: { color: '#54d8ee', fontSize: 31, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  subtitle: { color: '#a8bacd', fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '700' },
  preview: { marginTop: 90, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 20 },
  candle: { height: 125, width: 40, alignItems: 'center', justifyContent: 'center' },
  wick: { color: '#64798b', fontSize: 19, height: 24 },
  body: { width: 22, height: 55, backgroundColor: '#64798b', borderRadius: 2 },
  circle: { width: 148, height: 148, borderRadius: 74, borderWidth: 7, borderColor: '#536779', alignItems: 'center', justifyContent: 'center' },
  percent: { color: '#fff', fontSize: 37, fontWeight: '800' },
  circleLabel: { color: '#a5bac9', fontSize: 16, fontWeight: '700' },
  caption: { color: '#9fb0c2', textAlign: 'center', marginTop: 30 },
  button: { marginTop: 70, backgroundColor: '#10765c', paddingVertical: 22, borderRadius: 16, alignItems: 'center' },
  stop: { backgroundColor: '#9d3445' },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  message: { color: '#c8d7e2', textAlign: 'center', marginTop: 25, fontSize: 14 },
  note: { color: '#89a5b8', textAlign: 'center', marginTop: 32 },
  warning: { color: '#e3b26a', textAlign: 'center', marginTop: 35, fontSize: 12 },
});
