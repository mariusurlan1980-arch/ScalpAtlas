const STRINGS = {
  en:{partner:"Florist Partner",loading:"Loading order…",errorTitle:"Link unavailable",errorText:"This order link is invalid or has expired.",delivery:"Delivery:",city:"City:",standard:"Required standard",photo:"Pre-delivery photo required.",recipient:"Recipient",upload:"Upload finished bouquet photo",send:"Send photo",ACCEPT:"ACCEPT ORDER",REJECT:"REJECT",START_PREPARATION:"START PREPARATION",UPLOAD_PHOTO:"UPLOAD PHOTO",START_DELIVERY:"OUT FOR DELIVERY",CONFIRM_DELIVERY:"DELIVERED",working:"Sending…",done:"Updated successfully."},
  de:{partner:"Floristik-Partner",loading:"Bestellung wird geladen…",errorTitle:"Link nicht verfügbar",errorText:"Dieser Bestelllink ist ungültig oder abgelaufen.",delivery:"Lieferung:",city:"Stadt:",standard:"Erforderlicher Standard",photo:"Foto vor der Lieferung erforderlich.",recipient:"Empfänger",upload:"Foto des fertigen Straußes hochladen",send:"Foto senden",ACCEPT:"BESTELLUNG ANNEHMEN",REJECT:"ABLEHNEN",START_PREPARATION:"VORBEREITUNG STARTEN",UPLOAD_PHOTO:"FOTO HOCHLADEN",START_DELIVERY:"IN ZUSTELLUNG",CONFIRM_DELIVERY:"GELIEFERT",working:"Wird gesendet…",done:"Erfolgreich aktualisiert."},
  it:{partner:"Partner fiorista",loading:"Caricamento ordine…",errorTitle:"Link non disponibile",errorText:"Questo link ordine non è valido o è scaduto.",delivery:"Consegna:",city:"Città:",standard:"Standard richiesto",photo:"Foto prima della consegna obbligatoria.",recipient:"Destinatario",upload:"Carica la foto del bouquet finito",send:"Invia foto",ACCEPT:"ACCETTA ORDINE",REJECT:"RIFIUTA",START_PREPARATION:"INIZIA PREPARAZIONE",UPLOAD_PHOTO:"CARICA FOTO",START_DELIVERY:"IN CONSEGNA",CONFIRM_DELIVERY:"CONSEGNATO",working:"Invio…",done:"Aggiornato con successo."},
  es:{partner:"Floristería asociada",loading:"Cargando pedido…",errorTitle:"Enlace no disponible",errorText:"Este enlace de pedido no es válido o ha caducado.",delivery:"Entrega:",city:"Ciudad:",standard:"Estándar requerido",photo:"Foto previa a la entrega obligatoria.",recipient:"Destinatario",upload:"Subir foto del ramo terminado",send:"Enviar foto",ACCEPT:"ACEPTAR PEDIDO",REJECT:"RECHAZAR",START_PREPARATION:"INICIAR PREPARACIÓN",UPLOAD_PHOTO:"SUBIR FOTO",START_DELIVERY:"EN REPARTO",CONFIRM_DELIVERY:"ENTREGADO",working:"Enviando…",done:"Actualizado correctamente."},
  fr:{partner:"Partenaire fleuriste",loading:"Chargement de la commande…",errorTitle:"Lien indisponible",errorText:"Ce lien de commande est invalide ou a expiré.",delivery:"Livraison :",city:"Ville :",standard:"Standard requis",photo:"Photo avant livraison obligatoire.",recipient:"Destinataire",upload:"Télécharger la photo du bouquet terminé",send:"Envoyer la photo",ACCEPT:"ACCEPTER LA COMMANDE",REJECT:"REFUSER",START_PREPARATION:"COMMENCER LA PRÉPARATION",UPLOAD_PHOTO:"AJOUTER LA PHOTO",START_DELIVERY:"EN LIVRAISON",CONFIRM_DELIVERY:"LIVRÉ",working:"Envoi…",done:"Mise à jour réussie."}
};

const lang = (navigator.language || "en").slice(0,2);
const t = STRINGS[lang] || STRINGS.en;
const $ = id => document.getElementById(id);
const token = new URLSearchParams(location.search).get("token");

function localizeStatic(){
  $("partnerLabel").textContent=t.partner;$("loadingText").textContent=t.loading;
  $("errorTitle").textContent=t.errorTitle;$("errorText").textContent=t.errorText;
  $("deliveryLabel").textContent=t.delivery;$("cityLabel").textContent=t.city;
  $("standardTitle").textContent=t.standard;$("photoRule").textContent=t.photo;
  $("recipientTitle").textContent=t.recipient;$("uploadTitle").textContent=t.upload;
  $("submitPhoto").textContent=t.send;
}

async function request(path, options={}){
  const response=await fetch(path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  if(!response.ok) throw new Error("Request failed");
  return response.json();
}

function actionClass(action){
  if(action==="REJECT") return "danger";
  if(action==="CONFIRM_DELIVERY") return "success";
  return "primary";
}

function render(order){
  $("loading").classList.add("hidden");$("order").classList.remove("hidden");
  $("orderName").textContent=order.orderName;$("status").textContent=order.state;
  $("productTitle").textContent=order.productTitle;
  $("productImage").src=order.referenceImageUrl || "";
  $("price").textContent=order.floristPrice ?? "—";$("currency").textContent=order.currency;
  $("delivery").textContent=order.deliveryDate || "—";$("city").textContent=order.deliveryCity || "—";
  $("matchStandard").textContent=order.standard?.matchStandard || "";
  $("substitutionPolicy").textContent=order.standard?.substitutionPolicy || "";
  $("privacyNotice").textContent=order.privacyNotice || "";

  if(order.recipient){
    $("recipientCard").classList.remove("hidden");
    $("recipientName").textContent=order.recipient.name || "";
    $("recipientAddress").textContent=order.recipient.address || "";
    $("recipientPhone").textContent=order.recipient.phone || "";
    $("greeting").textContent=order.greetingMessage || "";
  } else {
    $("recipientCard").classList.add("hidden");
  }

  const actions=$("actions");actions.replaceChildren();
  for(const action of order.actions || []){
    const button=document.createElement("button");
    button.className=actionClass(action);
    button.textContent=t[action] || action;
    button.onclick=()=>handleAction(action,button);
    actions.appendChild(button);
  }
}

async function handleAction(action,button){
  if(action==="UPLOAD_PHOTO"){
    $("uploadPanel").classList.remove("hidden");return;
  }
  const original=button.textContent;button.disabled=true;button.textContent=t.working;
  try{
    const result=await request("/api/partner/action",{method:"POST",body:JSON.stringify({token,action})});
    render(result.order);feedback(t.done);
  }catch{feedback(t.errorText);}
  finally{button.disabled=false;button.textContent=original;}
}

async function sendPhoto(){
  const file=$("photoInput").files[0];
  if(!file) return;
  const data=new FormData();data.append("photo",file);data.append("token",token);
  $("submitPhoto").disabled=true;
  try{
    const response=await fetch("/api/partner/photo",{method:"POST",body:data});
    if(!response.ok) throw new Error();
    const result=await response.json();
    $("uploadPanel").classList.add("hidden");render(result.order);feedback(t.done);
  }catch{feedback(t.errorText);}
  finally{$("submitPhoto").disabled=false;}
}

function feedback(message){$("feedback").textContent=message;$("feedback").classList.remove("hidden");}
function fail(){$("loading").classList.add("hidden");$("error").classList.remove("hidden");}

localizeStatic();$("submitPhoto").onclick=sendPhoto;
if(!token){fail();}else{
  request(`/api/partner/order?token=${encodeURIComponent(token)}`).then(r=>render(r.order)).catch(fail);
}
