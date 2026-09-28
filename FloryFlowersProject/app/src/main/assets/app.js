const categories=[
{name:"Toate",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/little-gesture-1.jpg?v=1790613112"},
{name:"Cadouri",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/sweet-surprise-1.jpg?v=1790612425"},
{name:"Romantice",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pink-whisper.jpg?v=1790337679"},
{name:"Elegante",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pure-elegance.jpg?v=1790337695"},
{name:"Trandafiri",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/12-premium-red-roses.jpg?v=1790337708"}
];

const markets={EU:"Europa",ES:"Spania",DE:"Germania",BG:"Bulgaria",RO:"România"};

const products=[
{id:1,name:"Little Gesture",variantId:"53815222206730",cat:"Cadouri",ron:129,eur:25.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/little-gesture-1.jpg?v=1790613112",desc:"Un gest floral mic și elegant, potrivit pentru surprize simple și mesaje de apreciere."},
{id:2,name:"Sweet Surprise",variantId:"53815222239498",cat:"Cadouri",ron:169,eur:33.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/sweet-surprise-1.jpg?v=1790612425",desc:"Buchet vesel pentru surprize spontane, mulțumiri și momente de zi cu zi."},
{id:3,name:"Pink Whisper",variantId:"53812390527242",cat:"Romantice",ron:199,eur:39.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pink-whisper.jpg?v=1790337679",desc:"Buchet delicat în tonuri roz și alb, potrivit pentru gesturi romantice și aniversări."},
{id:4,name:"Pure Elegance",variantId:"53812392558858",cat:"Elegante",ron:229,eur:45.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pure-elegance.jpg?v=1790337695",desc:"Aranjament elegant în tonuri alb și crem pentru ocazii speciale."},
{id:5,name:"Red Romance",variantId:"53812392788234",cat:"Trandafiri",ron:249,eur:49.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/red-romance.jpg?v=1790337701",desc:"Buchet romantic cu trandafiri roșii și flori complementare."},
{id:6,name:"Flory Standard – 12 Premium Red Roses",variantId:"53812395409674",cat:"Trandafiri",ron:279,eur:55.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/12-premium-red-roses.jpg?v=1790337708",desc:"12 trandafiri roșii premium, tije aproximativ 50–60 cm, verdeață discretă, ambalaj premium și felicitare inclusă."},
{id:7,name:"Love Forever",variantId:"53812395868426",cat:"Romantice",ron:329,eur:65.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/love-forever.jpg?v=1790337721",desc:"Buchet romantic premium pentru declarații de dragoste și momente importante."},
{id:8,name:"Grand Romantic Bouquet",variantId:"53812402979082",cat:"Romantice",ron:499,eur:99.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/grand-romantic-bouquet.jpg?v=1790337740",desc:"Buchet romantic mare pentru aniversări, cereri speciale și surprize memorabile."},
{id:9,name:"36 Premium Red Roses",variantId:"53815222501642",cat:"Trandafiri",ron:699,eur:139.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-1.png?v=1790610580",desc:"Buchet impresionant de 36 de trandafiri roșii premium."},
{id:10,name:"50 Luxury Red Roses",variantId:"53815222534410",cat:"Trandafiri",ron:999,eur:199.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/50-luxury-red-roses-1.jpg?v=1790613551",desc:"Buchet luxury de 50 de trandafiri roșii pentru ocazii importante."}
];

const state={
cat:"Toate",q:"",
fav:new Set(JSON.parse(localStorage.getItem("ffFav")||"[]")),
cart:JSON.parse(localStorage.getItem("ffCart")||"[]"),
cur:localStorage.getItem("ffCur")||"EUR",
market:localStorage.getItem("ffMarket")||"EU"
};

const $=s=>document.querySelector(s);
const payCfg=window.FLORY_PAYMENT_CONFIG||{};
const save=()=>{localStorage.setItem("ffFav",JSON.stringify([...state.fav]));localStorage.setItem("ffCart",JSON.stringify(state.cart));localStorage.setItem("ffCur",state.cur);localStorage.setItem("ffMarket",state.market)};
const money=p=>state.cur==="EUR"?p.eur.toFixed(2)+" €":p.ron+" Lei";
const moneyValue=(p,qty=1)=>state.cur==="EUR"?(p.eur*qty).toFixed(2)+" €":(p.ron*qty)+" Lei";
const cdnWidth=(url,w)=>url+(url.includes("?")?"&":"?")+"width="+w;

function renderCats(){
 $("#cats").innerHTML=categories.map(c=>'<button class="cat '+(state.cat===c.name?"active":"")+'" data-c="'+c.name+'"><div class="cat-img">'+(c.img?'<img src="'+cdnWidth(c.img,180)+'" alt="" loading="lazy" decoding="async">':c.icon)+'</div><div class="cat-label">'+c.name+'</div></button>').join("");
 document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{
   state.cat=b.dataset.c;
   renderCats();
   renderProducts();
   $("#popular").scrollIntoView({behavior:"smooth",block:"start"});
 });
}

function filtered(){
 const q=state.q.trim().toLowerCase();
 return products.filter(p=>{
   const categoryOk=state.cat==="Toate" || p.cat===state.cat;
   const queryOk=!q || (p.name+" "+p.cat+" "+p.desc).toLowerCase().includes(q);
   return categoryOk && queryOk;
 });
}

function renderProducts(){
 const list=filtered();
 $("#products").innerHTML=list.length?list.map(p=>'<article class="card"><button class="fav" data-f="'+p.id+'">'+(state.fav.has(p.id)?"♥":"♡")+'</button><button class="product-open" data-p="'+p.id+'"><div class="card-img"><img src="'+p.img+'" alt="'+p.name+'"></div><div class="body"><div class="name">'+p.name+'</div><div class="rating">'+p.rating+'</div><div class="price">'+money(p)+'</div></div></button></article>').join(""):'<div class="empty" style="grid-column:1/-1">Nu am găsit produse.</div>';

 document.querySelectorAll("[data-f]").forEach(b=>b.onclick=e=>{
   e.stopPropagation();
   const id=+b.dataset.f;
   state.fav.has(id)?state.fav.delete(id):state.fav.add(id);
   save();renderProducts();
 });
 document.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>showProduct(+b.dataset.p));
}

function addToCart(id,qty=1,message=""){
 let row=state.cart.find(x=>x.id===id && (x.message||"")===(message||""));
 if(row) row.qty+=qty; else state.cart.push({id,qty,message});
 save();updateCount();
}

function updateCount(){
 $("#count").textContent=state.cart.reduce((s,x)=>s+x.qty,0);
}

function openModal(t,h){
 $("#mt").textContent=t;
 $("#mb").innerHTML=h;
 $("#modal").classList.remove("hidden");
}

function closeModal(){
 $("#modal").classList.add("hidden");
}

function showProduct(id){
 const p=products.find(x=>x.id===id);
 if(!p)return;
 openModal(p.name,'<div class="detail"><img class="detail-img single-product-img" src="'+p.img+'" alt="'+p.name+'"><div class="detail-rating">'+p.rating+'</div><div class="detail-price">'+money(p)+'</div><p class="detail-desc">'+p.desc+'</p><label class="field-label">Cantitate</label><div class="qty-row"><button id="minusQty">−</button><input id="detailQty" type="number" min="1" max="20" value="1"><button id="plusQty">+</button></div><label class="field-label">Mesaj personal pe felicitare</label><textarea id="detailMessage" class="message-box" maxlength="180" placeholder="Scrie mesajul tău..."></textarea><div class="detail-actions"><button id="detailAdd" class="detail-add">Adaugă în coș</button><button id="buyNow" class="buy-now">Cumpără acum</button></div><small class="detail-note">Mesajul personal este gratuit. Disponibilitatea finală depinde de florăria parteneră.</small></div>');
 const qty=$("#detailQty");
 $("#minusQty").onclick=()=>qty.value=Math.max(1,(+qty.value||1)-1);
 $("#plusQty").onclick=()=>qty.value=Math.min(20,(+qty.value||1)+1);
 $("#detailAdd").onclick=()=>{
   addToCart(id,Math.max(1,+qty.value||1),$("#detailMessage").value.trim());
   closeModal();
 };
 $("#buyNow").onclick=()=>{
   addToCart(id,Math.max(1,+qty.value||1),$("#detailMessage").value.trim());
   showCart();
 };
}

function showFav(){
 const a=products.filter(p=>state.fav.has(p.id));
 openModal("Favorite",a.length?a.map(p=>'<button class="fav-row" data-favopen="'+p.id+'"><img src="'+p.img+'"><span>'+p.name+'</span><b>'+money(p)+'</b></button>').join(""):'<div class="empty">Nu ai produse favorite.</div>');
 document.querySelectorAll("[data-favopen]").forEach(b=>b.onclick=()=>showProduct(+b.dataset.favopen));
}

function showCart(){
 let e=0,r=0,h="";
 state.cart.forEach((x,index)=>{
   const p=products.find(y=>y.id===x.id);
   if(!p)return;
   e+=p.eur*x.qty;r+=p.ron*x.qty;
   h+='<div class="cart-row"><img src="'+cdnWidth(p.img,180)+'" loading="lazy" decoding="async"><div class="cart-info"><b>'+p.name+'</b><small>Cantitate: '+x.qty+'</small>'+(x.message?'<small>Mesaj: '+x.message+'</small>':'')+'</div><div class="cart-side"><b>'+moneyValue(p,x.qty)+'</b><button data-remove="'+index+'">Șterge</button></div></div>';
 });
 const total=state.cur==="EUR"?e.toFixed(2)+" €":r+" Lei";
 openModal("Comanda mea",h?h+'<div class="total">Total: '+total+'</div><button id="checkoutBtn" class="checkout">Continuă comanda</button>':'<div class="empty">Coșul este gol.</div>');
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{state.cart.splice(+b.dataset.remove,1);save();updateCount();showCart()});
 const cb=$("#checkoutBtn"); if(cb) cb.onclick=showCheckout;
}

async function startPayment(order){
 const base=String(payCfg.apiBase||"").replace(/\/$/,"");
 if(!base){
   openModal("Plată PayPal",'<div class="order-ok"><h3>Activarea plății este aproape gata</h3><p>Backend-ul securizat PayPal este pregătit, dar mai trebuie conectat URL-ul lui public.</p><p class="detail-note">Nu se trimite nicio plată și nu se debitează nimic.</p></div>');
   return;
 }
 const btn=$("#prepareOrder");
 if(btn){btn.disabled=true;btn.textContent="Se pregătește plata…";}
 try{
   const payload={
     country:order.country,
     receiver:order.receiver,
     city:order.city,
     date:order.date,
     items:order.items.map(x=>({id:x.id,qty:x.qty,message:x.message||""}))
   };
   const response=await fetch(base+"/api/paypal/create-order",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify(payload)
   });
   const data=await response.json();
   if(!response.ok||!data.approveUrl)throw new Error(data.error||"Nu am putut iniția plata PayPal.");
   localStorage.setItem("ffPendingPayment",JSON.stringify({
     paypalOrderId:data.id,
     reference:data.reference,
     amount:data.total,
     currency:data.currency,
     order
   }));
   if(window.Android&&typeof window.Android.openExternal==="function"){
     window.Android.openExternal(data.approveUrl);
   }else{
     window.location.href=data.approveUrl;
   }
 }catch(err){
   alert(err.message||"Plata nu a putut fi pornită.");
   if(btn){btn.disabled=false;btn.textContent="Plătește securizat cu PayPal";}
 }
}

async function verifyPendingPayment(){
 const raw=localStorage.getItem("ffPendingPayment");
 if(!raw)return;
 const pending=JSON.parse(raw);
 const base=String(payCfg.apiBase||"").replace(/\/$/,"");
 if(!base||!pending.paypalOrderId)return;
 try{
   const r=await fetch(base+"/api/paypal/status?id="+encodeURIComponent(pending.paypalOrderId));
   const data=await r.json();
   if(data.status==="COMPLETED"||data.payment_status==="COMPLETED"){
     state.cart=[];
     save();updateCount();
     localStorage.removeItem("ffPendingPayment");
     openModal("Plată confirmată",'<div class="order-ok"><div style="font-size:48px">✓</div><h3>Comanda a fost plătită</h3><p>Referință: <b>'+((pending.reference||pending.paypalOrderId))+'</b></p><p>Continuăm cu repartizarea către florăria parteneră.</p></div>');
   }
 }catch(e){}
}

window.handlePaymentReturn=async function(status,orderId){
 if(status==="success"){
   await verifyPendingPayment();
 }else if(status==="cancelled"){
   openModal("Plată anulată",'<div class="order-ok"><h3>Plata a fost anulată</h3><p>Coșul tău a rămas neschimbat.</p></div>');
 }else{
   openModal("Verificare plată",'<div class="order-ok"><h3>Plata necesită verificare</h3><p>Nu trimitem comanda până când plata nu apare confirmată.</p></div>');
 }
};

function showCheckout(){
 const preferred=state.market==="EU"?"":state.market;
 openModal("Finalizare comandă",'<div class="checkout-form"><p class="checkout-intro">Completează detaliile pentru livrare în Europa.</p><label>Țara de livrare<select id="deliveryCountry"><option value="">Alege țara</option><option value="ES">Spania</option><option value="DE">Germania</option><option value="BG">Bulgaria</option><option value="RO">România</option></select></label><label>Numele destinatarului<input id="receiverName" placeholder="Nume destinatar"></label><label>Oraș / localitate<input id="city" placeholder="Oraș"></label><label>Data dorită<input id="deliveryDate" type="date"></label><button id="prepareOrder" class="checkout">Plătește securizat cu PayPal</button><small class="detail-note">Plata se finalizează în browserul securizat PayPal. Suma de plată este calculată în EUR pe serverul Flory Flowers.</small></div>');
 if(preferred)$("#deliveryCountry").value=preferred;
 $("#prepareOrder").onclick=async()=>{
   const receiver=$("#receiverName").value.trim(), city=$("#city").value.trim(), country=$("#deliveryCountry").value;
   if(!country||!receiver||!city){alert("Completează țara, numele destinatarului și orașul.");return;}
   const order={country,receiver,city,date:$("#deliveryDate").value,items:state.cart,createdAt:new Date().toISOString()};
   localStorage.setItem("ffLastOrder",JSON.stringify(order));
   await startPayment(order);
 };
}

$("#q").oninput=e=>{state.q=e.target.value;renderProducts()};
$("#cur").value=state.cur;
$("#cur").onchange=e=>{state.cur=e.target.value;save();renderProducts()};
$("#market").value=state.market;
$("#market").onchange=e=>{state.market=e.target.value;save()};
$("#lang").onchange=e=>{if(e.target.value==="EN")openModal("Language","<p>Versiunea multilingvă va fi adăugată ulterior. Aspectul Flory Flowers rămâne neschimbat.</p>")};
$("#discover").onclick=()=>$("#popular").scrollIntoView({behavior:"smooth"});
$("#all").onclick=()=>{state.cat="Toate";renderCats();renderProducts()};
$("#favTop").onclick=showFav;
$("#cartTop").onclick=showCart;
$("#close").onclick=closeModal;
$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};
document.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".bottom button").forEach(x=>x.classList.toggle("active",x===b));
 if(b.dataset.n==="home")scrollTo({top:0,behavior:"smooth"});
 if(b.dataset.n==="search"){scrollTo({top:0,behavior:"smooth"});setTimeout(()=>$("#q").focus(),250)}
 if(b.dataset.n==="fav")showFav();
 if(b.dataset.n==="cart")showCart();
});

renderCats();renderProducts();updateCount();verifyPendingPayment();