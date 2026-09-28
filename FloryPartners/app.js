const STATUS={NEW:"Comandă nouă",ACCEPTED:"Acceptată",PREPARING:"În pregătire",READY:"Pregătită",OUT_FOR_DELIVERY:"În livrare",DELIVERED:"Livrată",DECLINED:"Refuzată"};

const DEMO_PARTNER={
 id:"madrid-demo",
 name:"Florist Madrid Demo",
 email:"partner@floryflowers.demo",
 code:"FLORY2026",
 area:"Madrid, Spania",
 commission_percent:75
};

const DEMO_ORDERS=[
 {id:"FF-1001",order_number:"FF-1001",product_name:"Flory Standard – 12 Premium Red Roses",quantity:1,delivery_city:"Madrid",recipient_name:"Ana",delivery_date:"2026-09-30",total_amount:279,currency:"RON",status:"NEW",card_message:"La mulți ani! ❤️",photo_url:null},
 {id:"FF-1002",order_number:"FF-1002",product_name:"Love Forever",quantity:1,delivery_city:"Madrid",recipient_name:"Elena",delivery_date:"2026-10-01",total_amount:329,currency:"RON",status:"ACCEPTED",card_message:"Cu dragoste",photo_url:null}
];

const $=s=>document.querySelector(s);
const cfg=window.FLORY_CONFIG||{};
const productionReady=!!(cfg.supabaseUrl&&cfg.supabaseAnonKey&&!cfg.demoMode&&window.supabase);
const sb=productionReady?window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey):null;

let currentPartner=null;
let filter="active";
let orders=productionReady?[]:(JSON.parse(localStorage.getItem("floryPartnerOrders")||"null")||DEMO_ORDERS);

function saveDemo(){if(!productionReady)localStorage.setItem("floryPartnerOrders",JSON.stringify(orders))}
function percent(){return Number(currentPartner?.commission_percent||75)}
function floristShare(order){return Math.round(Number(order.total_amount||0)*percent()/100)}
function floryShare(order){return Number(order.total_amount||0)-floristShare(order)}
function fmtDate(v){if(!v)return"—";const d=new Date(v+"T00:00:00");return isNaN(d)?v:d.toLocaleDateString("ro-RO")}
function fmtMoney(o){return Number(o.total_amount||0).toFixed(0)+" "+(o.currency||"RON")}

async function login(){
 $("#loginMsg").textContent="";
 const email=$("#email").value.trim().toLowerCase();
 const code=$("#partnerCode").value.trim();

 if(productionReady){
  const {data,error}=await sb.auth.signInWithPassword({email,password:code});
  if(error){$("#loginMsg").textContent="Nu am putut face autentificarea.";return}
  const user=data.user;
  const {data:partner,error:pe}=await sb.from("partners").select("*").eq("user_id",user.id).eq("active",true).single();
  if(pe||!partner){$("#loginMsg").textContent="Contul nu este asociat unei florării active.";await sb.auth.signOut();return}
  currentPartner=partner;
  await loadOrders();
  showDashboard();
  return;
 }

 if(email===DEMO_PARTNER.email&&code===DEMO_PARTNER.code){
  currentPartner=DEMO_PARTNER;
  sessionStorage.setItem("floryPartner",JSON.stringify(currentPartner));
  showDashboard();
 }else{
  $("#loginMsg").textContent="Datele de acces nu sunt corecte.";
 }
}

async function restoreSession(){
 if(productionReady){
  const {data}=await sb.auth.getSession();
  const user=data.session?.user;
  if(!user)return;
  const {data:partner}=await sb.from("partners").select("*").eq("user_id",user.id).eq("active",true).single();
  if(!partner)return;
  currentPartner=partner;
  await loadOrders();
  showDashboard();
  return;
 }
 const sess=JSON.parse(sessionStorage.getItem("floryPartner")||"null");
 if(sess){currentPartner=sess;showDashboard()}
}

async function loadOrders(){
 if(!productionReady)return;
 const {data,error}=await sb.from("orders").select("*").eq("partner_id",currentPartner.id).order("created_at",{ascending:false});
 if(error){alert("Nu am putut încărca comenzile.");return}
 orders=data||[];
}

function showDashboard(){
 $("#loginView").classList.add("hidden");
 $("#dashboardView").classList.remove("hidden");
 $("#logout").classList.remove("hidden");
 $("#partnerName").textContent=currentPartner.name;
 const area=[currentPartner.city,currentPartner.country].filter(Boolean).join(", ")||currentPartner.area||"Zonă de livrare";
 $("#partnerArea").textContent=area+" · "+percent()+"% florist";
 render();
 await handleDeepLink();
}

async function handleDeepLink(){
 const p=new URLSearchParams(location.search);
 const orderId=p.get("order"),action=p.get("action");
 if(!orderId||!action||!currentPartner)return;
 const o=orders.find(x=>String(x.id)===String(orderId));
 if(!o){history.replaceState({},document.title,location.pathname);return;}
 history.replaceState({},document.title,location.pathname);
 if(action==="accept"&&o.status==="NEW")await setStatus(o.id,"ACCEPTED");
 else if(action==="decline"&&o.status==="NEW")await setStatus(o.id,"DECLINED");
 else openOrder(o.id);
}

async function logout(){
 if(productionReady)await sb.auth.signOut();
 sessionStorage.removeItem("floryPartner");
 currentPartner=null;
 $("#dashboardView").classList.add("hidden");
 $("#loginView").classList.remove("hidden");
 $("#logout").classList.add("hidden");
}

function visibleOrders(){
 if(filter==="delivered")return orders.filter(o=>o.status==="DELIVERED");
 if(filter==="active")return orders.filter(o=>!["DELIVERED","DECLINED"].includes(o.status));
 return orders;
}

function render(){
 const list=visibleOrders();
 $("#openCount").textContent=orders.filter(o=>!["DELIVERED","DECLINED"].includes(o.status)).length;
 $("#orders").innerHTML=list.length?list.map(o=>`
 <article class="order">
  <div class="order-head">
   <div><h3>${o.product_name}</h3><span class="order-no">${o.order_number||o.id}</span></div>
   <span class="status ${o.status}">${STATUS[o.status]||o.status}</span>
  </div>
  <div class="order-body">
   <div class="line"><span>Livrare</span><b>${o.delivery_city||"—"} · ${fmtDate(o.delivery_date)}</b></div>
   <div class="line"><span>Destinatar</span><b>${o.recipient_name||"—"}</b></div>
   <div class="line"><span>Total client</span><b class="money">${fmtMoney(o)}</b></div>
   <div class="line"><span>Partea floristului</span><b class="money">${floristShare(o)} ${o.currency||"RON"}</b></div>
   <div class="line"><span>Flory Flowers</span><b>${floryShare(o)} ${o.currency||"RON"}</b></div>
  </div>
  <div class="order-actions">
   ${o.status==="NEW"?`<button class="action accept" data-accept="${o.id}">Acceptă</button><button class="action decline" data-decline="${o.id}">Refuză</button>`:`<button class="action manage" data-manage="${o.id}">Deschide comanda</button>`}
  </div>
 </article>`).join(""):'<div class="card muted">Nu există comenzi în această secțiune.</div>';

 document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>setStatus(b.dataset.accept,"ACCEPTED"));
 document.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>setStatus(b.dataset.decline,"DECLINED"));
 document.querySelectorAll("[data-manage]").forEach(b=>b.onclick=()=>openOrder(b.dataset.manage));
}

async function setStatus(id,status,photoUrl){
 const o=orders.find(x=>String(x.id)===String(id)); if(!o)return;

 if(productionReady){
  const body={orderId:o.id,status};
  if(photoUrl)body.photoUrl=photoUrl;
  const {data,error}=await sb.functions.invoke("order-status",{body});
  if(error||data?.error){alert(data?.error||"Actualizarea comenzii a eșuat.");return}
  await loadOrders();
  render();
  if(status!=="DECLINED")openOrder(o.id);
  return;
 }

 o.status=status;
 if(photoUrl)o.photo_url=photoUrl;
 saveDemo();render();
 if(status!=="DECLINED")openOrder(id);
}

async function uploadPhoto(order,file){
 if(file.size>3*1024*1024)throw new Error("Fotografia trebuie să fie sub 3 MB.");

 if(!productionReady){
  return await new Promise((resolve,reject)=>{
   const r=new FileReader();
   r.onerror=()=>reject(new Error("Nu am putut citi fotografia."));
   r.onload=()=>resolve(r.result);
   r.readAsDataURL(file);
  });
 }

 const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
 const safe=`${crypto.randomUUID()}.${ext}`;
 const storagePath=`${currentPartner.id}/${order.id}/${safe}`;
 const {error}=await sb.storage.from("order-photos").upload(storagePath,file,{upsert:false,contentType:file.type||"image/jpeg"});
 if(error)throw error;
 const {data}=sb.storage.from("order-photos").getPublicUrl(storagePath);
 return data.publicUrl;
}

function openOrder(id){
 const o=orders.find(x=>String(x.id)===String(id)); if(!o)return;
 $("#modalBody").innerHTML=`
 <h2>${o.product_name}</h2>
 <p class="muted">${o.order_number||o.id} · ${o.delivery_city||"—"} · ${fmtDate(o.delivery_date)}</p>
 <div class="line"><span>Destinatar</span><b>${o.recipient_name||"—"}</b></div>
 <div class="line"><span>Mesaj felicitare</span><b>${o.card_message||"—"}</b></div>
 <div class="line"><span>Plată florist estimată</span><b class="money">${floristShare(o)} ${o.currency||"RON"}</b></div>
 <label>Fotografia buchetului pregătit
   <input id="photoInput" type="file" accept="image/*" capture="environment">
 </label>
 ${o.photo_url?`<img class="photo-preview" src="${o.photo_url}" alt="Fotografie buchet">`:""}
 <p id="photoMsg" class="msg"></p>
 <div class="step-buttons">
  <button data-status="PREPARING">În pregătire</button>
  <button data-status="READY">Pregătită</button>
  <button data-status="OUT_FOR_DELIVERY">În livrare</button>
  <button data-status="DELIVERED">Livrată</button>
 </div>
 <p class="note">${productionReady?"Fiecare schimbare trimite automat notificarea aferentă prin Resend.":"Mod demonstrație: schimbările sunt doar pe acest dispozitiv."}</p>`;

 $("#modal").classList.remove("hidden");

 document.querySelectorAll("[data-status]").forEach(b=>b.onclick=async()=>{
  if(b.dataset.status==="READY"&&!o.photo_url){
   alert("Încarcă mai întâi fotografia buchetului.");
   return;
  }
  $("#modal").classList.add("hidden");
  await setStatus(o.id,b.dataset.status);
 });

 $("#photoInput").onchange=async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  const msg=$("#photoMsg");
  msg.style.color="#667085";
  msg.textContent="Se încarcă fotografia…";
  try{
   const url=await uploadPhoto(o,file);
   o.photo_url=url;
   if(productionReady){
    await setStatus(o.id,o.status,url);
   }else{
    saveDemo();
    openOrder(o.id);
   }
  }catch(err){
   msg.style.color="#b42318";
   msg.textContent=err.message||"Încărcarea fotografiei a eșuat.";
  }
 };
}

$("#loginBtn").onclick=login;
$("#logout").onclick=logout;
$("#closeModal").onclick=()=>$("#modal").classList.add("hidden");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.add("hidden")};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 filter=b.dataset.filter;
 render();
});

restoreSession();
