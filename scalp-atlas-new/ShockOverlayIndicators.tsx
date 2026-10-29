import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LiveCaptureIndicator } from './LiveCaptureIndicator';
import { ShockSignalBell, type ShockSignal } from './ShockSignalBell';

type Props = {
  captureActive: boolean;
  signal: ShockSignal;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestSound: () => void;
};

/**
 * Unified compact overlay header for the two user-selected designs.
 * The host MUST provide actual verified capture state and confirmed signal.
 * This component never infers signals or plays audio.
 */
export function ShockOverlayIndicators({
  captureActive, signal, soundEnabled, onToggleSound, onTestSound,
}: Props) {
  return (
    <View style={styles.container}>
      <LiveCaptureIndicator captureActive={captureActive} size={46} />
      <ShockSignalBell
        signal={signal}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
        onTestSound={onTestSound}
        size={48}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
