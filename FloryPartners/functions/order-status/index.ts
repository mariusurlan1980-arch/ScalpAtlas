import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const EVENT_BY_STATUS={
  ACCEPTED:"flory.order.accepted",
  PREPARING:"flory.order.preparing",
  READY:"flory.order.ready",
  OUT_FOR_DELIVERY:"flory.order.out_for_delivery",
  DELIVERED:"flory.order.delivered",
};

async function sendResendEvent(apiKey:string,event:string,email:string,payload:Record<string,unknown>){
  const r=await fetch("https://api.resend.com/events/send",{
    method:"POST",
    headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({event,email,payload})
  });
  if(!r.ok)throw new Error(`Resend event failed: ${r.status} ${await r.text()}`);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const auth=req.headers.get("Authorization")||"";
    const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey=Deno.env.get("RESEND_API_KEY")!;
    const portalUrl=Deno.env.get("PARTNER_PORTAL_URL")||"";

    const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});
    const admin=createClient(supabaseUrl,serviceKey);

    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user)return new Response(JSON.stringify({error:"Neautorizat"}),{status:401,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const {orderId,status,photoUrl}=await req.json();
    const allowed=["ACCEPTED","PREPARING","READY","OUT_FOR_DELIVERY","DELIVERED","DECLINED"];
    if(!allowed.includes(status))return new Response(JSON.stringify({error:"Status invalid"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const {data:partner}=await admin.from("partners").select("*").eq("user_id",user.id).eq("active",true).single();
    if(!partner)return new Response(JSON.stringify({error:"Florist inactiv"}),{status:403,headers:{...corsHeaders,"Content-Type":"application/json"}});

    const {data:order}=await admin.from("orders").select("*").eq("id",orderId).eq("partner_id",partner.id).single();
    if(!order)return new Response(JSON.stringify({error:"Comanda nu aparține acestei florării"}),{status:404,headers:{...corsHeaders,"Content-Type":"application/json"}});

    if(status==="READY"&&!(photoUrl||order.photo_url)){
      return new Response(JSON.stringify({error:"Fotografia este obligatorie înainte de statusul Pregătită."}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    if(status==="DECLINED"){
      const {data:candidates}=await admin.from("partners")
        .select("*")
        .eq("active",true)
        .ilike("city",order.delivery_city||"")
        .neq("id",partner.id)
        .order("created_at",{ascending:true});

      const next=(candidates||[])[0]||null;
      await admin.from("orders").update({
        partner_id:next?.id||null,
        status:next?"NEW":"DECLINED",
        updated_at:new Date().toISOString()
      }).eq("id",order.id);

      await admin.from("order_events").insert({
        order_id:order.id,
        actor_user_id:user.id,
        event_type:next?"REROUTED_AFTER_DECLINE":"DECLINED_NO_REPLACEMENT",
        payload:{from_partner_id:partner.id,to_partner_id:next?.id||null}
      });

      if(next){
        const q=(v:string)=>encodeURIComponent(v);
        const acceptUrl=`${portalUrl}?order=${q(order.id)}&action=accept`;
        const declineUrl=`${portalUrl}?order=${q(order.id)}&action=decline`;
        await sendResendEvent(resendKey,"flory.florist.order_assigned",next.email,{
          order_number:order.order_number,
          product_name:order.product_name,
          quantity:order.quantity,
          delivery_city:order.delivery_city,
          delivery_date:order.delivery_date,
          recipient_name:order.recipient_name,
          customer_message:order.card_message||"",
          accept_url:acceptUrl,
          decline_url:declineUrl
        });
      }

      return new Response(JSON.stringify({ok:true,rerouted:!!next}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
    }

    const patch:any={status,updated_at:new Date().toISOString()};
    if(photoUrl)patch.photo_url=photoUrl;

    const {data:updated,error:updateError}=await admin.from("orders").update(patch).eq("id",order.id).select("*").single();
    if(updateError)throw updateError;

    await admin.from("order_events").insert({
      order_id:order.id,
      actor_user_id:user.id,
      event_type:status,
      payload:photoUrl?{photo_url:photoUrl}:{}
    });

    const event=EVENT_BY_STATUS[status as keyof typeof EVENT_BY_STATUS];
    if(event&&updated.customer_email){
      await sendResendEvent(resendKey,event,updated.customer_email,{
        order_number:updated.order_number,
        customer_name:updated.customer_name||"client",
        product_name:updated.product_name,
        florist_name:partner.name,
        delivery_date:updated.delivery_date,
        recipient_name:updated.recipient_name,
        delivery_city:updated.delivery_city,
        photo_url:updated.photo_url||""
      });
    }

    return new Response(JSON.stringify({ok:true,order:updated}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){
    return new Response(JSON.stringify({error:e instanceof Error?e.message:"Eroare internă"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
