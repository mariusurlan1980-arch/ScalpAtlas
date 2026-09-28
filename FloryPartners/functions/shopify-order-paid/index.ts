import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function validShopifyHmac(raw:string,header:string,secret:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw));
  const bytes=new Uint8Array(signature);
  let binary="";
  for(const b of bytes)binary+=String.fromCharCode(b);
  const computed=btoa(binary);
  if(computed.length!==header.length)return false;
  let diff=0;
  for(let i=0;i<computed.length;i++)diff|=computed.charCodeAt(i)^header.charCodeAt(i);
  return diff===0;
}

async function sendResendEvent(apiKey:string,event:string,email:string,payload:Record<string,unknown>){
  const r=await fetch("https://api.resend.com/events/send",{
    method:"POST",
    headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({event,email,payload})
  });
  if(!r.ok)throw new Error(`Resend event failed: ${r.status} ${await r.text()}`);
}

Deno.serve(async(req)=>{
  try{
    if(req.method!=="POST")return new Response("Method not allowed",{status:405});

    const raw=await req.text();
    const hmac=req.headers.get("x-shopify-hmac-sha256")||"";
    const secret=Deno.env.get("SHOPIFY_WEBHOOK_SECRET")||"";
    if(!secret||!hmac||!(await validShopifyHmac(raw,hmac,secret))){
      return new Response("Invalid signature",{status:401});
    }

    const shopifyOrder=JSON.parse(raw);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendKey=Deno.env.get("RESEND_API_KEY")!;
    const portalUrl=Deno.env.get("PARTNER_PORTAL_URL")||"";

    const city=shopifyOrder.shipping_address?.city||shopifyOrder.billing_address?.city||"";
    const customerEmail=shopifyOrder.email||shopifyOrder.contact_email||"";
    const customerName=[shopifyOrder.customer?.first_name,shopifyOrder.customer?.last_name].filter(Boolean).join(" ")||shopifyOrder.billing_address?.name||"Client";
    const recipientName=shopifyOrder.shipping_address?.name||customerName;
    const orderNumber=shopifyOrder.name||String(shopifyOrder.order_number||shopifyOrder.id);
    const lineItems=shopifyOrder.line_items||[];
    const productName=lineItems.map((x:any)=>x.title).filter(Boolean).join(", ")||"Buchet Flory Flowers";
    const quantity=lineItems.reduce((sum:number,x:any)=>sum+Number(x.quantity||0),0)||1;
    const totalAmount=Number(shopifyOrder.current_total_price||shopifyOrder.total_price||0);
    const currency=shopifyOrder.currency||"RON";

    const attrs:any={};
    for(const a of (shopifyOrder.note_attributes||[]))attrs[a.name]=a.value;
    const deliveryDate=attrs["Data livrării"]||null;
    const cardMessage=shopifyOrder.note||"";

    const {data:partners}=await admin.from("partners").select("*").eq("active",true).ilike("city",city).order("created_at",{ascending:true});
    let chosen:any=null;

    if((partners||[]).length){
      const counts=await Promise.all((partners||[]).map(async(p:any)=>{
        const {count}=await admin.from("orders").select("id",{count:"exact",head:true}).eq("partner_id",p.id).in("status",["NEW","ACCEPTED","PREPARING","READY","OUT_FOR_DELIVERY"]);
        return {partner:p,count:count||0};
      }));
      counts.sort((a,b)=>a.count-b.count);
      chosen=counts[0]?.partner||null;
    }

    const {data:created,error:createError}=await admin.from("orders").upsert({
      shopify_order_id:String(shopifyOrder.id),
      order_number:orderNumber,
      partner_id:chosen?.id||null,
      customer_email:customerEmail,
      customer_name:customerName,
      recipient_name:recipientName,
      delivery_city:city,
      delivery_address:[
        shopifyOrder.shipping_address?.address1,
        shopifyOrder.shipping_address?.address2,
        shopifyOrder.shipping_address?.zip
      ].filter(Boolean).join(", "),
      delivery_date:deliveryDate,
      product_name:productName,
      quantity,
      total_amount:totalAmount,
      currency,
      card_message:cardMessage,
      status:"NEW",
      updated_at:new Date().toISOString()
    },{onConflict:"shopify_order_id"}).select("*").single();

    if(createError)throw createError;

    await admin.from("order_events").insert({
      order_id:created.id,
      event_type:"SHOPIFY_ORDER_PAID",
      payload:{shopify_order_id:String(shopifyOrder.id),partner_id:chosen?.id||null}
    });

    if(customerEmail){
      await sendResendEvent(resendKey,"flory.order.created",customerEmail,{
        order_number:orderNumber,
        customer_name:customerName,
        product_name:productName,
        quantity,
        delivery_city:city,
        delivery_date:deliveryDate||"",
        recipient_name:recipientName,
        message:cardMessage,
        florist_email:chosen?.email||""
      });
    }

    if(chosen?.email){
      const orderId=encodeURIComponent(created.id);
      await sendResendEvent(resendKey,"flory.florist.order_assigned",chosen.email,{
        order_number:orderNumber,
        product_name:productName,
        quantity,
        delivery_city:city,
        delivery_date:deliveryDate||"",
        recipient_name:recipientName,
        customer_message:cardMessage,
        accept_url:`${portalUrl}?order=${orderId}&action=accept`,
        decline_url:`${portalUrl}?order=${orderId}&action=decline`
      });
    }

    return new Response("ok",{status:200});
  }catch(e){
    console.error(e);
    return new Response("Internal error",{status:500});
  }
});
