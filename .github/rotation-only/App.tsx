import React, {useEffect,useState} from 'react';
import {NativeModules, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
const native=NativeModules.ScalpOverlay;
export default function App(){
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Deschide QT Demo după pornire.');
  const [access,setAccess]=useState('Verificare accesibilitate…');
  const [build,setBuild]=useState('');
  useEffect(()=>{
    let live=true;
    native?.getBuildInfo().then((v:string)=>{if(live)setBuild(v)}).catch(()=>{});
    const refresh=()=>native?.getTouchTestStatus().then((v:string)=>{if(live)setAccess(v)}).catch(()=>{});
    refresh(); const id=setInterval(refresh,2500);
    return()=>{live=false;clearInterval(id)};
  },[]);
  async function run(start:boolean){
    if(busy)return;setBusy(true);
    try{
      const result=await (start?native.startOverlayMode():native.stopOverlayMode());
      setMessage(start?(result==='STARTED'?'Rotație pornită. Revino la QT Demo.':'Acordă afișarea peste alte aplicații, apoi pornește din nou.'):'Rotație oprită.');
    }catch(e){setMessage(String(e))}finally{setBusy(false)}
  }
  return <SafeAreaView style={s.page}><View style={s.inner}>
    <Text style={s.title}>SCALP ATLAS</Text><Text style={s.sub}>ROTAȚIE + CITIRE LIVE</Text>
    <Text style={s.big}>30 s</Text><Text style={s.info}>QT Demo • payout 92% • MG automat DEMO</Text>
    <Pressable disabled={busy} onPress={()=>run(true)} style={s.button}><Text style={s.btn}>PORNEȘTE ROTAȚIA</Text></Pressable>
    <Pressable disabled={busy} onPress={()=>run(false)} style={s.secondary}><Text style={s.white}>OPREȘTE ROTAȚIA</Text></Pressable>
    <Text style={s.info}>{message}</Text>
    <Pressable onPress={()=>native?.openAccessibilitySettings()}><Text style={s.link}>{access}</Text></Pressable>
    <Text style={s.small}>{build}</Text>
  </View></SafeAreaView>
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#101725'},inner:{flex:1,justifyContent:'center',padding:26,alignItems:'center',gap:16},title:{fontSize:29,fontWeight:'bold',color:'#fff'},sub:{fontSize:18,color:'#9eeacb',fontWeight:'bold'},big:{fontSize:76,color:'#fff',fontWeight:'bold'},info:{fontSize:14,color:'#c5d0dc',textAlign:'center'},button:{width:'100%',backgroundColor:'#39e8a3',padding:17,borderRadius:14,alignItems:'center'},btn:{color:'#10271e',fontSize:16,fontWeight:'bold'},secondary:{width:'100%',padding:14,borderWidth:1,borderColor:'#8293a5',borderRadius:14,alignItems:'center'},white:{color:'#fff',fontWeight:'bold'},link:{color:'#8fd9f6',textAlign:'center'},small:{fontSize:11,color:'#a2b1c4'}});
