# Flory Payments — PayPal + Cloudflare Workers Free

Backend-ul de plăți pentru Flory Flowers. Scopul este să păstrăm cheile PayPal în afara aplicației Android și să deschidem checkout-ul PayPal în browser, nu în WebView.


## Deploy rapid
[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/mariusurlan1980-arch/ScalpAtlas/tree/flory-flowers-apk/FloryPayments)

După deploy, setează secretele `PAYPAL_CLIENT_ID` și `PAYPAL_CLIENT_SECRET`, plus variabila `PAYPAL_ENV=sandbox` pentru primul test.

## Endpoint-uri
- `GET /health`
- `POST /api/paypal/create-order`
- `GET /api/paypal/status?id=PAYPAL_ORDER_ID`
- `GET /paypal/return` — PayPal revine aici, iar Worker-ul capturează plata
- `GET /paypal/cancel`

## Variabile/secrete Cloudflare
Setează în Worker:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_ENV=sandbox` pentru test sau `live` pentru producție

Nu pune `PAYPAL_CLIENT_SECRET` în GitHub sau în aplicația Android.

## Catalog
Worker-ul validează server-side cele 10 produse și prețurile în EUR. Astfel, aplicația nu poate decide singură suma care ajunge la PayPal.

## Activare în aplicație
După publicarea Worker-ului, copiază URL-ul `https://...workers.dev` în:
`FloryFlowersProject/app/src/main/assets/payment-config.js`

După testul sandbox reușit, se schimbă `PAYPAL_ENV` la `live` și se introduc credentialele Live.
