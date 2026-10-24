import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {ChartCandleSample} from './shockChartAdapter';
import type {ShockLiveStatus} from './shockOnlyDetector';
import {ShockLiveCandle} from './ShockLiveCandle';
import {ShockLiveRing} from './ShockLiveRing';

/**
 * Minimal SHOCK-only overlay visual. Exactly one forming candle + recovery ring.
 * The native Android floating-window host must supply the placement and live
 * verified OHLC samples; this component does not capture the broker screen.
 */
export function ShockCompactOverlay({
  sample, status, candleSide='left',
}:{
  sample: ChartCandleSample|null;
  status: ShockLiveStatus|null;
  candleSide?: 'left'|'right';
}) {
  const candle=<ShockLiveCandle sample={sample}/>;
  const ring=<ShockLiveRing status={status}/>;
  return (
    <View style={styles.root} accessibilityLabel="Scalp Atlas ȘOC: lumânare și procent revenire">
      {candleSide==='left' ? <>{candle}{ring}</> : <>{ring}{candle}</>}
    </View>
  );
}
const styles=StyleSheet.create({
  root:{flexDirection:'row',alignItems:'center',justifyContent:'center',
    backgroundColor:'rgba(6,14,22,0.80)',borderRadius:22,paddingHorizontal:4,paddingVertical:4},
});
