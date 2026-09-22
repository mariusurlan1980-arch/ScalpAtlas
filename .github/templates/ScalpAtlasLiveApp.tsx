import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ANALYSIS_ENGINE_HTML } from './analysisEngine';
import { SCALP_ATLAS_COUNT } from './atlas';

type AnalysisResult = {
  signal: 'BUY' | 'SELL' | 'NONE';
  state?: 'SIGNAL' | 'WAIT' | 'NONE' | 'INVALID';
  bias?: 'BUY' | 'SELL' | null;
  pattern: string;
  probability: number;
  expiry: number | null;
  reason: string;
  atlasCount: number;
  quality: number;
};

const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];
const SCAN_INTERVAL_MS = 3000;

export default function App() {
  const cameraRef = useRef<CameraView | null>(null);
  const analyzerRef = useRef<WebView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef(false);
  const captureBusyRef = useRef(false);
  const engineReadyRef = useRef(false);
  const timeframeRef = useRef('M15');

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [live, setLive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [timeframe, setTimeframe] = useState('M15');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState('Poziționează graficul în chenar și blochează cadrul.');

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    engineReadyRef.current = engineReady;
  }, [engineReady]);

  useEffect(() => {
    return () => {
      liveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const scheduleNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!liveRef.current) return;
    timerRef.current = setTimeout(() => {
      void captureAndAnalyze();
    }, SCAN_INTERVAL_MS);
  };

  const captureAndAnalyze = async () => {
    if (!liveRef.current) return;
    if (!locked || !cameraReady || !engineReadyRef.current || !cameraRef.current || !analyzerRef.current) {
      scheduleNext();
      return;
    }
    if (captureBusyRef.current) {
      scheduleNext();
      return;
    }

    captureBusyRef.current = true;
    setScanning(true);
    setMessage('Analizez cadrul live…');

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.35,
        base64: true,
        skipProcessing: true,
      });

      if (!picture?.base64) {
        captureBusyRef.current = false;
        setScanning(false);
        setMessage('Nu am putut citi cadrul. Reiau automat.');
        scheduleNext();
        return;
      }

      analyzerRef.current.postMessage(
        JSON.stringify({
          type: 'ANALYZE',
          dataUrl: `data:image/jpeg;base64,${picture.base64}`,
          timeframe: timeframeRef.current,
        })
      );
    } catch (error) {
      captureBusyRef.current = false;
      setScanning(false);
      setMessage(`Camera nu a putut captura cadrul: ${error instanceof Error ? error.message : 'eroare'}`);
      scheduleNext();
    }
  };

  const startLive = () => {
    if (!locked) {
      setMessage('Apasă mai întâi BLOCHEAZĂ GRAFICUL.');
      return;
    }
    if (!cameraReady || !engineReady) {
      setMessage('Camera sau motorul Atlas încă se pregătește.');
      return;
    }

    liveRef.current = true;
    setLive(true);
    setMessage('LIVE pornit. Urmăresc permanent graficul.');
    void captureAndAnalyze();
  };

  const pauseLive = () => {
    liveRef.current = false;
    setLive(false);
    setScanning(false);
    captureBusyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage('LIVE este în pauză. Camera rămâne poziționată.');
  };

  const stopLive = () => {
    pauseLive();
    setLocked(false);
    setAnalysis(null);
    setMessage('LIVE oprit. Poziționează din nou graficul și blochează cadrul.');
  };

  const toggleLock = () => {
    if (live) return;
    setLocked((value) => {
      const next = !value;
      setMessage(next
        ? 'Grafic blocat. Poți porni analiza LIVE.'
        : 'Blocarea a fost eliberată. Repoziționează graficul.');
      return next;
    });
  };

  const onAnalyzerMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);

      if (payload.type === 'READY') {
        const ok = payload.atlasCount === SCALP_ATLAS_COUNT;
        setEngineReady(ok);
        engineReadyRef.current = ok;
        return;
      }

      if (payload.type === 'RESULT') {
        const result = payload.result as AnalysisResult;
        setAnalysis(result);
        captureBusyRef.current = false;
        setScanning(false);

        if (result.state === 'WAIT' && result.bias) {
          setMessage(`Așteaptă confirmare ${result.bias}. Urmărirea continuă automat.`);
        } else if (result.signal === 'BUY' || result.signal === 'SELL') {
          setMessage(`${result.signal} detectat. Urmărirea continuă pentru schimbări.`);
        } else {
          setMessage(result.reason || 'Fără semnal clar. Urmărirea continuă.');
        }

        scheduleNext();
      }
    } catch {
      captureBusyRef.current = false;
      setScanning(false);
      setMessage('Motorul a returnat un răspuns invalid. Reiau automat.');
      scheduleNext();
    }
  };

  const resultTitle = analysis
    ? analysis.state === 'WAIT'
      ? (analysis.bias ? `AȘTEAPTĂ CONFIRMARE ${analysis.bias}` : 'AȘTEAPTĂ CONFIRMAREA')
      : analysis.signal === 'NONE'
        ? 'FĂRĂ SEMNAL CLAR'
        : analysis.signal
    : 'ÎN AȘTEPTARE';

  const resultStyle =
    analysis?.signal === 'BUY' || analysis?.bias === 'BUY'
      ? styles.buy
      : analysis?.signal === 'SELL' || analysis?.bias === 'SELL'
        ? styles.sell
        : styles.neutral;

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.neutral}>Inițializez camera…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <View style={styles.center}>
          <Text style={styles.title}>SCALP ATLAS LIVE</Text>
          <Text style={styles.help}>Camera este necesară pentru a urmări graficul de pe al doilea dispozitiv.</Text>
          <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
            <Text style={styles.primaryText}>PERMITE CAMERA</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>SCALP ATLAS LIVE</Text>
          <Text style={styles.subtitle}>v0.1 • cameră continuă • {SCALP_ATLAS_COUNT} modele</Text>
        </View>
        <View style={[styles.livePill, live ? styles.liveOn : styles.liveOff]}>
          <Text style={styles.liveText}>{live ? '● LIVE' : '○ OFF'}</Text>
        </View>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />

        <View pointerEvents="none" style={[styles.scanFrame, locked && styles.scanFrameLocked]}>
          <Text style={styles.frameLabel}>{locked ? 'GRAFIC BLOCAT' : 'ÎNCADREAZĂ GRAFICUL AICI'}</Text>
        </View>

        <View style={styles.overlayTop}>
          <Text style={styles.overlayText}>
            {scanning ? 'ANALIZEZ…' : live ? 'URMĂRIRE ACTIVĂ' : locked ? 'GATA DE LIVE' : 'POZIȚIONEAZĂ CAMERA'}
          </Text>
        </View>
      </View>

      <View style={styles.tfRow}>
        {TIMEFRAMES.map((tf) => (
          <Pressable
            key={tf}
            disabled={live}
            onPress={() => setTimeframe(tf)}
            style={[styles.tfButton, timeframe === tf && styles.tfActive, live && styles.tfDisabled]}
          >
            <Text style={[styles.tfText, timeframe === tf && styles.tfTextActive]}>{tf}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.lockButton, locked && styles.lockButtonActive]} onPress={toggleLock}>
          <Text style={styles.actionText}>{locked ? 'DEBLOCHEAZĂ GRAFICUL' : 'BLOCHEAZĂ GRAFICUL'}</Text>
        </Pressable>

        {!live ? (
          <Pressable style={[styles.primaryButton, (!locked || !cameraReady || !engineReady) && styles.disabled]} onPress={startLive}>
            <Text style={styles.primaryText}>PORNEȘTE LIVE</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.pauseButton} onPress={pauseLive}>
            <Text style={styles.actionText}>PAUZĂ</Text>
          </Pressable>
        )}

        <Pressable style={styles.stopButton} onPress={stopLive}>
          <Text style={styles.actionText}>OPREȘTE</Text>
        </Pressable>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>REZULTAT LIVE • {timeframe}</Text>
        <Text style={[styles.resultTitle, resultStyle]}>{resultTitle}</Text>
        {analysis ? (
          <>
            <Text style={styles.resultLine}>Model: {analysis.pattern || '—'}</Text>
            <Text style={styles.resultLine}>
              {analysis.state === 'WAIT' || analysis.signal === 'NONE' ? 'Scor structură' : 'Scor semnal'}: {analysis.probability}%
            </Text>
            <Text style={styles.resultLine}>Expirare recomandată: {analysis.expiry ? `${analysis.expiry} min` : '—'}</Text>
            <Text style={styles.reason}>{analysis.reason}</Text>
          </>
        ) : (
          <Text style={styles.reason}>{message}</Text>
        )}
        <Text style={styles.status}>
          Cameră: {cameraReady ? 'PREGĂTITĂ' : 'INIȚIALIZARE'} • Motor: {engineReady ? 'PREGĂTIT' : 'INIȚIALIZARE'} • Reanalizare: ~3 sec
        </Text>
      </View>

      <View style={styles.messageBar}>
        <Text style={styles.messageText}>{message}</Text>
      </View>

      <WebView
        ref={analyzerRef}
        source={{ html: ANALYSIS_ENGINE_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        onMessage={onAnalyzerMessage}
        onLoadEnd={() => {
          setEngineReady(true);
          engineReadyRef.current = true;
        }}
        style={styles.hiddenAnalyzer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070b12', paddingHorizontal: 12, paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  title: { color: '#f8fbff', fontSize: 23, fontWeight: '900', letterSpacing: 0.8 },
  subtitle: { color: '#7f8b9e', fontSize: 11, marginTop: 2 },
  help: { color: '#b6c2d1', textAlign: 'center', lineHeight: 20 },
  livePill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  liveOn: { borderColor: '#ff5c5c', backgroundColor: 'rgba(90,15,15,0.55)' },
  liveOff: { borderColor: '#39465a', backgroundColor: '#101722' },
  liveText: { color: '#f7f9fc', fontSize: 12, fontWeight: '900' },

  cameraWrap: { height: 330, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#263247', backgroundColor: '#0d131d' },
  scanFrame: { position: 'absolute', left: '5%', right: '5%', top: '11%', bottom: '11%', borderWidth: 2, borderColor: '#ffd34d', borderRadius: 12 },
  scanFrameLocked: { borderColor: '#38d996', borderWidth: 3 },
  frameLabel: { position: 'absolute', top: 6, alignSelf: 'center', color: '#ffffff', fontSize: 11, fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  overlayTop: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.58)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  overlayText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },

  tfRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tfButton: { minWidth: 42, alignItems: 'center', borderWidth: 1, borderColor: '#2b374b', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  tfActive: { backgroundColor: '#edf2f7', borderColor: '#edf2f7' },
  tfDisabled: { opacity: 0.55 },
  tfText: { color: '#8fa0b8', fontWeight: '800', fontSize: 11 },
  tfTextActive: { color: '#0a0f16' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  lockButton: { flexGrow: 1, minWidth: 155, borderWidth: 1, borderColor: '#ffd34d', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  lockButtonActive: { borderColor: '#38d996', backgroundColor: 'rgba(13,55,40,0.42)' },
  primaryButton: { flexGrow: 1, minWidth: 120, backgroundColor: '#eaf1f8', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  pauseButton: { flexGrow: 1, minWidth: 100, borderWidth: 1, borderColor: '#ffd34d', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  stopButton: { flexGrow: 1, minWidth: 90, borderWidth: 1, borderColor: '#ff6464', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  actionText: { color: '#eef3f8', fontWeight: '900', fontSize: 11 },
  primaryText: { color: '#0b1017', fontWeight: '900', fontSize: 11 },

  resultCard: { marginTop: 10, borderWidth: 1, borderColor: '#253044', borderRadius: 14, padding: 12, backgroundColor: '#0e151f' },
  resultLabel: { color: '#7f8b9e', fontSize: 11, fontWeight: '800' },
  resultTitle: { fontSize: 22, fontWeight: '900', marginTop: 3, marginBottom: 5 },
  resultLine: { color: '#dce5f0', fontSize: 12, lineHeight: 18 },
  reason: { color: '#a9b7c9', fontSize: 11, lineHeight: 16, marginTop: 4 },
  status: { color: '#65758a', fontSize: 9, marginTop: 6 },
  buy: { color: '#38d996' },
  sell: { color: '#ff6464' },
  neutral: { color: '#dce3ed' },

  messageBar: { marginTop: 8, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#0b111a' },
  messageText: { color: '#8ea0b6', fontSize: 10, lineHeight: 14 },

  hiddenAnalyzer: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -20, top: -20 },
});
