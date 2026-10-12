'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {probeFreePocketOtc}=require('./freeLiveProbe');

function mockSse(s) {
 return new Response(new ReadableStream({
   start(controller){controller.enqueue(new TextEncoder().encode(s));controller.close();}
 }),{status:200,headers:{'content-type':'text/event-stream'}});
}
test('No credentials -> no browser login and no network call',async()=>{
 const r=await probeFreePocketOtc({fetchImpl:async()=>{throw Error('Should not be called')}});
 assert.equal(r.status,'NEEDS_FREE_PROVIDER_API_KEY');
 assert.equal(r.connected,false);
});
test('Zero free stream allowance blocks ALL stream requests',async()=>{
 let calls=[];
 const out=await probeFreePocketOtc({
   apiKey:'just_a_test_key',fetchImpl:async(url,opt)=>{
     calls.push({url,method:opt.method});
     return new Response(JSON.stringify({plan:'free',books:['otc'],streams:{limit:0,open:0,instrumentsPerStream:0}}),
     {status:200});
   }
 });
 assert.equal(out.status,'NO_FREE_LIVE_ACCESS');
 assert.equal(out.reason,'NO_FREE_STREAM');
 assert.equal(calls.length,1);
 assert.ok(calls[0].url.endsWith('/v1/usage'));
 assert.equal(calls[0].method,'GET');
});
test('Free allowed uses numeric SSE; never declares accuracy or BUY/SELL',async()=>{
 let count=0;
 const result=await probeFreePocketOtc({apiKey:'just_a_test_key',maxTicks:2,
   now:()=>1_800_000_010_000,
   fetchImpl:async(url,opt)=>{
     count++;
     assert.equal(opt.method,'GET');
     assert.ok(!url.includes('just_a_test_key'));
     if(url.endsWith('/v1/usage'))
       return new Response(JSON.stringify({
         plan:'free',books:['otc'],streams:{limit:1,open:0,instrumentsPerStream:1}
       }),{status:200});
     return mockSse('event: connected\n'+
       'data: {"symbols":["EURUSD_otc"]}\n\n'+
       'event: tick\n'+'data: {"symbol":"EURUSD_otc","price":1.12345,"time":1800000009}\n\n'+
       'event: tick\n'+'data: {"symbol":"EURUSD_otc","price":1.12346,"time":1800000010}\n\n');
   }
 });
 assert.equal(count,2);
 assert.equal(result.status,'FREE_PROVIDER_STREAM_PROVISIONAL');
 assert.equal(result.sampleCount,2);
 assert.equal(result.firstPrice,1.12345);
 assert.equal(result.quotesMatchedToPocketOption,false);
 assert.equal(result.signalAllowed,false);
 assert.equal(result.orderAllowed,false);
 assert.equal(result.bipAllowed,false);
 assert.equal(result.paidUpgradeAttempted,false);
});
test('Bad free key receives refusal and does not attempt paid upgrade',async()=>{
 const r=await probeFreePocketOtc({apiKey:'just_a_test_key',
 fetchImpl:async()=>new Response('{}',{status:401})});
 assert.equal(r.status,'PROVIDER_USAGE_UNAVAILABLE');
 assert.ok(r.message.includes('KEY_REJECTED'));
});
