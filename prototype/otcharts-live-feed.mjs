/** OTCharts read-only SSE quote adapter for SHOCK LIVE.
 * Server-side Node 22+ only. Never embed an API key in a public APK.
 * Requires an OTCharts plan with live streaming. No broker login/SSID.
 */
export async function streamOtcharts({apiKey,venue='otc',symbols,timeframe='M5',onQuote,signal,fetchImpl=fetch}){
 if(typeof apiKey!=='string'||!apiKey.trim())throw Error('OTCHARTS_API_KEY required');
 if(!['otc','quotex','iq','binodex','forex'].includes(venue))throw Error('Unsupported venue');
 if(!Array.isArray(symbols)||!symbols.length||symbols.some(s=>typeof s!=='string'||!/^[#A-Za-z0-9_]+$/.test(s)))throw Error('Invalid symbols');
 if(!/^M(1|2|3|5|10|15|30)$|^H1$/.test(timeframe))throw Error('Invalid timeframe');
 const seconds=timeframe[0]==='H'?3600:Number(timeframe.slice(1))*60;
 const url=new URL('https://otcharts.com/v1/stream');url.searchParams.set('venue',venue);url.searchParams.set('symbol',symbols.join(','));
 const response=await fetchImpl(url,{headers:{Authorization:'Bearer '+apiKey,Accept:'text/event-stream'},signal});
 if(!response.ok)throw Error('OTCharts stream HTTP '+response.status);
 if(!response.body)throw Error('No stream body');
 const reader=response.body.getReader();const decoder=new TextDecoder();let pending='';let eventType='';let data='';let subscribed=null;
 const emit=()=>{
  if(!data)return;
  let obj;try{obj=JSON.parse(data)}catch{return}
  if(eventType==='connected'&&Array.isArray(obj.symbols)){subscribed=new Set(obj.symbols);return}
  if(eventType!=='tick'||!subscribed||!subscribed.has(obj.symbol))return;
  if(!Number.isFinite(obj.price)||obj.price<=0||!Number.isFinite(obj.time))return;
  const timestamp=obj.time*1000;
  // The API documents a 2h offset for Pocket Option bars, not necessarily ticks.
  // Tick timestamps are interpreted as Unix seconds; verify against the broker clock before live alerts.
  const candleStart=Math.floor(obj.time/seconds)*seconds;
  onQuote?.({broker:venue==='otc'?'Pocket Option':venue,marketMode:venue==='forex'?'FOREX':obj.symbol.toLowerCase().endsWith('_otc')?'OTC':'FOREX',instrument:obj.symbol.toLowerCase().endsWith('_otc')?obj.symbol.replace(/_otc$/i,' OTC'):obj.symbol,timeframe,candleId:String(candleStart),price:obj.price,timestamp});
 };
 while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i).replace(/\r$/,'');pending=pending.slice(i+1);if(!line){emit();eventType='';data='';continue}if(line.startsWith('event:'))eventType=line.slice(6).trim();else if(line.startsWith('data:'))data+=(data?'\n':'')+line.slice(5).trim();}}
}
