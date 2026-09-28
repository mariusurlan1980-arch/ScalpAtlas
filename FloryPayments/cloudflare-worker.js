const CATALOG = {
  1: { name: "Little Gesture", eur: 25.80 },
  2: { name: "Sweet Surprise", eur: 33.80 },
  3: { name: "Pink Whisper", eur: 39.80 },
  4: { name: "Pure Elegance", eur: 45.80 },
  5: { name: "Red Romance", eur: 49.80 },
  6: { name: "Flory Standard – 12 Premium Red Roses", eur: 55.80 },
  7: { name: "Love Forever", eur: 65.80 },
  8: { name: "Grand Romantic Bouquet", eur: 99.80 },
  9: { name: "36 Premium Red Roses", eur: 139.80 },
  10:{ name: "50 Luxury Red Roses", eur: 199.80 }
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

function json(data, status=200){
  return new Response(JSON.stringify(data), {
    status,
    headers: {...cors, "Content-Type":"application/json; charset=utf-8"}
  });
}

function escapeHtml(v=""){
  return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function paypalApi(env){
  return (env.PAYPAL_ENV || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function accessToken(env){
  if(!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET){
    throw new Error("PayPal credentials are not configured.");
  }
  const auth = btoa(env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_CLIENT_SECRET);
  const r = await fetch(paypalApi(env)+"/v1/oauth2/token", {
    method:"POST",
    headers:{
      "Authorization":"Basic "+auth,
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:"grant_type=client_credentials"
  });
  const data = await r.json();
  if(!r.ok || !data.access_token) throw new Error(data.error_description || "Could not authenticate with PayPal.");
  return data.access_token;
}

function validateOrder(body){
  if(!body || !Array.isArray(body.items) || !body.items.length) throw new Error("Cart is empty.");
  if(!["ES","DE","BG","RO"].includes(body.country)) throw new Error("Delivery country is not enabled yet.");
  if(!String(body.receiver||"").trim() || !String(body.city||"").trim()) throw new Error("Recipient and city are required.");

  const lines=[];
  let total=0;
  for(const row of body.items){
    const p=CATALOG[Number(row.id)];
    const qty=Math.max(1,Math.min(20,Number(row.qty)||1));
    if(!p) throw new Error("Unknown product in cart.");
    total += p.eur * qty;
    lines.push({
      name:p.name.slice(0,127),
      quantity:String(qty),
      unit_amount:{currency_code:"EUR",value:p.eur.toFixed(2)}
    });
  }
  return {lines,total:Number(total.toFixed(2))};
}

async function createOrder(request, env){
  const body = await request.json();
  const {lines,total}=validateOrder(body);
  const token=await accessToken(env);
  const origin=new URL(request.url).origin;
  const ref="FF-"+Date.now().toString(36).toUpperCase()+"-"+crypto.randomUUID().slice(0,6).toUpperCase();

  const payload={
    intent:"CAPTURE",
    purchase_units:[{
      reference_id:"FLORY",
      custom_id:ref,
      description:("Flory Flowers · "+body.city+" · "+body.country).slice(0,127),
      amount:{
        currency_code:"EUR",
        value:total.toFixed(2),
        breakdown:{item_total:{currency_code:"EUR",value:total.toFixed(2)}}
      },
      items:lines
    }],
    payment_source:{
      paypal:{
        experience_context:{
          brand_name:"Flory Flowers",
          shipping_preference:"NO_SHIPPING",
          user_action:"PAY_NOW",
          return_url:origin+"/paypal/return",
          cancel_url:origin+"/paypal/cancel"
        }
      }
    }
  };

  const r=await fetch(paypalApi(env)+"/v2/checkout/orders",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+token,
      "Content-Type":"application/json",
      "PayPal-Request-Id":ref
    },
    body:JSON.stringify(payload)
  });
  const data=await r.json();
  if(!r.ok) return json({error:"PayPal order creation failed.",details:data},502);
  const approval=(data.links||[]).find(x=>x.rel==="payer-action"||x.rel==="approve");
  if(!approval?.href) return json({error:"PayPal did not return an approval link.",details:data},502);
  return json({id:data.id,reference:ref,total:total.toFixed(2),currency:"EUR",approveUrl:approval.href});
}

async function captureOrder(orderId, env){
  const token=await accessToken(env);
  const r=await fetch(paypalApi(env)+"/v2/checkout/orders/"+encodeURIComponent(orderId)+"/capture",{
    method:"POST",
    headers:{
      "Authorization":"Bearer "+token,
      "Content-Type":"application/json",
      "PayPal-Request-Id":"capture-"+orderId
    },
    body:"{}"
  });
  const data=await r.json();
  return {ok:r.ok,data};
}

function resultPage(title, message, status, orderId=""){
  const deep="floryflowers://payment-result?status="+encodeURIComponent(status)+"&orderId="+encodeURIComponent(orderId);
  return new Response(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#07192a;font-family:Arial;color:#fff;display:grid;place-items:center;min-height:100vh}.card{width:min(88vw,430px);background:#fff;color:#142033;border-radius:24px;padding:28px;text-align:center}.ff{color:#d9ae58;font:bold 30px Georgia}.ok{font-size:54px;margin:12px}.msg{line-height:1.5;color:#526071}.btn{display:block;text-decoration:none;background:#ef002b;color:white;padding:14px;border-radius:14px;font-weight:800;margin-top:20px}.small{font-size:12px;color:#7b8491;margin-top:14px}</style></head><body><div class="card"><div class="ff">Flory Flowers</div><div class="ok">${status==="success"?"✓":"↩"}</div><h1>${escapeHtml(title)}</h1><p class="msg">${escapeHtml(message)}</p><a class="btn" href="${deep}">Înapoi în Flory Flowers</a><p class="small">Poți închide această pagină după revenirea în aplicație.</p></div></body></html>`,{
    headers:{"Content-Type":"text/html; charset=utf-8"}
  });
}

export default {
  async fetch(request, env){
    try{
      if(request.method==="OPTIONS") return new Response(null,{headers:cors});
      const url=new URL(request.url);

      if(url.pathname==="/health") return json({ok:true,provider:"paypal",environment:(env.PAYPAL_ENV||"sandbox")});

      if(url.pathname==="/api/paypal/create-order" && request.method==="POST"){
        return await createOrder(request,env);
      }

      if(url.pathname==="/api/paypal/status" && request.method==="GET"){
        const id=url.searchParams.get("id");
        if(!id) return json({error:"Missing order id."},400);
        const token=await accessToken(env);
        const r=await fetch(paypalApi(env)+"/v2/checkout/orders/"+encodeURIComponent(id),{
          headers:{"Authorization":"Bearer "+token}
        });
        const data=await r.json();
        return json({id:data.id,status:data.status,payment_status:data.purchase_units?.[0]?.payments?.captures?.[0]?.status||null},r.ok?200:502);
      }

      if(url.pathname==="/paypal/return" && request.method==="GET"){
        const id=url.searchParams.get("token");
        if(!id) return resultPage("Plată neidentificată","Nu am primit identificatorul plății.","error");
        const result=await captureOrder(id,env);
        const captureStatus=result.data?.purchase_units?.[0]?.payments?.captures?.[0]?.status;
        if(result.ok && captureStatus==="COMPLETED"){
          return resultPage("Plată confirmată","Mulțumim. Plata a fost înregistrată cu succes.","success",id);
        }
        return resultPage("Plata nu a fost finalizată","Nu am putut confirma plata. Nu plasa o comandă nouă până nu verifici statusul.","error",id);
      }

      if(url.pathname==="/paypal/cancel" && request.method==="GET"){
        return resultPage("Plată anulată","Nu s-a încasat plata. Poți reveni la comandă.","cancelled",url.searchParams.get("token")||"");
      }

      return json({name:"Flory Flowers Payments",ok:true},200);
    }catch(err){
      return json({error:err?.message||"Unexpected server error."},500);
    }
  }
};
