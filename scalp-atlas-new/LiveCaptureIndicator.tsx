import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Props = { captureActive: boolean; size?: number };

/**
 * Camera LIVE variant 3 — glowing ring.
 * captureActive MUST be supplied by the real capture pipeline after it has
 * successfully delivered a fresh frame, not merely from the overlay's ON state.
 */
export function LiveCaptureIndicator({ captureActive, size = 48 }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(1);
    if (!captureActive) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.14, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [captureActive, pulse]);

  const color = captureActive ? '#FF474D' : '#727B89';
  return (
    <View accessibilityLabel={captureActive ? 'Captură LIVE activă' : 'Captură LIVE inactivă'} style={styles.row}>
      <Animated.View style={[styles.ring, {
        width: size, height: size, borderRadius: size / 2, borderColor: color,
        transform: [{ scale: pulse }],
      }]}>
        <View style={[styles.core, { width: size * 0.45, height: size * 0.45, borderRadius: size * 0.225, backgroundColor: color }]} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>{captureActive ? 'LIVE' : 'OFF'}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, backgroundColor: '#1D2430' },
  core: { opacity: 0.95 },
  label: { fontSize: 14, fontWeight: '700' },
});
