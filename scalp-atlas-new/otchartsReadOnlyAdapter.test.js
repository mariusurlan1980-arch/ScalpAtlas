'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {makeOTChartsClient}=require('./otchartsReadOnlyAdapter');

const KEY='test_only_never_a_real_key';
const textHeaders={'content-type':'text/event-stream'};
function clientWith(handler) {
 return makeOTChartsClient({apiKey:KEY,fetchImpl:async(url,opts)=>{
   assert.equal(opts.method,'GET');
   assert.equal(opts.redirect,'error');
   assert.equal(new URL(url).origin,'https://otcharts.com');
   assert.equal(opts.headers.Authorization,'Bearer '+KEY);
   assert.ok(!url.includes(KEY),'API key must never be placed in URL');
   return handler(new URL(url),opts);
 }});
}
function chunks(parts){
 return new ReadableStream({
   start(controller){
     for(const p of parts)controller.enqueue(new TextEncoder().encode(p));
     controller.close();
   }
 });
}
test('No request without key or with header injection',()=>{
 assert.throws(()=>makeOTChartsClient(),/KEY_REQUIRED/);
 assert.throws(()=>makeOTChartsClient({apiKey:'injected\r\nxxx'}),/KEY_REQUIRED/);
});
test('free-plan quota endpoint uses only GET and no broker session',async()=>{
 const api=clientWith((url)=>{
   assert.equal(url.pathname,'/v1/usage');
   return new Response(JSON.stringify({plan:'free',streams:{limit:0}}),{status:200});
 });
 assert.equal((await api.usage()).streams.limit,0);
});
test('provider refuses live stream for free plan without bypassing restrictions',async()=>{
 const api=clientWith((url)=>{
   assert.equal(url.searchParams.get('venue'),'otc');
   assert.equal(url.searchParams.get('symbol'),'EURUSD_otc');
   return new Response('plan unavailable',{status:403});
 });
 await assert.rejects(async()=>{for await(const _ of api.stream({symbols:['EURUSD_otc']})){}},
   /BOOK_OR_PLAN_UNAVAILABLE:403/);
});
test('connected authorization required before accepting any live tick',async()=>{
 const api=clientWith(()=>new Response(chunks([
   'event: tick\ndata: {"symbol":"EURUSD_otc","price":1.2,"time":1800000000}\n\n',
   'event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n',
   'event: tick\ndata: {"symbol":"EURUSD_otc","price":1.21,"time":1800000001}\n\n'
 ]),{status:200,headers:textHeaders}));
 let result=[];
 await assert.rejects(async()=>{
   for await (const tick of api.stream({symbols:['EURUSD_otc']})) result.push(tick);
 },/STREAM_CLOSED/);
 assert.equal(result.length,1);
 assert.equal(result[0].price,1.21);
});
test('missing selected symbol in connected event fails closed',async()=>{
 const api=clientWith(()=>new Response(chunks([
   'event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n'
 ]),{status:200,headers:textHeaders}));
 await assert.rejects(async()=>{
   for await(const _ of api.stream({symbols:['EURUSD_otc','GBPUSD_otc']})){}
 },/INCOMPLETE_SUBSCRIPTION/);
});
test('dropped selected symbol aborts stream',async()=>{
 const api=clientWith(()=>new Response(chunks([
   'event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n',
   'event: dropped\ndata: {"dropped":["EURUSD_otc"],"carried":0}\n\n',
   'event: tick\ndata: {"symbol":"EURUSD_otc","price":1.2,"time":1800000000}\n\n'
 ]),{status:200,headers:textHeaders}));
 await assert.rejects(async()=>{
   for await(const _ of api.stream({symbols:['EURUSD_otc']})){}
 },/SYMBOL_DROPPED/);
});
test('event frame may arrive across chunks',async()=>{
 const api=clientWith(()=>new Response(chunks([
   'event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n',
   'event: ti','ck\ndata: {"symbol":"EURUSD_otc","price":1.22,"time":1800000002}\n\n'
 ]),{status:200,headers:textHeaders}));
 let found=null;
 await assert.rejects(async()=>{
   for await(const t of api.stream({symbols:['EURUSD_otc']}))found=t;
 },/STREAM_CLOSED/);
 assert.equal(found.price,1.22);
});
test('mismatched symbol is not forwarded, even after connected',async()=>{
 const api=clientWith(()=>new Response(chunks([
   'event: connected\ndata: {"symbols":["EURUSD_otc"]}\n\n',
   'event: tick\ndata: {"symbol":"GBPUSD_otc","price":1.22,"time":1800000002}\n\n'
 ]),{status:200,headers:textHeaders}));
 let count=0;
 await assert.rejects(async()=>{
   for await(const _ of api.stream({symbols:['EURUSD_otc']}))count++;
 },/STREAM_CLOSED/);
 assert.equal(count,0);
});
test('history never falsely marks newest bar as closed, checks gaps',async()=>{
 const api=clientWith((url)=>{
   assert.equal(url.pathname,'/v1/candles');
   assert.equal(url.searchParams.get('tf'),'300');
   return new Response(JSON.stringify({
     candles:[
       {time:1800000000,open:1.1,high:1.2,low:1.0,close:1.15},
       {time:1800000600,open:1.14,high:1.24,low:1.08,close:1.19}
     ],gaps:{runs:1,missingBars:1}
   }),{status:200});
 });
 const data=await api.candles({symbol:'EURUSD_otc',timeframeSeconds:300});
 assert.equal(data.hasGap,true);
 assert.equal(data.bars[1].complete,false);
 assert.equal(data.providerTimeUncalibrated,true);
});
test('no third-party orders or accounts function exists',()=>{
 const api=clientWith(()=>new Response('{}',{status:200}));
 assert.deepEqual(Object.keys(api).sort(),['candles','stream','symbols','usage']);
});
