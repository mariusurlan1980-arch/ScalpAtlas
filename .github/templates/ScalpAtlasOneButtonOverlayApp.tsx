// One-phone LIVE overlay entry point (Android 14 / Motorola G24).
// No camera, tutorial carousel, second-phone steps or broker automation.
// Native MediaProjection permission is requested at every Android session.
import React, { useEffect, useRef, useState } from 'react';
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
  const [status, setStatus] = useState('Pregătit pentru capturare. Semnalele ȘOC necesită validarea datelor live.');
  const busy = useRef(false);
  const [installedBuild, setInstalledBuild] = useState('Se verifică versiunea instalată…');

  useEffect(() => {
    let alive = true;
    if (Platform.OS !== 'android' || !NativeModules.ScalpOverlay?.getBuildInfo) {
      setInstalledBuild('Compilare Android neidentificată');
      return () => { alive = false; };
    }
    NativeModules.ScalpOverlay.getBuildInfo()
      .then((value: unknown) => {
        if (alive) setInstalledBuild(String(value));
      })
      .catch(() => {
        if (alive) setInstalledBuild('Compilare Android neidentificată');
      });
    return () => { alive = false; };
  }, []);

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
          <Text style={styles.subtitle}>ȘOC  /  SUPRAPUNERE LIVE</Text>
        </View>

        <View style={styles.center}>
          <View style={styles.pill}>
            <View style={[styles.led, active && styles.ledOn]} />
            <Text style={styles.pillText}>{active ? 'LIVE' : session === 'STARTING' ? 'PORNIRE' : 'OPRIT'}</Text>
          </View>

          <Text style={styles.timeframe}>ȘOC<Text style={styles.accent}>.</Text></Text>
          <Text style={styles.expiry}>M5  ·  M10  ·  M15  /  AUTO</Text>
          <Text style={styles.direction}>↗  BUY    ↘  SELL</Text>
          <Text style={styles.muted}>O SINGURĂ LUMÂNARE</Text><Text style={styles.mutedDetail}>Retragere puternică  →  Revenire</Text>

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
            <Text style={[styles.buttonText, active && styles.buttonTextOn]}>{active ? 'OPREȘTE LIVE' : 'PORNEȘTE LIVE'}</Text>
          </Pressable>

          <Text style={styles.status}>{status}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footText}>UN SINGUR TELEFON • CAPTURĂ ECRAN</Text>
          <Text style={styles.buildInfo}>{installedBuild}</Text>
          <Text style={styles.footNote}>Fereastra se suprapune peste broker. Nu presupune că semnalele sunt valide.</Text>
          <Text style={styles.footWarning}>Motor experimental. Nu tranzacționa bani reali pe semnale neverificate.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex:1,backgroundColor:'#080b10'},
  page: {flex:1,paddingHorizontal:26,justifyContent:'space-between',paddingBottom:26},
  header: {paddingTop:42,alignItems:'center'},
  titleRow: {flexDirection:'row',justifyContent:'center'},
  brand: {fontSize:31,fontWeight:'900',letterSpacing:1.1},
  brandCyan: {color:'#f3f5f8'},
  brandViolet: {color:'#f3f5f8'},
  brandPink: {color:'#39e8a3'},
  subtitle: {color:'#8293a5',fontSize:11,fontWeight:'800',letterSpacing:2.4,marginTop:10},
  center: {alignItems:'center',justifyContent:'center'},
  pill: {flexDirection:'row',alignItems:'center',marginBottom:32,backgroundColor:'#151c24',paddingHorizontal:18,paddingVertical:9,borderRadius:28},
  led: {height:9,width:9,borderRadius:5,backgroundColor:'#e4676b',marginRight:10},
  ledOn: {backgroundColor:'#39e8a3'},
  pillText: {color:'#e5edf5',fontSize:12,fontWeight:'900',letterSpacing:2},
  timeframe: {fontSize:82,color:'#f7f9fb',fontWeight:'900',letterSpacing:2},
  accent: {color:'#39e8a3'},
  expiry: {fontSize:12,color:'#90a4b7',fontWeight:'800',letterSpacing:1.5,marginTop:6},
  direction: {fontSize:22,fontWeight:'900',color:'#dce8f3',marginTop:34,letterSpacing:1},
  muted: {color:'#e8eff5',fontSize:13,fontWeight:'800',letterSpacing:1.4,marginTop:22},
  mutedDetail: {color:'#8396a9',fontSize:12,marginTop:10,marginBottom:40},
  button: {backgroundColor:'#39e8a3',minHeight:70,borderRadius:20,paddingHorizontal:24,
    width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'center'},
  buttonOn: {backgroundColor:'#d94f60'},
  buttonLed: {width:11,height:11,borderRadius:6,backgroundColor:'#0a1713',marginRight:12},
  buttonLedOn: {backgroundColor:'#ffffff'},
  buttonText: {color:'#07140f',fontWeight:'900',fontSize:17,letterSpacing:.8},
  buttonTextOn: {color:'#ffffff'},
  spinner: {marginRight:12},
  disabled: {opacity:.6},
  status: {color:'#b4c2cf',fontSize:12,lineHeight:19,textAlign:'center',marginTop:23,
    minHeight:60,maxWidth:340},
  footer: {alignItems:'center',gap:8},
  footText: {color:'#8b9dae',fontWeight:'800',fontSize:10,letterSpacing:1.2},
  buildInfo: {color:'#39e8a3',fontWeight:'700',fontSize:11,textAlign:'center',marginTop:8},
  footNote: {color:'#6f7f8f',fontSize:11,textAlign:'center',lineHeight:17},
  footWarning: {color:'#e5aa78',fontSize:10,textAlign:'center',lineHeight:15,marginTop:5},
});
