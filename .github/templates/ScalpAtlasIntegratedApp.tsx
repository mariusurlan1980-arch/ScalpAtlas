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
          style={[styles.switchButton, mode === 'LIVE' && styles.liveActive]}
        >
          <Text style={[styles.switchText, mode === 'LIVE' && styles.liveTextActive]}>LIVE</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {mode === 'ANALYSIS' ? <StableAnalysisApp /> : <LiveAnalysisApp />}
      </View>
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
  },
  switchButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2b374b',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#0c121c',
  },
  switchActive: { backgroundColor: '#edf2f7', borderColor: '#edf2f7' },
  liveActive: { backgroundColor: '#123a2b', borderColor: '#38d996' },
  switchText: { color: '#8796aa', fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  switchTextActive: { color: '#090d14' },
  liveTextActive: { color: '#71f0b3' },
  content: { flex: 1 },
});
