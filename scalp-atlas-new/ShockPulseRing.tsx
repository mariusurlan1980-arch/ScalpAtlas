import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

/**
 * Visual-only signal indicator. One complete 1000ms pulse, no audio and no
 * signal inference: the parent MUST supply an already confirmed active signal.
 */
export type RingSignal = 'BUY' | 'SELL' | 'NONE';

export function ShockPulseRing({
  signal, intensityPercent, diameter=146,
}: {
  signal: RingSignal;
  intensityPercent: number | null;
  diameter?: number;
}) {
  const phase=useRef(new Animated.Value(0)).current;
  const loop=useRef<Animated.CompositeAnimation | null>(null);
  const active=signal==='BUY'||signal==='SELL';
  useEffect(()=>{
    loop.current?.stop();
    phase.stopAnimation();
    phase.setValue(0);
    if(active){
      const animation=Animated.loop(Animated.sequence([
        Animated.timing(phase,{toValue:1,duration:500,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
        Animated.timing(phase,{toValue:0,duration:500,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      ]));
      loop.current=animation;
      animation.start();
    }
    return ()=>{loop.current?.stop();phase.stopAnimation();};
  },[active,signal,phase]);

  const color=signal==='BUY'?'#16C776':signal==='SELL'?'#F04455':'#A3ADB8';
  const borderOpacity=phase.interpolate({inputRange:[0,1],outputRange:[0.35,1]});
  const haloOpacity=phase.interpolate({inputRange:[0,1],outputRange:[0.055,0.26]});
  const pct=typeof intensityPercent==='number' && Number.isFinite(intensityPercent)
    ? `${Math.min(100,Math.max(0,Math.round(intensityPercent)))}%` : '—';
  return (
    <View style={[styles.container,{width:diameter,height:diameter}]} accessible accessibilityLabel={active?`ȘOC ${pct}, ${signal}`:'Fără semnal confirmat'}>
      {active && <Animated.View pointerEvents="none" style={[
        styles.outline,{borderRadius:diameter/2,borderWidth:14,borderColor:color,opacity:haloOpacity},
      ]}/>}
      <Animated.View pointerEvents="none" style={[
        styles.outline,{borderRadius:diameter/2,borderWidth:6,borderColor:color,opacity:active?borderOpacity:0.25},
      ]}/>
      <View style={styles.center}>
        <Text style={styles.label}>ȘOC</Text>
        <Text style={[styles.percent,{color:active?color:'#7E8A98'}]}>{pct}</Text>
        <Text style={[styles.signal,{color:active?color:'#7E8A98'}]}>
          {signal==='BUY'?'↑ BUY':signal==='SELL'?'↓ SELL':'AȘTEAPTĂ'}
        </Text>
      </View>
    </View>
  );
}
const styles=StyleSheet.create({
  container:{alignItems:'center',justifyContent:'center',position:'relative'},
  outline:{position:'absolute',top:0,right:0,bottom:0,left:0},
  center:{alignItems:'center',justifyContent:'center'},
  label:{fontSize:11,color:'#81909D',fontWeight:'600'},
  percent:{fontSize:32,fontWeight:'900',marginTop:2},
  signal:{fontSize:14,fontWeight:'800',marginTop:2},
});
