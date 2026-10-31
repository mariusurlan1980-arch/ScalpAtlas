import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';

export default function TouchPracticePanel({onClose}: {onClose: () => void}) {
  const [selected, setSelected] = useState<'BUY'|'SELL'|null>(null);
  const [message, setMessage] = useState('Selectează o direcție pentru demonstrație.');
  const [total, setTotal] = useState(0);
  const press = (side: 'BUY'|'SELL') => {
    if (!selected) {setMessage('Selectează mai întâi o direcție.'); return;}
    if (selected !== side) {setMessage('Zona greșită. Încearcă din nou.'); return;}
    setTotal(n => n + 1);
    setMessage('Test reușit: ' + side + '.');
    setSelected(null);
  };
  const makeButton = (name: string, color: string, action: () => void) => (
    <Pressable accessibilityRole="button" onPress={action}
      style={{backgroundColor:color,padding:15,borderRadius:12,flex:1,alignItems:'center'}}>
      <Text style={{color:'white',fontWeight:'bold'}}>{name}</Text>
    </Pressable>
  );
  return <View style={{gap:16,paddingHorizontal:18,width:'100%',alignItems:'center'}}>
    <Text style={{color:'white',fontSize:19,fontWeight:'bold'}}>TEST MANUAL BUY / SELL</Text>
    <Text style={{color:'#bccbd6',textAlign:'center'}}>Doar demonstrație locală. Nu sunt transmise comenzi către alte aplicații.</Text>
    <View style={{flexDirection:'row',gap:12}}>
      {makeButton('ALEGE BUY','#087f45',()=>{setSelected('BUY');setMessage('Apasă zona BUY de mai jos.');})}
      {makeButton('ALEGE SELL','#a22e49',()=>{setSelected('SELL');setMessage('Apasă zona SELL de mai jos.');})}
    </View>
    <View style={{flexDirection:'row',gap:12}}>
      {makeButton('ZONA BUY','#07532c',()=>press('BUY'))}
      {makeButton('ZONA SELL','#711c31',()=>press('SELL'))}
    </View>
    <Text style={{color:'#f5d49a',textAlign:'center'}}>{message}</Text>
    <Text style={{color:'#becedb'}}>Probe finalizate: {total}</Text>
    {makeButton('ÎNAPOI','#394e63',onClose)}
  </View>;
}
