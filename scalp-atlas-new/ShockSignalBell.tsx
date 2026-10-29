import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

export type ShockSignal = 'BUY' | 'SELL' | 'WAIT';
type Props = {
  signal: ShockSignal;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestSound: () => void;
  size?: number;
};

/**
 * Variant 3: exactly one bell, drawn with native views, not an emoji.
 * The BELL itself changes color: green BUY, red SELL, gray WAIT/OFF.
 * Long press is an explicit BIP TEST; never creates a trading signal.
 * The confirmed signal engine alone triggers a real signal beep.
 */
export function ShockSignalBell({
  signal, soundEnabled, onToggleSound, onTestSound, size = 52,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const color = !soundEnabled
    ? '#737B88'
    : signal === 'BUY'
      ? '#27D67A'
      : signal === 'SELL'
        ? '#FF505B'
        : '#A9B0B8';

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!soundEnabled) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.13, duration: 500, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [soundEnabled, scale]);

  const bellWidth = Math.round(size * 0.48);
  const domeHeight = Math.round(size * 0.38);
  const bellBrimWidth = Math.round(size * 0.57);
  const handleSize = Math.max(4, Math.round(size * 0.10));
  const clapperSize = Math.max(5, Math.round(size * 0.12));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={soundEnabled ? 'Clopoțel pornit. Atinge pentru OFF' : 'Clopoțel oprit. Atinge pentru ON'}
      accessibilityState={{ selected: soundEnabled }}
      accessibilityHint="Apăsare scurtă: ON sau OFF. Ține apăsat pentru BIP de test, nu semnal de tranzacționare."
      onPress={onToggleSound}
      onLongPress={onTestSound}
      delayLongPress={650}
      style={[styles.hitArea, { width: size + 14, height: size + 14 }]}
    >
      <Animated.View style={[styles.circle, {
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: color,
        backgroundColor: soundEnabled && signal !== 'WAIT' ? color + '22' : '#1C2634',
        transform: [{ scale }],
      }]}>
        <View style={[styles.bellHandle, {
          width: handleSize, height: handleSize,
          borderRadius: handleSize / 2,
          backgroundColor: color,
        }]} />
        <View style={[styles.bellDome, {
          width: bellWidth, height: domeHeight,
          borderTopLeftRadius: bellWidth / 2,
          borderTopRightRadius: bellWidth / 2,
          backgroundColor: color,
        }]} />
        <View style={[styles.bellBrim, {
          width: bellBrimWidth, height: Math.max(3, Math.round(size * 0.07)),
          backgroundColor: color,
        }]} />
        <View style={[styles.bellClapper, {
          width: clapperSize, height: clapperSize,
          borderRadius: clapperSize / 2,
          backgroundColor: color,
        }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  bellHandle: { marginBottom: -1 },
  bellDome: {},
  bellBrim: { borderRadius: 3 },
  bellClapper: { marginTop: 1 },
});
