import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {ShockLiveStatus} from './shockOnlyDetector';

/** Circular SHOCK recovery indicator. Percentage is candle recovery, never win probability.
 * Uses 60 narrow arc-like segments; no external SVG dependency.
 */
export function ShockLiveRing({status}: {status: ShockLiveStatus | null}) {
  const pct=status ? Math.max(0,Math.min(100,Math.round(status.intensityPercent))) : 0;
  const active=Math.round(pct*0.6);
  const phase=status?.phase ?? 'OBSERVING';
  const label=status?.signal?.direction ?? (phase==='RECOVERING_BUY'?'BUY':phase==='RECOVERING_SELL'?'SELL':'ȘOC LIVE');
  const color=label==='SELL'?'#ff4b4b':label==='BUY'?'#38e879':'#748493';
  return (
    <View style={styles.root} accessibilityLabel={`ȘOC LIVE: ${pct}% revenire lumânare; ${label}`}>
      {Array.from({length:60},(_,i)=>(
        <View key={i} style={[styles.tick,{transform:[{rotate:`${i*6}deg`}] }]} pointerEvents="none">
          <View style={[styles.tickFill,{backgroundColor:i<active?color:'#27362f'}]}/>
        </View>
      ))}
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.title}>ȘOC LIVE</Text>
        <Text style={[styles.percent,{color}]}>{status ? `${pct}%` : '—'}</Text>
        <Text style={styles.subtitle}>{label==='ȘOC LIVE'?'AȘTEAPTĂ':label}</Text>
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  root:{width:160,height:160,alignItems:'center',justifyContent:'center'},
  tick:{position:'absolute',width:160,height:160,alignItems:'center'},
  tickFill:{width:4,height:12,borderRadius:3,marginTop:1},
  center:{position:'absolute',alignItems:'center',justifyContent:'center'},
  title:{fontSize:13,fontWeight:'700',color:'#e9f9ed'},
  percent:{fontSize:35,fontWeight:'800',marginVertical:2},
  subtitle:{fontSize:11,fontWeight:'700',color:'#b8d9c3'}
});
