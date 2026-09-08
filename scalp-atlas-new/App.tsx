import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

type SelectedImage = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
};

const TIMEFRAMES = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'H1'];

export default function App() {
  const [image, setImage] = useState<SelectedImage | null>(null);
  const [timeframe, setTimeframe] = useState('M1');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Alege Camera sau Galerie pentru primul test.');

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    ImagePicker.getPendingResultAsync()
      .then((result) => {
        if (result && 'canceled' in result && !result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          setImage({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
            fileName: asset.fileName,
          });
          setMessage('Fotografia a fost recuperată și este gata pentru analiză.');
        }
      })
      .catch(() => {
        // Rezultatul în așteptare este opțional; fluxul normal al camerei rămâne activ.
      });
  }, []);

  const useAsset = (asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'gallery') => {
    setImage({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName,
    });
    setMessage(
      source === 'camera'
        ? 'Fotografie realizată. Previzualizarea funcționează.'
        : 'Fotografie încărcată din galerie. Previzualizarea funcționează.'
    );
  };

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
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]) {
        useAsset(result.assets[0], 'camera');
      } else {
        setMessage('Camera a fost închisă fără fotografie.');
      }
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
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]) {
        useAsset(result.assets[0], 'gallery');
      } else {
        setMessage('Galeria a fost închisă fără selecție.');
      }
    } catch (error) {
      setMessage(`Galeria nu s-a deschis: ${error instanceof Error ? error.message : 'eroare necunoscută'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>SCALP ATLAS</Text>
            <Text style={styles.subtitle}>Camera + Galerie • test funcțional</Text>
          </View>
          <View style={styles.timer}><Text style={styles.timerText}>00:00</Text></View>
        </View>

        <View style={styles.timeframeRow}>
          {TIMEFRAMES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setTimeframe(item)}
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

        <View style={styles.preview}>
          {busy ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" />
              <Text style={styles.hint}>Se deschide funcția sistemului…</Text>
            </View>
          ) : image ? (
            <Image source={{ uri: image.uri }} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.center}>
              <Text style={styles.placeholderTitle}>PREVIZUALIZARE</Text>
              <Text style={styles.hint}>Fotografia va apărea aici fără linii sau suprapuneri.</Text>
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>STARE</Text>
          <Text style={styles.statusText}>{message}</Text>
          <Text style={styles.statusSmall}>Timeframe selectat: {timeframe}</Text>
        </View>

        <Pressable disabled={!image} style={[styles.analyzeButton, !image && styles.analyzeButtonDisabled]}>
          <Text style={styles.analyzeText}>{image ? 'IMAGINE PREGĂTITĂ PENTRU ANALIZĂ' : 'ADAUGĂ O FOTOGRAFIE'}</Text>
        </Pressable>

        <Text style={styles.footer}>
          Etapa 1: Camera, Galerie și previzualizare. Motorul cu cele 70 de modele se adaugă numai după validarea acestei etape.
        </Text>
      </ScrollView>
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
  placeholderTitle: { color: '#cbd5e1', fontSize: 18, fontWeight: '900', letterSpacing: 1.2 },
  hint: { color: '#728095', textAlign: 'center', lineHeight: 19 },
  statusCard: { backgroundColor: '#0c121c', borderRadius: 14, borderWidth: 1, borderColor: '#1f2937', padding: 14, gap: 7 },
  statusTitle: { color: '#7f8b9e', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  statusText: { color: '#edf2f7', fontSize: 14, lineHeight: 20 },
  statusSmall: { color: '#728095', fontSize: 12 },
  analyzeButton: { backgroundColor: '#182233', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  analyzeButtonDisabled: { opacity: 0.45 },
  analyzeText: { color: '#e6edf7', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  footer: { color: '#5f6c7e', fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 12 },
});
