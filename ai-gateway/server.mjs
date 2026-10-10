/**
 * Optional server-side AI vision verifier for Scalp Atlas.
 * Run only on HTTPS with OPENAI_API_KEY, ATLAS_ACCESS_TOKEN and optionally OPENAI_MODEL.
 * Never put the OpenAI key in the Android APK. NOT a profitability guarantee.
 */
import http from "node:http";
import crypto from "node:crypto";
const PORT=Number(process.env.PORT||8080);
const API_KEY=process.env.OPENAI_API_KEY||"";
const CLIENT_TOKEN=process.env.ATLAS_ACCESS_TOKEN||"";
const MODEL=process.env.OPENAI_MODEL||"gpt-4.1-mini";
const rate=new Map();
const MAX_BODY=235_000;
const MAX_IMAGE=195_000;
const ERROR_RESULT=(requestId="",reason="invalid")=>({requestId,direction:"WAIT",reason});
function authorised(header){
  if(!CLIENT_TOKEN||!header?.startsWith("Bearer "))return false;
  const a=Buffer.from(header.substring(7)),b=Buffer.from(CLIENT_TOKEN);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function respond(res,status,obj){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(JSON.stringify(obj));
}
function validate(data){
  if(typeof data!=="object"||!data)return "invalid JSON";
  if(!/^[A-Za-z0-9_-]{8,80}$/.test(String(data.requestId||"")))return "invalid request id";
  if(!["BUY","SELL"].includes(data.direction))return "direction required";
  if(!["M5","M10"].includes(data.timeframe))return "unsupported timeframe";
  if(typeof data.pair!=="string"||!/^[A-Z0-9/ ._-]{3,28}$/.test(data.pair))return "invalid pair";
  if(typeof data.image!=="string"||data.image.length>MAX_IMAGE||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.image))return "invalid chart image";
  if(!Number.isFinite(data.sentAt)||Math.abs(Date.now()-data.sentAt)>20_000)return "stale chart image";
  return null;
}
async function askVision({pair,timeframe,direction,image}){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6500);
  try{
    const system="You are an independent conservative chart-image reviewer. Use only chart pixels. No live broker quotes or verified OHLC data. Do not predict certainty, especially on OTC. Return WAIT if labels, candles, timeframe, direction or chart evidence is ambiguous. Do not read floating overlay labels as broker data. Reject contradictions and extended breakouts. No fabricated probabilities.";
    const user="Chart crop "+pair+" "+timeframe+". Existing deterministic motor proposes "+direction+". Independently assess visual trend, momentum, structure, candle reversal and exhaustion. Return WAIT if any doubt. This is NOT permission to trade.";
    const body={
      model:MODEL,max_output_tokens:190,store:false,
      input:[
        {role:"developer",content:[{type:"input_text",text:system}]},
        {role:"user",content:[{type:"input_text",text:user},{type:"input_image",image_url:image,detail:"low"}]}
      ],
      text:{format:{type:"json_schema",name:"atlas_chart_vote",strict:true,schema:{
        type:"object",properties:{direction:{type:"string",enum:["BUY","SELL","WAIT"]},reason:{type:"string"}},
        required:["direction","reason"],additionalProperties:false
      }}}
    };
    const r=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":"Bearer "+API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify(body),signal:abort.signal
    });
    if(!r.ok)throw Error("AI provider unavailable ("+r.status+")");
    const result=await r.json();
    const output=(result.output||[]).filter(o=>o.type==="message").flatMap(o=>o.content||[])
      .filter(c=>c.type==="output_text").map(c=>c.text).join("")||result.output_text||"";
    const parsed=JSON.parse(output);
    const vote=["BUY","SELL","WAIT"].includes(parsed.direction)?parsed.direction:"WAIT";
    return {direction:vote===direction?vote:"WAIT",reason:String(parsed.reason||"").slice(0,170)};
  }finally{clearTimeout(timer)}
}
const server=http.createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/health"){
    return respond(res,200,{status:"ready",aiConfigured:!!API_KEY,authenticatedAccess:!!CLIENT_TOKEN});
  }
  if(req.method!=="POST"||req.url!=="/v1/confirm")return respond(res,404,{error:"not found"});
  if(!authorised(req.headers.authorization))return respond(res,401,{error:"unauthorised"});
  const key=crypto.createHash("sha256").update(req.headers.authorization).digest("hex");
  const now=Date.now(),prev=rate.get(key)||0;
  if(now-prev<12_000)return respond(res,429,{error:"rate limit"});
  if(!API_KEY)return respond(res,503,{error:"AI not configured"});
  let received=0,chunks=[];
  try{
    for await(const chunk of req){
      received+=chunk.length;
      if(received>MAX_BODY){return respond(res,413,{error:"request too large"})}
      chunks.push(chunk);
    }
    const data=JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const problem=validate(data);
    if(problem)return respond(res,400,ERROR_RESULT(data?.requestId||"",problem));
    rate.set(key,Date.now());
    const verdict=await askVision(data);
    return respond(res,200,{requestId:data.requestId,...verdict});
  }catch(e){
    return respond(res,503,ERROR_RESULT("",e?.name==="AbortError"?"AI timeout":"AI unavailable"));
  }
});
server.listen(PORT,"0.0.0.0",()=>console.log("Scalp Atlas AI proxy",PORT,"configured",!!API_KEY));
