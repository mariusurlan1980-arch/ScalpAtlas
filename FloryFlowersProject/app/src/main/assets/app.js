const categories=[
{name:"Toate",img:"prod1.jpg"},
{name:"Trandafiri",img:"prod1.jpg"},
{name:"Buchete romantice",img:"prod2.jpg"},
{name:"Aniversări",img:"prod4.jpg"},
{name:"Premium",img:"prod3.jpg"},
{name:"Cadouri",icon:"🎁"}
];

const products=[
{id:1,name:"Buchet 25 trandafiri roșii",cat:"Trandafiri",ron:249,eur:49.8,rating:"★★★★★ (124)",img:"prod1.jpg"},
{id:2,name:"Buchet mixt elegant",cat:"Buchete romantice",ron:199,eur:39.8,rating:"★★★★★ (86)",img:"prod2.jpg"},
{id:3,name:"Cutie 36 trandafiri roșii",cat:"Premium",ron:399,eur:79.8,rating:"★★★★☆ (73)",img:"prod3.jpg"},
{id:4,name:"Buchet crini albi",cat:"Aniversări",ron:399,eur:79.8,rating:"★★★★★ (52)",img:"prod4.jpg"}
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

function renderCats(){
 $("#cats").innerHTML=categories.map(c=>'<button class="cat '+(state.cat===c.name?"active":"")+'" data-c="'+c.name+'"><div class="cat-img">'+(c.img?'<img src="'+c.img+'" alt="">':c.icon)+'</div><div class="cat-label">'+c.name+'</div></button>').join("");
 document.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{state.cat=b.dataset.c;renderCats();renderProducts()});
}
function filtered(){
 return products.filter(p=>(state.cat==="Toate"||p.cat===state.cat||state.cat==="Cadouri")&&(p.name+" "+p.cat).toLowerCase().includes(state.q.toLowerCase()))
}
function renderProducts(){
 const list=filtered();
 $("#products").innerHTML=list.length?list.map(p=>'<article class="card"><button class="fav" data-f="'+p.id+'">'+(state.fav.has(p.id)?"♥":"♡")+'</button><div class="card-img"><img src="'+p.img+'" alt="'+p.name+'"></div><div class="body"><div class="name">'+p.name+'</div><div class="rating">'+p.rating+'</div><div class="price">'+money(p)+'</div><button class="add" data-a="'+p.id+'">🛒 Adaugă în coș</button></div></article>').join(""):'<div class="empty" style="grid-column:1/-1">Nu am găsit produse.</div>';
 document.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{const id=+b.dataset.f;state.fav.has(id)?state.fav.delete(id):state.fav.add(id);save();renderProducts()});
 document.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{const id=+b.dataset.a;let row=state.cart.find(x=>x.id===id);row?row.qty++:state.cart.push({id,qty:1});save();updateCount();b.textContent="Adăugat ✓";setTimeout(()=>b.textContent="🛒 Adaugă în coș",700)});
}
function updateCount(){$("#count").textContent=state.cart.reduce((s,x)=>s+x.qty,0)}
function openModal(t,h){$("#mt").textContent=t;$("#mb").innerHTML=h;$("#modal").classList.remove("hidden")}
function showFav(){const a=products.filter(p=>state.fav.has(p.id));openModal("Favorite",a.length?a.map(p=>'<div class="row"><span>♡ '+p.name+'</span><b>'+money(p)+'</b></div>').join(""):'<div class="empty">Nu ai produse favorite.</div>')}
function showCart(){let e=0,r=0,h="";state.cart.forEach(x=>{const p=products.find(y=>y.id===x.id);if(!p)return;e+=p.eur*x.qty;r+=p.ron*x.qty;h+='<div class="row"><span>'+p.name+' × '+x.qty+'</span><b>'+(state.cur==="EUR"?(p.eur*x.qty).toFixed(2)+" €":p.ron*x.qty+" Lei")+'</b></div>'});openModal("Comanda mea",h?h+'<div class="total">Total: '+(state.cur==="EUR"?e.toFixed(2)+" €":r+" Lei")+'</div><p style="font-size:12px;color:#667085">Plata și alegerea florăriei partenere vor fi conectate în etapa următoare.</p>':'<div class="empty">Coșul este gol.</div>')}

$("#q").oninput=e=>{state.q=e.target.value;renderProducts()};
$("#cur").value=state.cur;
$("#cur").onchange=e=>{state.cur=e.target.value;save();renderProducts()};
$("#lang").onchange=e=>{if(e.target.value==="EN")openModal("Language","<p>Versiunea multilingvă va fi adăugată ulterior. Aspectul Flory Flowers rămâne neschimbat.</p>")};
$("#discover").onclick=()=>$("#popular").scrollIntoView({behavior:"smooth"});
$("#all").onclick=()=>{state.cat="Toate";renderCats();renderProducts()};
$("#favTop").onclick=showFav;
$("#cartTop").onclick=showCart;
$("#close").onclick=()=>$("#modal").classList.add("hidden");
$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.add("hidden")};
document.querySelectorAll("[data-n]").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".bottom button").forEach(x=>x.classList.toggle("active",x===b));
 if(b.dataset.n==="home")scrollTo({top:0,behavior:"smooth"});
 if(b.dataset.n==="search"){scrollTo({top:0,behavior:"smooth"});setTimeout(()=>$("#q").focus(),250)}
 if(b.dataset.n==="fav")showFav();
 if(b.dataset.n==="cart")showCart();
});

renderCats();renderProducts();updateCount();