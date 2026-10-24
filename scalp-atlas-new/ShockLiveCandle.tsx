import React from 'react';
import {View,Text,StyleSheet} from 'react-native';
import type {ChartCandleSample} from './shockChartAdapter';
import {toShockObservation} from './shockChartAdapter';

/** Last FORMING candle, never a fabricated prediction. No trend reversal indicator. */
export function ShockLiveCandle({sample}:{sample:ChartCandleSample|null}) {
  const candle=sample ? toShockObservation(sample) : null;
  if (!candle) return (
    <View style={styles.root}><Text style={styles.title}>ULTIMA LUMÂNARE</Text>
      <Text style={styles.wait}>AȘTEAPTĂ DATE LIVE</Text></View>
  );
  const {open,high,low,close}=candle;
  const green=close>=open;
  const color=green?'#38e879':'#ff4b4b';
  const range=Math.max(high-low,Number.EPSILON);
  const y=(v:number)=>8+(high-v)/range*112;
  const top=y(Math.max(open,close));
  const bodyHeight=Math.max(2,Math.abs(y(open)-y(close)));
  return <View style={styles.root}>
    <Text style={styles.title}>ULTIMA LUMÂNARE • LIVE</Text>
    <View style={styles.chart}>
      <View style={[styles.wick,{backgroundColor:color,top:y(high),height:Math.max(1,y(low)-y(high))}]}/>
      <View style={[styles.body,{backgroundColor:color,top,height:bodyHeight}]}/>
    </View>
    <Text style={[styles.label,{color}]}>{green?'VERDE':'ROȘIE'}</Text>
  </View>;
}
const styles=StyleSheet.create({
 root:{width:132,alignItems:'center',justifyContent:'center',paddingVertical:8},
 title:{color:'#d9f5e5',fontSize:10,fontWeight:'700',textAlign:'center'},
 wait:{color:'#90a49a',fontSize:10,textAlign:'center',marginTop:14},
 chart:{width:64,height:128,position:'relative',marginTop:4},
 wick:{position:'absolute',width:3,left:30,borderRadius:2},
 body:{position:'absolute',width:22,left:20,borderRadius:2},
 label:{fontSize:11,fontWeight:'700',marginTop:2}
});
