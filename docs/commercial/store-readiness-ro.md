# SCALP ATLAS — Checklist lansare comercială

Data: 12 septembrie 2026

## Implementat în proiect

- Ramură comercială separată `commercial-v1`.
- Trial: 5 analize gratuite per utilizator eligibil.
- Paywall după epuizarea trialului.
- Produse pregătite pentru abonament lunar și anual.
- Funcție de restaurare a achizițiilor.
- Integrare IAP pregătită pentru Google Play / Apple App Store.
- Accesul PREMIUM nu este acordat doar din starea locală a telefonului; backend-ul trebuie să confirme dreptul.
- Backend cu PostgreSQL pentru trial și entitlement.
- Protecție tranzacțională pentru consumarea concurentă a încercărilor.
- Adaptor de autentificare și integrare Supabase opțională.
- Tokenul contului este transmis către backend; cheile private nu sunt incluse în APK.
- Titlul neon aprobat SCALP ATLAS este păstrat în sursa comercială.
- Politică de confidențialitate — draft.
- Termeni de utilizare — draft.

## De configurat înainte de publicare

- Crearea/configurarea proiectului Supabase de producție.
- Configurarea URL-ului public Supabase și a cheii publice/anon în mediul aplicației.
- Configurarea secretelor serverului exclusiv în mediul backend.
- Găzduirea backend-ului pe un serviciu HTTPS de producție.
- Configurarea PostgreSQL de producție și rularea migrărilor.
- Crearea produselor reale de abonament în Google Play Console și App Store Connect.
- Stabilirea prețurilor lunar/anual pe țări/monede.
- Implementarea/verificarea endpointurilor oficiale de validare Google Play și Apple pentru achizițiile de producție.
- Configurarea notificărilor server-to-server privind reînnoiri, anulări, rambursări și expirări.
- Configurarea profilului financiar și a contului bancar direct în Google Play Console / App Store Connect.
- Adresa oficială de suport.
- URL public pentru Politica de confidențialitate.
- URL public pentru ștergerea contului / cererea de ștergere a datelor.
- Capturi de ecran pentru magazin, descriere, icon, grafică promoțională.
- Completarea declarațiilor de date/confidențialitate din magazine.
- Completarea declarațiilor pentru funcțiile financiare conform cerințelor magazinelor.
- Test intern Google Play și TestFlight înainte de producție.

## Teste obligatorii înainte de lansare

1. Cont nou → exact 5 analize gratuite.
2. Analiza eșuată/anulată → nu consumă trial.
3. Analiza reușită → consumă exact o încercare.
4. După analiza 5 → apare paywall și analiza 6 nu rulează fără entitlement.
5. Reinstalare / alt dispozitiv → trialul nu se resetează pentru același cont.
6. Cumpărare lunară validă → PREMIUM activ după verificarea serverului.
7. Cumpărare anuală validă → PREMIUM activ după verificarea serverului.
8. Restaurare achiziție → dreptul valid este recuperat.
9. Abonament expirat/anulat → PREMIUM se închide după actualizarea entitlement-ului.
10. Rambursare/revocare → accesul este retras după notificarea magazinului.
11. Două dispozitive simultan → nu pot consuma aceeași încercare gratuită.
12. Fără internet atunci când este necesară validarea → aplicația nu acordă PREMIUM nevalidat.

## Reguli de prezentare comercială

- Nu se promit profituri sau câștiguri garantate.
- Procentele afișate sunt estimări ale motorului, nu garanții.
- Aplicația este prezentată ca instrument de analiză, nu ca executor de tranzacții.
- Nu se execută ordine de cumpărare/vânzare din SCALP ATLAS.
- Trialul de 5 analize și condițiile abonamentului trebuie explicate clar înainte de cumpărare.
