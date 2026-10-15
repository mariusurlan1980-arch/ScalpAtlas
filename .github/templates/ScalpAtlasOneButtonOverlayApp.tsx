// One-phone LIVE overlay entry point (Android 14 / Motorola G24).
// No camera, tutorial carousel, second-phone steps or broker automation.
// Native MediaProjection permission is requested at every Android session.
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  NativeModules,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Session = 'OFF' | 'STARTING' | 'ON';

export default function App() {
  const [session, setSession] = useState<Session>('OFF');
  const [status, setStatus] = useState('Pregătit pentru capturare LIVE');
  const busy = useRef(false);

  async function toggleOverlay() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (Platform.OS !== 'android' || !NativeModules.ScalpOverlay) {
        setStatus('Suprapunerea necesită aplicația Android instalată.');
        return;
      }
      if (session === 'ON') {
        await NativeModules.ScalpOverlay.stopOverlayMode();
        setSession('OFF');
        setStatus('Suprapunerea este oprită.');
        return;
      }
      setSession('STARTING');
      setStatus('Acordă permisiunea Android de capturare a ecranului.');
      const response = await NativeModules.ScalpOverlay.startOverlayMode();
      if (response === 'STARTED') {
        setSession('ON');
        setStatus('Suprapunere pornită. Deschide Pocket Option pe DEMO.');
      } else if (response === 'OVERLAY_PERMISSION_REQUIRED') {
        setSession('OFF');
        setStatus('Permite „Afișare peste alte aplicații”, apoi apasă din nou LIVE.');
      } else {
        setSession('OFF');
        setStatus('Nu am putut confirma captura: ' + String(response ?? 'necunoscut'));
      }
    } catch (error) {
      setSession('OFF');
      const text = error instanceof Error ? error.message : String(error);
      setStatus('Captura nu a pornit: ' + text);
    } finally {
      busy.current = false;
    }
  }

  const active = session === 'ON';
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.page}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.brand, styles.brandCyan]}>SC</Text>
            <Text style={[styles.brand, styles.brandViolet]}>ALP </Text>
            <Text style={[styles.brand, styles.brandPink]}>ATLAS</Text>
          </View>
          <Text style={styles.subtitle}>LIVE • ORICE BROKER</Text>
        </View>

        <View style={styles.center}>
          <View style={styles.pill}>
            <View style={[styles.led, active && styles.ledOn]} />
            <Text style={styles.pillText}>{active ? 'LIVE' : session === 'STARTING' ? 'PORNIRE' : 'OPRIT'}</Text>
          </View>

          <Text style={styles.timeframe}>M10</Text>
          <Text style={styles.expiry}>DURATĂ TRADE • 10 MINUTE</Text>
          <Text style={styles.direction}>BUY / SELL</Text>
          <Text style={styles.muted}>Trend · Retragere · Minime / Maxime</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={active ? 'Oprește suprapunerea LIVE' : 'Pornește suprapunerea LIVE'}
            disabled={session === 'STARTING'}
            onPress={() => { void toggleOverlay(); }}
            style={[styles.button, active && styles.buttonOn, session === 'STARTING' && styles.disabled]}
          >
            {session === 'STARTING'
              ? <ActivityIndicator color="#f6fbff" style={styles.spinner} />
              : <View style={[styles.buttonLed, active && styles.buttonLedOn]} />}
            <Text style={styles.buttonText}>{active ? 'OPREȘTE LIVE' : 'SUPRAPUNERE LIVE'}</Text>
          </Pressable>

          <Text style={styles.status}>{status}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footText}>UN SINGUR TELEFON • CAPTURĂ ECRAN</Text>
          <Text style={styles.footNote}>BUY/SELL apar pe fereastra suprapusă. Tu decizi manual pe DEMO.</Text>
          <Text style={styles.footWarning}>Motor experimental. Nu tranzacționa bani reali pe semnale neverificate.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1,backgroundColor:'#070b12'},
  page: {flex:1,paddingHorizontal:22,justifyContent:'space-between',paddingBottom:20},
  header: {paddingTop:22,alignItems:'center'},
  titleRow: {flexDirection:'row',justifyContent:'center'},
  brand: {fontSize:33,fontWeight:'900',letterSpacing:1.3},
  brandCyan: {color:'#37d9f8'},
  brandViolet: {color:'#9c77ff'},
  brandPink: {color:'#e964c8'},
  subtitle: {color:'#8fa5bd',fontSize:12,fontWeight:'700',letterSpacing:2,marginTop:8},
  center: {alignItems:'center',justifyContent:'center'},
  pill: {flexDirection:'row',alignItems:'center',marginBottom:26},
  led: {height:12,width:12,borderRadius:6,backgroundColor:'#ef545a',marginRight:10},
  ledOn: {backgroundColor:'#43df97'},
  pillText: {color:'#e6eef8',fontSize:14,fontWeight:'800',letterSpacing:2},
  timeframe: {fontSize:65,color:'#eef6ff',fontWeight:'900'},
  expiry: {fontSize:12,color:'#8ea9c1',fontWeight:'800',letterSpacing:1.2,marginTop:2},
  direction: {fontSize:30,fontWeight:'900',color:'#eff5ff',marginTop:28},
  muted: {color:'#8b9ab0',fontSize:13,marginTop:7,marginBottom:35},
  button: {backgroundColor:'#22364d',minHeight:64,borderRadius:16,paddingHorizontal:25,
    width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'center'},
  buttonOn: {backgroundColor:'#183f31'},
  buttonLed: {width:13,height:13,borderRadius:7,backgroundColor:'#e75b64',marginRight:12},
  buttonLedOn: {backgroundColor:'#42e99a'},
  buttonText: {color:'#fff',fontWeight:'900',fontSize:17,letterSpacing:.5},
  spinner: {marginRight:12},
  disabled: {opacity:.6},
  status: {color:'#d9e6f4',fontSize:13,lineHeight:20,textAlign:'center',marginTop:19,
    minHeight:60,maxWidth:340},
  footer: {alignItems:'center',gap:7},
  footText: {color:'#8fa7be',fontWeight:'800',fontSize:11,letterSpacing:1},
  footNote: {color:'#7d8b9c',fontSize:11,textAlign:'center',lineHeight:17},
  footWarning: {color:'#f6ac76',fontSize:10,textAlign:'center',lineHeight:15,marginTop:3},
});
