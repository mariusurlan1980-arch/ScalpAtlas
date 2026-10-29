import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type Props = { captureActive: boolean; size?: number };

/**
 * Larger violet LIVE capture dot (v3).
 * A purple pulse is shown only after a fresh frame has been captured.
 * This is an indicator, not a screen-capture implementation.
 */
export function LiveCaptureIndicator({ captureActive, size = 46 }: Props) {
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

  const color = captureActive ? '#B86BFF' : '#68567D';
  const coreSize = Math.round(size * 0.49);
  return (
    <View accessibilityLabel={captureActive ? 'Captură LIVE activă' : 'Captură LIVE inactivă'} style={styles.row}>
      <Animated.View style={[styles.ring, {
        width: size, height: size, borderRadius: size / 2, borderColor: color,
        backgroundColor: captureActive ? '#362041' : '#252036',
        transform: [{ scale: pulse }],
      }]}>
        <View style={[styles.core, {
          width: coreSize,
          height: coreSize,
          borderRadius: coreSize / 2,
          backgroundColor: color,
        }]} />
      </Animated.View>
      <Text style={[styles.label, { color: captureActive ? '#D7A8FF' : '#8F839F' }]}>
        {captureActive ? 'LIVE' : 'OFF'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  core: { opacity: 0.98 },
  label: { fontSize: 14, fontWeight: '700' },
});
