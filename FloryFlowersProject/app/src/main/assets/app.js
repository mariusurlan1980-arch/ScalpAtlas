const categories=[
{name:"Toate",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/florists-choice_eb37001d-dcfa-4aaf-9027-5fa6cffcf460.jpg?v=1790337666"},
{name:"Trandafiri",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/24-red-roses.jpg?v=1790337728"},
{name:"Buchete romantice",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pink-whisper.jpg?v=1790337679"},
{name:"Aniversări",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/birthday-joy.jpg?v=1790337688"},
{name:"Premium",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/luxury-rose-box.jpg?v=1790337734"},
{name:"Cadouri",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/sweet-surprise-flory.png?v=1790584151"}
];

const products=[
{id:1,name:"Little Gesture",cat:"Cadouri",ron:129,eur:25.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/little-gesture-flory.png?v=1790584160",desc:"Un gest floral mic și elegant, potrivit pentru surprize simple și mesaje de apreciere."},
{id:2,name:"Sweet Surprise",cat:"Cadouri",ron:169,eur:33.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/sweet-surprise-flory.png?v=1790584151",desc:"Buchet vesel pentru surprize spontane, mulțumiri și momente de zi cu zi."},
{id:3,name:"Florist’s Choice",cat:"Buchete romantice",ron:179,eur:35.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/florists-choice_eb37001d-dcfa-4aaf-9027-5fa6cffcf460.jpg?v=1790337666",desc:"Buchet de sezon realizat de florăria parteneră cu flori proaspete disponibile în ziua livrării."},
{id:4,name:"Pink Whisper",cat:"Buchete romantice",ron:199,eur:39.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pink-whisper.jpg?v=1790337679",desc:"Buchet delicat în tonuri roz și alb, potrivit pentru gesturi romantice și aniversări."},
{id:5,name:"Birthday Joy",cat:"Aniversări",ron:229,eur:45.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/birthday-joy.jpg?v=1790337688",desc:"Buchet colorat și vesel pentru zile de naștere și aniversări."},
{id:6,name:"Pure Elegance",cat:"Aniversări",ron:229,eur:45.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pure-elegance.jpg?v=1790337695",desc:"Aranjament elegant în tonuri alb și crem pentru ocazii speciale."},
{id:7,name:"Red Romance",cat:"Trandafiri",ron:249,eur:49.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/red-romance.jpg?v=1790337701",desc:"Buchet romantic cu trandafiri roșii și flori complementare."},
{id:8,name:"Flory Standard – 12 Premium Red Roses",cat:"Trandafiri",ron:279,eur:55.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/12-premium-red-roses.jpg?v=1790337708",desc:"12 trandafiri roșii premium, tije aproximativ 50–60 cm, verdeață discretă, ambalaj premium și felicitare inclusă."},
{id:9,name:"Pastel Luxury",cat:"Premium",ron:299,eur:59.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/pastel-luxury.jpg?v=1790337715",desc:"Buchet premium în nuanțe pastel, cu aspect elegant și volum generos."},
{id:10,name:"Love Forever",cat:"Buchete romantice",ron:329,eur:65.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/love-forever.jpg?v=1790337721",desc:"Buchet romantic premium pentru declarații de dragoste și momente importante."},
{id:11,name:"24 Red Roses",cat:"Trandafiri",ron:399,eur:79.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/24-red-roses.jpg?v=1790337728",desc:"24 de trandafiri roșii premium pentru un cadou romantic cu impact vizual."},
{id:12,name:"Luxury Rose Box",cat:"Premium",ron:449,eur:89.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/luxury-rose-box.jpg?v=1790337734",desc:"Cutie elegantă cu trandafiri, creată pentru cadouri premium și momente speciale."},
{id:13,name:"Grand Romantic Bouquet",cat:"Buchete romantice",ron:499,eur:99.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/grand-romantic-bouquet.jpg?v=1790337740",desc:"Buchet romantic mare pentru aniversări, cereri speciale și surprize memorabile."},
{id:14,name:"Designer’s Signature",cat:"Premium",ron:599,eur:119.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/designers-signature.jpg?v=1790337747",desc:"Aranjament floral generos realizat în stilul florăriei partenere cu flori sezoniere premium."},
{id:15,name:"36 Premium Red Roses",cat:"Trandafiri",ron:699,eur:139.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-1.png?v=1790610580",imgs:["https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-1.png?v=1790610580","https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-2.png?v=1790610587","https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-3.png?v=1790610594","https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-4.png?v=1790610601","https://cdn.shopify.com/s/files/1/0966/2890/0106/files/36-premium-red-roses-5.png?v=1790610609"],desc:"Buchet impresionant de 36 de trandafiri roșii premium."},
{id:16,name:"50 Luxury Red Roses",cat:"Trandafiri",ron:999,eur:199.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/50-luxury-red-roses-flory.png?v=1790584176",desc:"Buchet luxury de 50 de trandafiri roșii pentru ocazii importante."},
{id:17,name:"100 Red Roses Grand",cat:"Trandafiri",ron:1799,eur:359.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/100-red-roses-grand-flory.png?v=1790584184",desc:"Buchet grandios de 100 de trandafiri roșii premium."},
{id:18,name:"Royal Signature XXL",cat:"Premium",ron:2499,eur:499.8,rating:"★★★★★",img:"https://cdn.shopify.com/s/files/1/0966/2890/0106/files/royal-signature-xxl-flory.png?v=1790584193",desc:"Aranjament Flory Flowers ultra-premium pentru cadouri VIP și ocazii excepționale."}
];

const state={
cat:"Toate",q:"",
fav:new Set(JSON.parse(localStorage.getItem("ffFav")||"[]")),
cart:JSON.parse(localStorage.getItem("ffCart")||"[]"),
cur:localStorage.getItem("ffCur")||"RON"
};

const $=s=>document.querySelector(s);
const save=()=>{localStorage.setItem("ffFav",JSON.stringify([...state.fav]));localStorage.setItem("ffCart",JSON.stringify(state.cart));localStorage.setItem("ffCur",state.cur)};
const money=p=>state.cur==="EUR"?p.eur.toFixed(2)+" €":p.ron+" Lei";
const moneyValue=(p,qty=1)=>state.cur==="EUR"?(p.eur*qty).toFixed(2)+" €":(p.ron*qty)+" Lei";

function renderCats(){
 $("#cats").innerHTML=categories.map(c=>'<button class="cat '+(state.cat===c.name?"active":"")+'" data-c="'+c.name+'"><div class="cat-img">'+(c.img?'<img src="'+c.img+'" alt="">':c.icon)+'</div><div class="cat-label">'+c.name+'</div></button>').join("");
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
 const gallery=(p.imgs&&p.imgs.length?p.imgs:[p.img]);
 const thumbs=gallery.map((src,i)=>'<button class="gallery-thumb '+(i===0?'active':'')+'" data-gallery="'+i+'"><img src="'+src+'" alt="'+p.name+' fotografie '+(i+1)+'"></button>').join("");
 openModal(p.name,'<div class="detail"><div class="gallery-main-wrap"><img id="galleryMain" class="detail-img" src="'+gallery[0]+'" alt="'+p.name+'"><span id="galleryCount" class="gallery-count">1/'+gallery.length+'</span></div><div class="gallery-thumbs">'+thumbs+'</div><div class="detail-rating">'+p.rating+'</div><div class="detail-price">'+money(p)+'</div><p class="detail-desc">'+p.desc+'</p><label class="field-label">Cantitate</label><div class="qty-row"><button id="minusQty">−</button><input id="detailQty" type="number" min="1" max="20" value="1"><button id="plusQty">+</button></div><label class="field-label">Mesaj personal pe felicitare</label><textarea id="detailMessage" class="message-box" maxlength="180" placeholder="Scrie mesajul tău..."></textarea><div class="detail-actions"><button id="detailAdd" class="detail-add">Adaugă în coș</button><button id="buyNow" class="buy-now">Cumpără acum</button></div><small class="detail-note">Mesajul personal este gratuit. Disponibilitatea finală depinde de florăria parteneră.</small></div>');
 document.querySelectorAll("[data-gallery]").forEach(b=>b.onclick=()=>{
   const i=+b.dataset.gallery;
   $("#galleryMain").src=gallery[i];
   $("#galleryCount").textContent=(i+1)+"/"+gallery.length;
   document.querySelectorAll("[data-gallery]").forEach(x=>x.classList.toggle("active",x===b));
 });
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
   h+='<div class="cart-row"><img src="'+p.img+'"><div class="cart-info"><b>'+p.name+'</b><small>Cantitate: '+x.qty+'</small>'+(x.message?'<small>Mesaj: '+x.message+'</small>':'')+'</div><div class="cart-side"><b>'+moneyValue(p,x.qty)+'</b><button data-remove="'+index+'">Șterge</button></div></div>';
 });
 const total=state.cur==="EUR"?e.toFixed(2)+" €":r+" Lei";
 openModal("Comanda mea",h?h+'<div class="total">Total: '+total+'</div><button id="checkoutBtn" class="checkout">Continuă comanda</button>':'<div class="empty">Coșul este gol.</div>');
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{state.cart.splice(+b.dataset.remove,1);save();updateCount();showCart()});
 const cb=$("#checkoutBtn"); if(cb) cb.onclick=showCheckout;
}

function buildOrderText(order){
 let totalRon=0,totalEur=0;
 const lines=order.items.map(x=>{
   const p=products.find(y=>y.id===x.id);
   if(!p)return "";
   totalRon+=p.ron*x.qty; totalEur+=p.eur*x.qty;
   return "• "+p.name+" x"+x.qty+" — "+moneyValue(p,x.qty)+(x.message?"\n  Mesaj: "+x.message:"");
 }).filter(Boolean).join("\n");
 const total=state.cur==="EUR"?totalEur.toFixed(2)+" €":totalRon+" Lei";
 return "FLORY FLOWERS — COMANDĂ\n\n"+lines+"\n\nTotal: "+total+"\n\nClient: "+order.name+"\nTelefon: "+order.phone+"\nDestinatar: "+order.receiver+"\nOraș: "+order.city+"\nAdresă: "+order.address+"\nData livrării: "+(order.date||"de stabilit");
}

function showCheckout(){
 openModal("Date pentru livrare",'<div class="checkout-form"><label>Numele clientului<input id="buyerName" placeholder="Nume și prenume"></label><label>Telefon<input id="buyerPhone" inputmode="tel" placeholder="+40..."></label><label>Numele destinatarului<input id="receiverName" placeholder="Nume destinatar"></label><label>Oraș / localitate<input id="city" placeholder="Oraș"></label><label>Adresa de livrare<textarea id="address" placeholder="Stradă, număr, detalii"></textarea></label><label>Data dorită<input id="deliveryDate" type="date"></label><button id="prepareOrder" class="checkout">Trimite comanda</button><small class="detail-note">Comanda se înregistrează direct în aplicație. Nu folosim WhatsApp.</small></div>');
 $("#prepareOrder").onclick=()=>{
   const name=$("#buyerName").value.trim(), phone=$("#buyerPhone").value.trim(), receiver=$("#receiverName").value.trim(), city=$("#city").value.trim(), address=$("#address").value.trim();
   if(!name||!phone||!receiver||!city||!address){alert("Completează câmpurile obligatorii.");return;}
   const order={name,phone,receiver,city,address,date:$("#deliveryDate").value,items:state.cart,createdAt:new Date().toISOString()};
   localStorage.setItem("ffLastOrder",JSON.stringify(order));
   const orders=JSON.parse(localStorage.getItem("ffOrders")||"[]");
   orders.unshift(order);
   localStorage.setItem("ffOrders",JSON.stringify(orders.slice(0,50)));
   const txt=buildOrderText(order);
   const orderNo="FF-"+Date.now().toString().slice(-6);
   localStorage.setItem("ffLastOrderNo",orderNo);
   openModal("Comandă înregistrată",'<div class="order-ok">✓<h3>Comanda a fost înregistrată.</h3><p>Număr comandă: <b>'+orderNo+'</b></p><div class="order-preview" id="orderPreview"></div><button id="finishOrder" class="checkout">Închide</button><small class="detail-note">Comanda este salvată în aplicație pe acest dispozitiv.</small></div>');
   $("#orderPreview").textContent=txt;
   $("#finishOrder").onclick=()=>{
     state.cart=[];
     save();
     updateCount();
     closeModal();
   };
 };
}

$("#q").oninput=e=>{state.q=e.target.value;renderProducts()};
$("#cur").value=state.cur;
$("#cur").onchange=e=>{state.cur=e.target.value;save();renderProducts()};
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

renderCats();renderProducts();updateCount();