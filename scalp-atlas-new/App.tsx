import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ANALYSIS_ENGINE_HTML } from './analysisEngine';
import { SCALP_ATLAS_COUNT } from './atlas';

type SelectedImage = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  base64?: string | null;
};

type AnalysisResult = {
  signal: 'BUY' | 'SELL' | 'NONE';
  pattern: string;
  probability: number;
  expiry: number | null;
  reason: string;
  atlasCount: number;
  anchorX: number | null;
  anchorY: number | null;
  quality: number;
};

const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];

export default function App() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [timeframe, setTimeframe] = useState('M1');
  const [busy, setBusy] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [message, setMessage] = useState('Alege Camera sau Galerie pentru analiză.');
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 390 });
  const analyzerRef = useRef<WebView>(null);

  const useAsset = (asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'gallery') => {
    setImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
      base64: asset.base64,
    });
    setAnalysis(null);
    setMessage(
      source === 'camera'
        ? 'Fotografie realizată. Apasă ANALIZEAZĂ.'
        : 'Fotografie încărcată din galerie. Apasă ANALIZEAZĂ.'
    );
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (result && 'canceled' in result && !result.canceled && result.assets?.[0]) {
          useAsset(result.assets[0], 'camera');
        }
      })
      .catch(() => {});
  }, []);

  const openCamera = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage('Camera nu are permisiune. Activează permisiunea Camera pentru SCALP ATLAS.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        cameraType: ImagePicker.CameraType.back,
        allowsEditing: false,
        quality: 0.65,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) useAsset(result.assets[0], 'camera');
      else setMessage('Camera a fost închisă fără fotografie.');
    } catch (error) {
      setMessage(`Camera nu s-a deschis: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    } finally {
      setBusy(false);
    }
  };

  const openGallery = async () => {
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.65,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) useAsset(result.assets[0], 'gallery');
      else setMessage('Galeria a fost închisă fără selecție.');
    } catch (error) {
      setMessage(`Galeria nu s-a deschis: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    } finally {
      setBusy(false);
    }
  };

  const analyzeImage = () => {
    if (!image?.base64) {
      setMessage('Imaginea nu conține datele necesare analizei. Reîncarcă fotografia din Cameră sau Galerie.');
      return;
    }
    if (!engineReady || !analyzerRef.current) {
      setMessage('Motorul Atlas se inițializează. Încearcă din nou imediat.');
      return;
    }
    setBusy(true);
    setAnalysis(null);
    setMessage(`Analizez fotografia cu atlasul de ${SCALP_ATLAS_COUNT} modele…`);
    analyzerRef.current.postMessage(
      JSON.stringify({ type: 'ANALYZE', dataUrl: `data:image/jpeg;base64,${image.base64}`, timeframe })
    );
  };

  const onAnalyzerMessage = (event: WebViewMessageEvent) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload.type === 'READY') {
        setEngineReady(payload.atlasCount === SCALP_ATLAS_COUNT);
        return;
      }
      if (payload.type === 'RESULT') {
        const result = payload.result as AnalysisResult;
        setAnalysis(result);
        setBusy(false);
        setMessage(
          result.signal === 'NONE'
            ? result.reason || 'Fără semnal clar.'
            : `${result.signal} • ${result.pattern} • ${result.probability}%`
        );
        return;
      }
      if (payload.type === 'ERROR') {
        setBusy(false);
        setMessage(`Analiza nu a reușit: ${payload.message || 'eroare necunoscută'}`);
      }
    } catch {
      setBusy(false);
      setMessage('Motorul Atlas a trimis un rezultat invalid.');
    }
  };

  const onPreviewLayout = (e: LayoutChangeEvent) => {
    setPreviewSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const arrowStyle = useMemo(() => {
    if (
      !analysis || analysis.signal === 'NONE' || analysis.anchorX == null || analysis.anchorY == null ||
      !image?.width || !image?.height || !previewSize.width
    ) return null;
    const scale = Math.min(previewSize.width / image.width, previewSize.height / image.height);
    const displayW = image.width * scale;
    const displayH = image.height * scale;
    const offsetX = (previewSize.width - displayW) / 2;
    const offsetY = (previewSize.height - displayH) / 2;
    return {
      left: Math.min(previewSize.width - 42, Math.max(4, offsetX + analysis.anchorX * displayW + 8)),
      top: Math.min(previewSize.height - 48, Math.max(4, offsetY + analysis.anchorY * displayH - 24)),
    };
  }, [analysis, image, previewSize]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SCALP ATLAS</Text>
            <Text style={styles.subtitle}>{SCALP_ATLAS_COUNT} modele • Cameră + Galerie • Atlas Engine</Text>
          </View>
          <View style={styles.timer}><Text style={styles.timerText}>00:00</Text></View>
        </View>

        <View style={styles.timeframeRow}>
          {TIMEFRAMES.map((item) => (
            <Pressable
              key={item}
              onPress={() => { setTimeframe(item); setAnalysis(null); }}
              style={[styles.tfButton, timeframe === item && styles.tfButtonActive]}
            >
              <Text style={[styles.tfText, timeframe === item && styles.tfTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={openCamera} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>CAMERĂ</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={openGallery} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>GALERIE</Text>
          </Pressable>
        </View>

        <View style={styles.preview} onLayout={onPreviewLayout}>
          {image ? (
            <Image source={{ uri: image.uri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.center}>
              <Text style={styles.placeholderTitle}>PREVIZUALIZARE</Text>
              <Text style={styles.hint}>Fotografia originală va apărea aici fără canale sau linii.</Text>
            </View>
          )}
          {busy && (
            <View style={styles.busyOverlay}>
              <ActivityIndicator size="large" />
              <Text style={styles.hint}>Se procesează…</Text>
            </View>
          )}
          {arrowStyle && analysis && (
            <View style={[styles.arrowWrap, arrowStyle]} pointerEvents="none">
              <Text style={[styles.arrow, analysis.signal === 'BUY' ? styles.buy : styles.sell]}>
                {analysis.signal === 'BUY' ? '↑' : '↓'}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          disabled={!image || busy}
          onPress={analyzeImage}
          style={[styles.analyzeButton, (!image || busy) && styles.analyzeButtonDisabled]}
        >
          <Text style={styles.analyzeText}>{busy ? 'ANALIZEZ…' : `ANALIZEAZĂ CU ${SCALP_ATLAS_COUNT} MODELE`}</Text>
        </Pressable>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>REZULTAT</Text>
          {analysis ? (
            <>
              <Text style={[
                styles.signalText,
                analysis.signal === 'BUY' ? styles.buy : analysis.signal === 'SELL' ? styles.sell : styles.neutral,
              ]}>
                {analysis.signal === 'NONE' ? 'FĂRĂ SEMNAL CLAR' : analysis.signal}
              </Text>
              <Text style={styles.statusText}>Model: {analysis.pattern || '—'}</Text>
              <Text style={styles.statusText}>Probabilitate: {analysis.probability}%</Text>
              <Text style={styles.statusText}>Expirare recomandată: {analysis.expiry ? `${analysis.expiry} min` : '—'}</Text>
              <Text style={styles.statusSmall}>Calitate captură: {analysis.quality}% • Atlas: {analysis.atlasCount}/70</Text>
            </>
          ) : (
            <Text style={styles.statusText}>{message}</Text>
          )}
          <Text style={styles.statusSmall}>Timeframe selectat: {timeframe} • Motor: {engineReady ? 'PREGĂTIT' : 'INIȚIALIZARE'}</Text>
        </View>

        <Text style={styles.footer}>
          Semnalul este afișat numai când potrivirea depășește pragul intern; altfel aplicația afișează „Fără semnal clar”. Probabilitatea este o estimare structurală, nu o garanție de tranzacționare.
        </Text>
      </ScrollView>

      {Platform.OS !== 'web' && (
        <WebView
          ref={analyzerRef}
          source={{ html: ANALYSIS_ENGINE_HTML }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled={false}
          onMessage={onAnalyzerMessage}
          onLoadEnd={() => setEngineReady(true)}
          style={styles.hiddenAnalyzer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070b12' },
  page: { flexGrow: 1, padding: 18, gap: 16, backgroundColor: '#070b12' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: '#f7fafc', fontSize: 25, fontWeight: '900', letterSpacing: 1.4 },
  subtitle: { color: '#7f8b9e', marginTop: 4, fontSize: 12 },
  timer: { borderWidth: 1, borderColor: '#253044', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  timerText: { color: '#aeb8c8', fontWeight: '700', fontVariant: ['tabular-nums'] },
  timeframeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tfButton: { minWidth: 46, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: '#253044', alignItems: 'center' },
  tfButtonActive: { backgroundColor: '#f1f5f9', borderColor: '#f1f5f9' },
  tfText: { color: '#91a0b4', fontSize: 12, fontWeight: '800' },
  tfTextActive: { color: '#0a0e15' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryButton: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryButtonText: { color: '#090d14', fontWeight: '900', letterSpacing: 0.6 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: '#49566d', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  secondaryButtonText: { color: '#eef2f7', fontWeight: '900', letterSpacing: 0.6 },
  preview: { height: 390, borderRadius: 18, borderWidth: 1, borderColor: '#1f2937', overflow: 'hidden', backgroundColor: '#0c121c' },
  image: { width: '100%', height: '100%', backgroundColor: '#05070b' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  busyOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(5,7,11,0.78)' },
  placeholderTitle: { color: '#cbd5e1', fontSize: 18, fontWeight: '900', letterSpacing: 1.2 },
  hint: { color: '#93a1b5', textAlign: 'center', lineHeight: 19 },
  arrowWrap: { position: 'absolute', width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  arrow: { fontSize: 42, lineHeight: 44, fontWeight: '900', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  buy: { color: '#38d996' },
  sell: { color: '#ff6464' },
  neutral: { color: '#d5dde8' },
  analyzeButton: { backgroundColor: '#182233', borderRadius: 12, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#2a3a52' },
  analyzeButtonDisabled: { opacity: 0.45 },
  analyzeText: { color: '#e6edf7', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  statusCard: { backgroundColor: '#0c121c', borderRadius: 14, borderWidth: 1, borderColor: '#1f2937', padding: 14, gap: 7 },
  statusTitle: { color: '#7f8b9e', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  signalText: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  statusText: { color: '#edf2f7', fontSize: 14, lineHeight: 20 },
  statusSmall: { color: '#728095', fontSize: 12 },
  footer: { color: '#5f6c7e', fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 12 },
  hiddenAnalyzer: { position: 'absolute', left: -20, top: -20, width: 2, height: 2, opacity: 0.01 },
});
