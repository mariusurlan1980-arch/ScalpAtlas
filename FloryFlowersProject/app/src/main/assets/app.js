const categories=[
{name:"Toate",img:"prod1.jpg"},
{name:"Trandafiri",img:"prod1.jpg"},
{name:"Buchete romantice",img:"prod2.jpg"},
{name:"Aniversări",img:"prod4.jpg"},
{name:"Premium",img:"prod3.jpg"},
{name:"Cadouri",icon:"🎁"}
];

const products=[
{id:1,name:"Buchet 25 trandafiri roșii",cat:"Trandafiri",ron:249,eur:49.8,rating:"★★★★★ (124)",img:"prod1.jpg",desc:"Un buchet elegant cu 25 de trandafiri roșii, verdeață decorativă și ambalaj premium. Potrivit pentru declarații de dragoste și aniversări."},
{id:2,name:"Buchet mixt elegant",cat:"Buchete romantice",ron:199,eur:39.8,rating:"★★★★★ (86)",img:"prod2.jpg",desc:"Buchet romantic în nuanțe de roz, roșu și crem, creat pentru momente speciale și surprize elegante."},
{id:3,name:"Cutie 36 trandafiri roșii",cat:"Premium",ron:399,eur:79.8,rating:"★★★★☆ (73)",img:"prod3.jpg",desc:"36 de trandafiri roșii aranjați într-o cutie premium neagră. Un cadou impresionant pentru ocazii importante."},
{id:4,name:"Buchet crini albi",cat:"Aniversări",ron:399,eur:79.8,rating:"★★★★★ (52)",img:"prod4.jpg",desc:"Crini albi proaspeți într-un aranjament luminos și rafinat, potrivit pentru aniversări și evenimente elegante."},
{id:5,name:"Buchet 50 trandafiri roșii",cat:"Trandafiri",ron:429,eur:85.8,rating:"★★★★★ (61)",img:"prod1.jpg",desc:"Un buchet spectaculos cu 50 de trandafiri roșii, pentru o declarație memorabilă."},
{id:6,name:"Trandafiri roz delicat",cat:"Trandafiri",ron:229,eur:45.8,rating:"★★★★★ (47)",img:"prod2.jpg",desc:"Trandafiri în tonuri delicate de roz, ambalați modern. Potriviți pentru aniversări, mulțumiri și gesturi romantice."},
{id:7,name:"Romantic Deluxe",cat:"Buchete romantice",ron:299,eur:59.8,rating:"★★★★★ (39)",img:"prod2.jpg",desc:"Combinație bogată de flori romantice, într-un buchet premium cu aspect elegant și volum generos."},
{id:8,name:"Aniversare Pastel",cat:"Aniversări",ron:239,eur:47.8,rating:"★★★★☆ (31)",img:"prod4.jpg",desc:"Un buchet luminos în tonuri pastel, creat special pentru zile de naștere și aniversări."},
{id:9,name:"Cutie Premium 55 trandafiri",cat:"Premium",ron:549,eur:109.8,rating:"★★★★★ (28)",img:"prod3.jpg",desc:"Aranjament premium cu 55 de trandafiri într-o cutie elegantă, pentru un efect spectaculos."},
{id:10,name:"Buchet Premium Royal",cat:"Premium",ron:459,eur:91.8,rating:"★★★★★ (22)",img:"prod1.jpg",desc:"Buchet premium cu trandafiri roșii și finisaje elegante, potrivit pentru ocazii deosebite."},
{id:11,name:"Flori + cadou surpriză",cat:"Cadouri",ron:279,eur:55.8,rating:"★★★★★ (44)",img:"prod2.jpg",desc:"Buchet romantic însoțit de un mic cadou surpriză. Mesajul personal este inclus."},
{id:12,name:"Cutie trandafiri + cadou",cat:"Cadouri",ron:349,eur:69.8,rating:"★★★★★ (35)",img:"prod3.jpg",desc:"Cutie elegantă cu trandafiri și cadou, pregătită pentru livrare la persoana dragă."}
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
 $("#products").innerHTML=list.length?list.map(p=>'<article class="card"><button class="fav" data-f="'+p.id+'">'+(state.fav.has(p.id)?"♥":"♡")+'</button><button class="product-open" data-p="'+p.id+'"><div class="card-img"><img src="'+p.img+'" alt="'+p.name+'"></div><div class="body"><div class="name">'+p.name+'</div><div class="rating">'+p.rating+'</div><div class="price">'+money(p)+'</div></div></button><button class="add" data-a="'+p.id+'">🛒 Adaugă în coș</button></article>').join(""):'<div class="empty" style="grid-column:1/-1">Nu am găsit produse.</div>';

 document.querySelectorAll("[data-f]").forEach(b=>b.onclick=e=>{
   e.stopPropagation();
   const id=+b.dataset.f;
   state.fav.has(id)?state.fav.delete(id):state.fav.add(id);
   save();renderProducts();
 });
 document.querySelectorAll("[data-a]").forEach(b=>b.onclick=e=>{
   e.stopPropagation();
   addToCart(+b.dataset.a,1,"");
   b.textContent="Adăugat ✓";
   setTimeout(()=>b.textContent="🛒 Adaugă în coș",700);
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
 openModal(p.name,'<div class="detail"><img class="detail-img" src="'+p.img+'" alt="'+p.name+'"><div class="detail-rating">'+p.rating+'</div><div class="detail-price">'+money(p)+'</div><p class="detail-desc">'+p.desc+'</p><label class="field-label">Cantitate</label><div class="qty-row"><button id="minusQty">−</button><input id="detailQty" type="number" min="1" max="20" value="1"><button id="plusQty">+</button></div><label class="field-label">Mesaj personal pe felicitare</label><textarea id="detailMessage" class="message-box" maxlength="180" placeholder="Scrie mesajul tău..."></textarea><div class="detail-actions"><button id="detailAdd" class="detail-add">Adaugă în coș</button><button id="buyNow" class="buy-now">Cumpără acum</button></div><small class="detail-note">Mesajul personal este gratuit. Disponibilitatea finală depinde de florăria parteneră.</small></div>');
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

function showCheckout(){
 openModal("Date pentru livrare",'<div class="checkout-form"><label>Numele clientului<input id="buyerName" placeholder="Nume și prenume"></label><label>Telefon<input id="buyerPhone" inputmode="tel" placeholder="+40..."></label><label>Numele destinatarului<input id="receiverName" placeholder="Nume destinatar"></label><label>Oraș / localitate<input id="city" placeholder="Oraș"></label><label>Adresa de livrare<textarea id="address" placeholder="Stradă, număr, detalii"></textarea></label><label>Data dorită<input id="deliveryDate" type="date"></label><button id="prepareOrder" class="checkout">Pregătește comanda</button><small class="detail-note">Această versiune salvează și pregătește comanda. Plata online și trimiterea automată către florăria parteneră vor fi conectate în etapa următoare.</small></div>');
 $("#prepareOrder").onclick=()=>{
   const name=$("#buyerName").value.trim(), phone=$("#buyerPhone").value.trim(), receiver=$("#receiverName").value.trim(), city=$("#city").value.trim(), address=$("#address").value.trim();
   if(!name||!phone||!receiver||!city||!address){alert("Completează câmpurile obligatorii.");return;}
   const order={name,phone,receiver,city,address,date:$("#deliveryDate").value,items:state.cart,createdAt:new Date().toISOString()};
   localStorage.setItem("ffLastOrder",JSON.stringify(order));
   openModal("Comandă pregătită",'<div class="order-ok">✓<h3>Comanda este pregătită.</h3><p>Datele au fost salvate pe telefon pentru această versiune de test.</p><p>În etapa următoare conectăm plata și trimiterea automată către florăria parteneră.</p></div>');
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