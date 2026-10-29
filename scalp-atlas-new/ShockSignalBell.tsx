import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

export type ShockSignal = 'BUY' | 'SELL' | 'WAIT';
type Props = {
  signal: ShockSignal;
  soundEnabled: boolean;
  onToggleSound: () => void;
  size?: number;
};

/**
 * Selected variant 3: one enlarged bell with directional color and pulse.
 * Visual animation only; NEVER generates trading signals or plays sound.
 * The confirmed signal engine remains responsible for exactly one beep.
 */
export function ShockSignalBell({ signal, soundEnabled, onToggleSound, size = 52 }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const active = signal !== 'WAIT';
  const color = !soundEnabled ? '#89919B' : signal === 'BUY' ? '#27D67A' : signal === 'SELL' ? '#FF505B' : '#A9B0B8';

  useEffect(() => {
    scale.stopAnimation();
    scale.setValue(1);
    if (!active || !soundEnabled) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.17, duration: 500, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [active, soundEnabled, scale, signal]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={soundEnabled ? 'Oprește sunetul semnalelor' : 'Pornește sunetul semnalelor'}
      accessibilityState={{ selected: soundEnabled }}
      onPress={onToggleSound}
      style={[styles.hitArea, { width: size + 14, height: size + 14 }]}
    >
      <Animated.View style={[styles.circle, {
        width: size, height: size, borderRadius: size / 2,
        borderColor: color, transform: [{ scale }],
        backgroundColor: soundEnabled && active ? color + '22' : '#1C2634',
      }]}>
        <Text style={{ fontSize: Math.round(size * 0.48) }}>{soundEnabled ? '🔔' : '🔕'}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: { alignItems: 'center', justifyContent: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
