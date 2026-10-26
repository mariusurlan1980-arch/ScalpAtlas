import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import EventSource from 'react-native-sse';
import * as SecureStore from 'expo-secure-store';
import { useAudioPlayer } from 'expo-audio';
import { ShockQuoteAdapter } from './shockQuoteAdapter';
import type { ShockObservation, ShockSignal, ShockStatus } from './shockOnlyDetector';
import { normalizeCompletedOTCCandles, validateLiveTick } from './shockOTCFeed';

const KEY_STORAGE='scalpatlas.shock.otc.key.v1';
const SOURCE='https://otcharts.com';
const TF_OPTIONS=[5,10,15] as const;
type Tf=typeof TF_OPTIONS[number];
type StreamEvent='connected'|'tick'|'dropped'|'closed'|'replaced';

export default function ShockLiveDataApp() {
  const [key,setKey]=useState('');
  const [symbol,setSymbol]=useState('EURUSD_otc');
  const [tf,setTf]=useState<Tf>(10);
  const [connected,setConnected]=useState(false);
  const [connecting,setConnecting]=useState(false);
  const [message,setMessage]=useState('Introduce cheia API în telefon pentru a începe. Fără abonament live, nu se poate conecta.');
  const [candle,setCandle]=useState<ShockObservation|null>(null);
  const [status,setStatus]=useState<ShockStatus>({phase:'WAIT',shockDepthPercent:0,reboundPercent:0,wickPercent:0,direction:null,elapsedMs:null});
  const [lastSignal,setLastSignal]=useState<ShockSignal|null>(null);
  const [lastQuoteAt,setLastQuoteAt]=useState<number|null>(null);
  const adapter=useRef(new ShockQuoteAdapter());
  const stream=useRef<EventSource<StreamEvent>|null>(null);
  const active=useRef(false);
  const closed=useRef(false);
  const sound=useAudioPlayer(require('./assets/shock-alert.wav'));
  const tickRef=useRef<number|null>(null);

  useEffect(()=>{ void SecureStore.getItemAsync(KEY_STORAGE).then(v=>{if(v) setKey(v);}).catch(()=>{}); },[]);
  useEffect(()=>()=>{active.current=false;stream.current?.removeAllEventListeners();stream.current?.close();},[]);
  useEffect(()=>{
    const interval=setInterval(()=>{
      if(active.current && lastQuoteAt && Date.now()-lastQuoteAt>5000){
        adapter.current.reset();
        setConnected(false);
        setStatus(adapter.current.getStatus());
        setMessage('FLUX ÎNTÂRZIAT — BIP oprit. Verifică rețeaua și reconectează.');
      }
    },1000);
    return ()=>clearInterval(interval);
  },[lastQuoteAt]);

  const stop=()=>{
    active.current=false;
    stream.current?.removeAllEventListeners();
    stream.current?.close();
    stream.current=null;
    adapter.current.reset();
    tickRef.current=null;
    closed.current=false;
    setConnected(false);
    setConnecting(false);
    setCandle(null);
    setStatus(adapter.current.getStatus());
    setMessage('Deconectat. BIP dezactivat.');
  };

  const playOnce=(direction:'BUY'|'SELL')=>{
    void sound.seekTo(0).then(()=>sound.play()).catch(()=>setMessage(`Semnal ${direction} (audio indisponibil)`));
  };

  const start=async()=>{
    if(connecting || active.current) return;
    const token=key.trim();
    const market=symbol.trim();
    if(!token || !/^[A-Za-z0-9#_]{3,32}$/.test(market)){
      Alert.alert('Date incomplete','Introdu cheia OTCharts în aplicație și un cod de instrument valid.');
      return;
    }
    stop();
    setConnecting(true);
    setMessage('Se verifică istoricul și dreptul de acces. Nu se execută tranzacții.');
    try {
      await SecureStore.setItemAsync(KEY_STORAGE,token);
      const headers={Authorization:`Bearer ${token}`};
      // ONE historical request on connect. Never poll candles on a timer.
      const response=await fetch(`${SOURCE}/v1/candles?venue=otc&symbol=${encodeURIComponent(market)}&tf=${tf*60}&limit=4`,{headers});
      if(!response.ok) throw new Error(response.status===401?'Cheie invalidă sau cont neconfirmat':`Istoric HTTP ${response.status}`);
      const history=normalizeCompletedOTCCandles(await response.json(),Date.now(),tf);
      const sse=new EventSource<StreamEvent>(`${SOURCE}/v1/stream?venue=otc&symbol=${encodeURIComponent(market)}`,{
        headers, pollingInterval:0,
      });
      stream.current=sse;
      active.current=true;
      setMessage('Se așteaptă primul preț live. Primele două lumânări închise trebuie confirmate.');
      let seeded=false;
      let subscribed=false;
      sse.addEventListener('connected',e=>{
        try {
          const d=JSON.parse(e.data||'{}') as {symbols?:string[]};
          subscribed=Boolean(d.symbols?.includes(market));
        } catch { subscribed=false; }
        setConnected(subscribed);
        setConnecting(false);
        if(!subscribed) setMessage('Instrumentul nu este inclus în flux. BIP oprit.');
        else setMessage('Flux terț conectat • test DEMO • așteaptă confirmarea trendului.');
      });
      sse.addEventListener('tick',e=>{
        if(!active.current || !subscribed || closed.current) return;
        let payload:unknown;
        try { payload=JSON.parse(e.data||''); }
        catch { setMessage('Mesaj de preț invalid. BIP oprit.');return; }
        const parsed=validateLiveTick(payload,market,Date.now(),tf);
        if(!parsed.ok) {adapter.current.reset();setMessage(`Fără semnal: ${parsed.reason}`);return;}
        const result=adapter.current.ingest(parsed.tick);
        if(!seeded){
          seeded=true;
          adapter.current.seedClosedCandles(market,tf,history);
        }
        if(result.reason==='TICK_ACEEASI_SECUNDA') return;
        tickRef.current=parsed.tick.timestampMs;
        setLastQuoteAt(Date.now());
        setCandle(result.observation);
        setStatus(adapter.current.getStatus());
        if(result.signal && !closed.current && result.sourceReady){
          setLastSignal(result.signal);
          setMessage(`${result.signal.direction} • ȘOC ${result.signal.shockDepthPercent}% • revenire confirmată • numai DEMO`);
          playOnce(result.signal.direction);
        } else if(result.sourceReady){
          setMessage(`M10/M5/M15: ${tf}m • ${result.reason} • fără semnal de intrare`);
        } else {
          setMessage('AȘTEAPTĂ • două lumânări închise de aceeași culoare necesare');
        }
      });
      sse.addEventListener('closed',()=>{
        closed.current=true;
        adapter.current.reset();
        setStatus(adapter.current.getStatus());
        setMessage('Instrument închis pentru tranzacționare. BIP dezactivat.');
      });
      sse.addEventListener('dropped',()=>{
        adapter.current.reset();
        setConnected(false);
        setMessage('Instrument indisponibil în flux. BIP dezactivat.');
      });
      sse.addEventListener('replaced',()=>{
        adapter.current.reset();
        setConnected(false);
        setMessage('Flux înlocuit de altă conexiune. BIP dezactivat.');
      });
      sse.addEventListener('error',()=>{
        adapter.current.reset();
        setConnected(false);
        setConnecting(false);
        setMessage('Eroare flux: verifică planul OTCharts (gratuit nu include live). BIP dezactivat.');
      });
    } catch(error) {
      active.current=false;
      setConnecting(false);
      setConnected(false);
      setMessage(error instanceof Error?error.message:'Nu s-a putut iniția conexiunea.');
    }
  };

  const green=(candle?.close||0)>=(candle?.open||0);
  const shape=useMemo(()=>{
    if(!candle)return null;
    const hi=candle.high,lo=candle.low;
    const span=Math.max(0.000000001,hi-lo);
    const y=(p:number)=>8+200*(hi-p)/span;
    const top=y(Math.max(candle.open,candle.close)),bottom=y(Math.min(candle.open,candle.close));
    return {top,bodyHeight:Math.max(3,bottom-top),wickTop:y(hi),wickHeight:Math.max(3,y(lo)-y(hi))};
  },[candle]);
  const canChange=!active.current && !connecting;
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>ȘOC RAPID <Text style={{color:'#38d0ed'}}>90</Text></Text>
        <Text style={styles.sub}>TEST DATE LIVE • SURSĂ INDEPENDENTĂ • NU EXECUTĂ TRADE-URI</Text>
        <View style={styles.panel}>
          <Text style={styles.label}>Cheie API OTCharts (rămâne criptată pe telefon)</Text>
          <TextInput style={styles.input} value={key} onChangeText={setKey} placeholder="otc_live_…" placeholderTextColor="#64748b" secureTextEntry editable={canChange} autoCapitalize="none"/>
          <Text style={styles.label}>Pereche OTC (identificator din catalogul sursei)</Text>
          <TextInput style={styles.input} value={symbol} onChangeText={setSymbol} placeholder="EURUSD_otc" placeholderTextColor="#64748b" editable={canChange} autoCapitalize="none"/>
          <View style={styles.row}>
            {TF_OPTIONS.map(v=><Pressable key={v} disabled={!canChange} onPress={()=>setTf(v)} style={[styles.tf,tf===v && styles.tfActive]}><Text style={styles.tfText}>M{v}</Text></Pressable>)}
          </View>
          <Pressable onPress={connected||active.current?stop:()=>{void start();}} style={[styles.button,(connected||active.current) && styles.stop]}>
            {connecting?<ActivityIndicator color="#fff"/>:<Text style={styles.buttonText}>{active.current?'OPREȘTE ANALIZA':'CONECTEAZĂ DATE LIVE'}</Text>}
          </Pressable>
          <Text style={styles.detail}>Nu introduce datele de autentificare Pocket Option. Este nevoie numai de cheia unui furnizor independent cu acces la streaming.</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>LUMÂNARE DIN COTAȚII • M{tf}</Text>
            <Text style={{color:connected?'#36de88':'#f2b758'}}>{connected?'CONECTAT':'NECONECTAT'}</Text>
          </View>
          <View style={styles.candleBox}>
            {shape && candle?
              <View style={styles.candleStage}>
                <View style={[styles.wick,{top:shape.wickTop,height:shape.wickHeight,backgroundColor:green?'#31d582':'#ff536b'}]}/>
                <View style={[styles.bodyCandle,{top:shape.top,height:shape.bodyHeight,backgroundColor:green?'#31d582':'#ff536b'}]}/>
              </View>:
              <Text style={styles.empty}>Așteaptă date live verificate. Nu afișăm o lumânare inventată.</Text>}
          </View>
          <View style={styles.rowBetween}><Text style={styles.label}>ȘOC (din corp)</Text><Text style={styles.metric}>{candle?status.shockDepthPercent+'%':'—'}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.label}>REVENIRE</Text><Text style={styles.metric}>{candle?status.reboundPercent+'%':'—'}</Text></View>
          <View style={styles.rowBetween}><Text style={styles.label}>FITIL REAL</Text><Text style={styles.metric}>{candle?status.wickPercent+'%':'—'}</Text></View>
          <Text style={styles.status}>{message}</Text>
          {lastSignal && <Text style={styles.old}>Ultimul semnal DEMO: {lastSignal.direction} • {lastSignal.shockDepthPercent}% • expirare test: 5 min</Text>}
        </View>
        <Text style={styles.note}>Praguri experimentale: cădere/urcare ≥90% din corp în ≤5 secunde, revenire ≥40%, două actualizări consecutive. Semnal numai după 2 lumânări închise concordante. 90% ȘOC nu înseamnă probabilitate de câștig. Compară fiecare preț cu graficul brokerului înainte de orice folosire.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#080d14'},body:{padding:16,paddingBottom:42,gap:14},
 title:{fontSize:25,fontWeight:'900',color:'#fff',letterSpacing:1},sub:{fontSize:10,color:'#a8b6c9',fontWeight:'600'},
 panel:{borderRadius:12,backgroundColor:'#121e2c',padding:14,gap:12},
 label:{fontSize:12,color:'#a7b6c8',fontWeight:'600'},detail:{fontSize:12,color:'#c5ceda',lineHeight:19},
 input:{backgroundColor:'#0a1420',borderRadius:8,paddingHorizontal:12,paddingVertical:12,fontSize:15,color:'#fff',borderColor:'#253348',borderWidth:1},
 row:{flexDirection:'row',gap:10},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 tf:{flex:1,backgroundColor:'#172739',borderRadius:8,padding:10,alignItems:'center'},tfActive:{backgroundColor:'#155e48'},
 tfText:{color:'#fff',fontWeight:'800'},button:{backgroundColor:'#1268ae',padding:16,borderRadius:8,alignItems:'center'},stop:{backgroundColor:'#933d43'},buttonText:{color:'#fff',fontWeight:'900'},
 candleBox:{height:240,alignItems:'center',justifyContent:'center',backgroundColor:'#091321',borderRadius:10},
 candleStage:{width:100,height:220,position:'relative'},wick:{position:'absolute',width:3,left:49},bodyCandle:{position:'absolute',width:32,left:34,borderRadius:2},
 empty:{color:'#8394a9',paddingHorizontal:20,textAlign:'center'},metric:{color:'#e5f3ff',fontSize:23,fontWeight:'800'},
 status:{color:'#b9e0ff',fontWeight:'700',lineHeight:21},old:{color:'#c5e6c1',fontSize:12},note:{color:'#adb9c9',lineHeight:19,fontSize:12}
});
