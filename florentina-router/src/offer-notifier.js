import nodemailer from "nodemailer";

const COPY = {
  en: {
    subject: order => `New Florentina Flowers order ${order.orderName}`,
    intro: "A new flower-delivery order is available for you.",
    product: "Product",
    city: "Delivery city",
    date: "Delivery date",
    price: "Your agreed amount",
    deadline: "Please accept or reject before",
    action: "Open secure order link",
    privacy: "Recipient name, address and phone are revealed only after you accept the order."
  },
  de: {
    subject: order => `Neue Florentina Flowers Bestellung ${order.orderName}`,
    intro: "Eine neue Blumenlieferung steht für Sie bereit.",
    product: "Produkt",
    city: "Lieferstadt",
    date: "Lieferdatum",
    price: "Ihr vereinbarter Betrag",
    deadline: "Bitte annehmen oder ablehnen bis",
    action: "Sicheren Bestelllink öffnen",
    privacy: "Name, Adresse und Telefonnummer des Empfängers werden erst nach Annahme angezeigt."
  },
  it: {
    subject: order => `Nuovo ordine Florentina Flowers ${order.orderName}`,
    intro: "È disponibile un nuovo ordine di consegna fiori.",
    product: "Prodotto",
    city: "Città di consegna",
    date: "Data di consegna",
    price: "Importo concordato",
    deadline: "Accetta o rifiuta entro",
    action: "Apri il link sicuro dell'ordine",
    privacy: "Nome, indirizzo e telefono del destinatario saranno visibili solo dopo l'accettazione."
  },
  es: {
    subject: order => `Nuevo pedido Florentina Flowers ${order.orderName}`,
    intro: "Hay un nuevo pedido de entrega de flores disponible.",
    product: "Producto",
    city: "Ciudad de entrega",
    date: "Fecha de entrega",
    price: "Importe acordado",
    deadline: "Acepta o rechaza antes de",
    action: "Abrir enlace seguro del pedido",
    privacy: "El nombre, dirección y teléfono del destinatario se muestran solo después de aceptar."
  },
  fr: {
    subject: order => `Nouvelle commande Florentina Flowers ${order.orderName}`,
    intro: "Une nouvelle commande de livraison de fleurs est disponible.",
    product: "Produit",
    city: "Ville de livraison",
    date: "Date de livraison",
    price: "Montant convenu",
    deadline: "Merci d'accepter ou de refuser avant",
    action: "Ouvrir le lien sécurisé de la commande",
    privacy: "Le nom, l'adresse et le téléphone du destinataire ne sont révélés qu'après acceptation."
  }
};

export function buildOfferEmail({ order, partner, portalUrl, expiresAt }) {
  const lang = partner.language || languageForCountry(partner.countryCode);
  const c = COPY[lang] || COPY.en;

  const lines = [
    c.intro,
    "",
    `${c.product}: ${order.productTitle || ""}`,
    `${c.city}: ${order.city || ""}`,
    `${c.date}: ${order.deliveryDate || ""}`,
    `${c.price}: ${formatMoney(order.supplierCost, order.currency)}`,
    `${c.deadline}: ${formatDeadline(expiresAt, lang)}`,
    "",
    `${c.action}: ${portalUrl}`,
    "",
    c.privacy
  ];

  return {
    to: partner.email,
    subject: c.subject(order),
    text: lines.join("\n")
  };
}

export class SmtpOfferNotifier {
  constructor({ host, port, secure, user, pass, from }) {
    if (!host || !from) throw new Error("SMTP host and sender are required");
    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port || (secure ? 465 : 587)),
      secure: Boolean(secure),
      auth: user ? { user, pass } : undefined
    });
  }

  async sendOffer(input) {
    const message = buildOfferEmail(input);
    if (!message.to) throw new Error("Florist email is missing");

    const result = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text
    });

    return {
      channel: "email",
      messageId: result.messageId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || []
    };
  }
}

export class LogOfferNotifier {
  async sendOffer(input) {
    const message = buildOfferEmail(input);
    console.log(JSON.stringify({
      type: "FLORIST_OFFER",
      to: message.to,
      subject: message.subject,
      text: message.text
    }));
    return { channel: "log", messageId: null };
  }
}

function languageForCountry(countryCode) {
  return {
    DE: "de",
    IT: "it",
    ES: "es",
    FR: "fr"
  }[String(countryCode || "").toUpperCase()] || "en";
}

function formatMoney(amount, currency) {
  if (amount === null || amount === undefined || amount === "") return "—";
  return `${amount} ${currency || "EUR"}`;
}

function formatDeadline(value, lang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(lang, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "UTC"
    }).format(date) + " UTC";
  } catch {
    return date.toISOString();
  }
}
