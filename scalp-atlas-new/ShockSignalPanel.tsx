import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Signal = 'BUY' | 'SELL' | 'NONE';

type Props = {
  signal: Signal;
  probability: number | null;
  live: boolean;
  onBellPress?: () => void;
  sourceConfirmed?: boolean;
};

/**
 * Compact ScalpAtlas SHOCK display.
 * This component is presentation only: it never claims a screenshot is live,
 * never calculates a trading probability, and never emits a trading alert.
 */
export default function ShockSignalPanel({ signal, probability, live, onBellPress, sourceConfirmed = false }: Props) {
  const active = sourceConfirmed && live && signal !== 'NONE';
  const displayedSignal: Signal = active ? signal : 'NONE';
  const color = displayedSignal === 'BUY' ? '#1ed981' : displayedSignal === 'SELL' ? '#ff5364' : '#9ba6b8';
  const score = active && probability != null && Number.isFinite(probability)
    ? Math.max(0, Math.min(100, Math.round(probability)))
    : null;

  return (
    <View style={styles.panel} accessibilityLabel="Scalp Atlas, panou semnal">
      <View style={styles.header}>
        <Text style={styles.title}>Scalp Atlas 3.2.7</Text>
        {onBellPress ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Setări alertă sonoră" onPress={onBellPress}>
            <Text style={styles.bell}>🔔</Text>
          </Pressable>
        ) : <Text style={styles.bell}>🔔</Text>}
      </View>
      <View style={styles.left}>
        <View style={styles.wick} />
        <View style={[styles.candle, { backgroundColor: color }]} />
        <Text style={[styles.live, { color: live ? '#1ed981' : '#9ba6b8' }]}>
          {live && sourceConfirmed ? 'LIVE' : 'NECONFIRMAT'}
        </Text>
      </View>
      <View style={[styles.circle, { borderColor: active ? color : '#344053' }]}>
        <Text style={[styles.percent, { color }]}>{score === null ? '—' : score + '%'}</Text>
        <Text style={[styles.direction, { color }]}>
          {displayedSignal === 'BUY' ? '↑ BUY' : displayedSignal === 'SELL' ? '↓ SELL' : 'AȘTEAPTĂ'}
        </Text>
      </View>
      <Text style={styles.note}>
        {live && sourceConfirmed ? 'Date LIVE confirmate' : 'Fără flux LIVE confirmat — fără semnal de tranzacționare'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, paddingTop: 52, backgroundColor: '#f3f3f3', borderRadius: 16, alignItems: 'center', gap: 10 },
  header: { position: 'absolute', top: 12, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#171717', fontSize: 15, fontWeight: '700' },
  bell: { color: '#171717', fontSize: 22 },
  left: { position: 'absolute', left: 30, top: 34, alignItems: 'center' },
  wick: { width: 3, height: 96, backgroundColor: '#1ed981' },
  candle: { position: 'absolute', top: 23, width: 31, height: 52, borderRadius: 3 },
  live: { marginTop: 8, fontSize: 11, fontWeight: '800' },
  circle: { marginLeft: 82, width: 150, height: 150, borderRadius: 75, borderWidth: 5, justifyContent: 'center', alignItems: 'center' },
  percent: { fontSize: 31, fontWeight: '800' },
  direction: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  note: { color: '#555555', fontSize: 11, textAlign: 'center', marginTop: 5 },
});
