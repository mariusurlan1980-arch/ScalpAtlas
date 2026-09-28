const STATUS={NEW:"Comandă nouă",ACCEPTED:"Acceptată",PREPARING:"În pregătire",READY:"Pregătită",OUT_FOR_DELIVERY:"În livrare",DELIVERED:"Livrată",DECLINED:"Refuzată"};

const DEMO_PARTNER={
 id:"madrid-demo",
 name:"Florist Madrid Demo",
 email:"partner@floryflowers.demo",
 code:"FLORY2026",
 area:"Madrid, Spania",
 commissionPercent:75
};

const DEMO_ORDERS=[
 {id:"FF-1001",product:"Flory Standard – 12 Premium Red Roses",qty:1,city:"Madrid",recipient:"Ana",date:"30.09.2026",total:279,status:"NEW",message:"La mulți ani! ❤️",photo:null},
 {id:"FF-1002",product:"Love Forever",qty:1,city:"Madrid",recipient:"Elena",date:"01.10.2026",total:329,status:"ACCEPTED",message:"Cu dragoste",photo:null}
];

const $=s=>document.querySelector(s);
let currentPartner=null;
let filter="active";
let orders=JSON.parse(localStorage.getItem("floryPartnerOrders")||"null")||DEMO_ORDERS;

function save(){localStorage.setItem("floryPartnerOrders",JSON.stringify(orders))}
function floristShare(order){return Math.round(order.total*(currentPartner?.commissionPercent||75)/100)}
function floryShare(order){return order.total-floristShare(order)}

function login(){
 const email=$("#email").value.trim().toLowerCase();
 const code=$("#partnerCode").value.trim();
 if(email===DEMO_PARTNER.email && code===DEMO_PARTNER.code){
  currentPartner=DEMO_PARTNER;
  sessionStorage.setItem("floryPartner",JSON.stringify(currentPartner));
  showDashboard();
 }else{
  $("#loginMsg").textContent="Datele de acces nu sunt corecte.";
 }
}

function showDashboard(){
 $("#loginView").classList.add("hidden");
 $("#dashboardView").classList.remove("hidden");
 $("#logout").classList.remove("hidden");
 $("#partnerName").textContent=currentPartner.name;
 $("#partnerArea").textContent=currentPartner.area+" · "+currentPartner.commissionPercent+"% florist";
 render();
}

function logout(){
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
   <div><h3>${o.product}</h3><span class="order-no">${o.id}</span></div>
   <span class="status ${o.status}">${STATUS[o.status]}</span>
  </div>
  <div class="order-body">
   <div class="line"><span>Livrare</span><b>${o.city} · ${o.date}</b></div>
   <div class="line"><span>Destinatar</span><b>${o.recipient}</b></div>
   <div class="line"><span>Total client</span><b class="money">${o.total} lei</b></div>
   <div class="line"><span>Partea floristului</span><b class="money">${floristShare(o)} lei</b></div>
   <div class="line"><span>Flory Flowers</span><b>${floryShare(o)} lei</b></div>
  </div>
  <div class="order-actions">
   ${o.status==="NEW"?`<button class="action accept" data-accept="${o.id}">Acceptă</button><button class="action decline" data-decline="${o.id}">Refuză</button>`:`<button class="action manage" data-manage="${o.id}">Deschide comanda</button>`}
  </div>
 </article>`).join(""):'<div class="card muted">Nu există comenzi în această secțiune.</div>';

 document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>setStatus(b.dataset.accept,"ACCEPTED"));
 document.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>setStatus(b.dataset.decline,"DECLINED"));
 document.querySelectorAll("[data-manage]").forEach(b=>b.onclick=()=>openOrder(b.dataset.manage));
}

function setStatus(id,status){
 const o=orders.find(x=>x.id===id); if(!o)return;
 o.status=status; save(); render();
 if(status!=="DECLINED")openOrder(id);
}

function openOrder(id){
 const o=orders.find(x=>x.id===id); if(!o)return;
 $("#modalBody").innerHTML=`
 <h2>${o.product}</h2>
 <p class="muted">${o.id} · ${o.city} · ${o.date}</p>
 <div class="line"><span>Destinatar</span><b>${o.recipient}</b></div>
 <div class="line"><span>Mesaj felicitare</span><b>${o.message||"—"}</b></div>
 <div class="line"><span>Plată florist estimată</span><b class="money">${floristShare(o)} lei</b></div>
 <label>Fotografia buchetului pregătit
   <input id="photoInput" type="file" accept="image/*" capture="environment">
 </label>
 ${o.photo?`<img class="photo-preview" src="${o.photo}" alt="Fotografie buchet">`:""}
 <div class="step-buttons">
  <button data-status="PREPARING">În pregătire</button>
  <button data-status="READY">Pregătită</button>
  <button data-status="OUT_FOR_DELIVERY">În livrare</button>
  <button data-status="DELIVERED">Livrată</button>
 </div>
 <p class="note">În versiunea conectată, fiecare schimbare de status va declanșa automat notificarea clientului prin Resend.</p>`;

 $("#modal").classList.remove("hidden");

 document.querySelectorAll("[data-status]").forEach(b=>b.onclick=()=>{
  if(b.dataset.status==="READY"&&!o.photo){
   alert("Încarcă mai întâi fotografia buchetului.");
   return;
  }
  o.status=b.dataset.status;
  save();
  $("#modal").classList.add("hidden");
  render();
 });

 $("#photoInput").onchange=e=>{
  const f=e.target.files?.[0]; if(!f)return;
  if(f.size>3*1024*1024){
   alert("Fotografia trebuie să fie sub 3 MB.");
   return;
  }
  const r=new FileReader();
  r.onload=()=>{o.photo=r.result;save();openOrder(id)};
  r.readAsDataURL(f);
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

const sess=JSON.parse(sessionStorage.getItem("floryPartner")||"null");
if(sess){currentPartner=sess;showDashboard()}
