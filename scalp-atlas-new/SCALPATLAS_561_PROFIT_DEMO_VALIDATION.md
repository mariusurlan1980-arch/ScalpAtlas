# Scalp Atlas 561 – verificarea unei strategii orientate spre profit, numai QT DEMO

Scop: să evaluăm obiectiv dacă semnalele de tip **MINIM/MAXIM local + prima lumânare M5 închisă + a doua de aceeași culoare cu retragere simbolică și revenire** obțin un rezultat pozitiv, fără să confundăm un BIP sau o apăsare Android cu un ordin închis de broker.

## Reguli păstrate
- Exclusiv QT DEMO; grafic M5; expirare 5 minute; payout 92% **exact**; maxim o singură poziție activă.
- Nu intrăm înainte de confirmarea retragerii și revenirii din lumânarea 2. Nu există o așteptare artificială de 2 minute și 30 secunde.
- Miza se alege în broker și este **fixă pe durata lotului de test**. Nu activăm Martingale/recuperare automată după LOSS.
- După **3 LOSS consecutive** sau pierdere netă cumulată de **5 USD pe sesiune** în varianta de referință, modulul marchează **PAUZĂ RISC**. Acest marker rămâne memorat chiar dacă istoricul importat mai conține WIN-uri.
- Fiecare rezultat necesită ordin închis cu ID unic, cont QT DEMO, miză, payout și rezultat net verificat. Timerul și capturile de ecran nu dovedesc decontarea.
- Evaluare de referință la **cel puțin 50 de WIN/LOSS** documentate (ideal mai multe). Un eșantion mic, chiar profitabil, nu dovedește avantajul viitor.

## Indicatori
- Număr ordine, WIN, LOSS, DRAW, rată câștig, profit/pierdere netă, drawdown maxim și pierderi consecutive.
- La payout 92%, pragul matematic pentru break-even cu miză fixă și doar WIN/LOSS este **peste 52,08% câștiguri**. Comisioanele, diferențele de payout și alte costuri pot ridica pragul real.
- Exemplu pur sintetic, la 1 USD pe ordin: 28 WIN și 22 LOSS în 50 tranzacții generează +3,76 USD; 26 WIN și 24 LOSS generează −0,08 USD. Acestea sunt exemple aritmetice, nu rezultate ale Scalp Atlas pe broker.
- Nu afișăm un procent „probabilitate de WIN” inventat. „REZULTAT POZITIV” descrie numai istoricul DEMO verificat.

## Implementare
- `profitValidationDemo561.ts`: funcție pură de analiză a unui registru de ordine CLOSED și verificare a regulilor de risc.
- `profitValidationDemo561.test.mjs`: teste de payout, prag statistic, WIN/LOSS, ordine consecutive, duplicări, miză fixă și fail-closed.
- `.github/workflows/scalp-atlas-561-profit-validation.yml`: testare automatizată GitHub.
- Modulul este **neconectat la broker și neconectat la APK**. Nu trimite comenzi BUY/SELL, nu controlează Bluetooth și nu modifică execuția DEMO 560 deja instalată.

## Nu confundăm cu strategia veche
În octombrie, o serie bună de tranzacții manuale a folosit și **expirare de 10 minute**. Acele rezultate nu pot fi transferate automat la această variantă M5 / expirare 5 minute. Scopul este să avem date noi înainte să alegem dacă păstrăm sau respingem strategia.

## Următorul pas tehnic
Un adaptor **read-only** pentru rezultatele verificate „Închis” ale QT DEMO și asocierea lor cu jurnalul semnalelor MINMAX_560, urmat de testarea pe Motorola. Nu implementăm execuție automată a noii reguli sau mărirea mizei până când datele o justifică și brokerul/Android sunt verificate.
