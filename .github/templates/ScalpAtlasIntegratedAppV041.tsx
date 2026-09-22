import React, { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import StableAnalysisApp from './StableAnalysisApp';
import LiveAnalysisApp from './LiveAnalysisApp';

type Mode = 'ANALYSIS' | 'LIVE';

export default function App() {
  const [mode, setMode] = useState<Mode>('ANALYSIS');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      <View style={styles.switchBar}>
        <Pressable
          onPress={() => setMode('ANALYSIS')}
          style={[styles.switchButton, mode === 'ANALYSIS' && styles.switchActive]}
        >
          <Text style={[styles.switchText, mode === 'ANALYSIS' && styles.switchTextActive]}>ANALIZĂ</Text>
        </Pressable>

        <Pressable
          onPress={() => setMode('LIVE')}
          style={[styles.switchButton, styles.liveTab, mode === 'LIVE' && styles.liveActive]}
        >
          <Text style={[styles.switchText, styles.liveTabText, mode === 'LIVE' && styles.liveTextActive]}>● LIVE</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {mode === 'ANALYSIS' ? <StableAnalysisApp /> : <LiveAnalysisApp />}
      </View>

      {mode === 'ANALYSIS' && (
        <Pressable onPress={() => setMode('LIVE')} style={styles.liveFloating}>
          <Text style={styles.liveFloatingDot}>●</Text>
          <View>
            <Text style={styles.liveFloatingTitle}>VIDEO LIVE</Text>
            <Text style={styles.liveFloatingSub}>DESCHIDE CAMERA LIVE</Text>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#070b12' },
  switchBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: '#070b12',
    borderBottomWidth: 1,
    borderBottomColor: '#172233',
    zIndex: 50,
  },
  switchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2b374b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0c121c',
  },
  switchActive: { backgroundColor: '#edf2f7', borderColor: '#edf2f7' },
  liveTab: { borderColor: '#38d996' },
  liveActive: { backgroundColor: '#123a2b', borderColor: '#38d996' },
  switchText: { color: '#8796aa', fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  switchTextActive: { color: '#090d14' },
  liveTabText: { color: '#71f0b3' },
  liveTextActive: { color: '#8ff7c7' },
  content: { flex: 1 },

  liveFloating: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    zIndex: 100,
    elevation: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 2,
    borderColor: '#38d996',
    backgroundColor: '#123a2b',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  liveFloatingDot: { color: '#38d996', fontSize: 19, fontWeight: '900' },
  liveFloatingTitle: { color: '#f1fff8', fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  liveFloatingSub: { color: '#8bdab5', fontSize: 8, fontWeight: '800', marginTop: 1 },
});
