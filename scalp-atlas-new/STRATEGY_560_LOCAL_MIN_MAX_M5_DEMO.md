# Scalp Atlas 560 — întoarcere din MINIM / MAXIM local, apoi două M5 de aceeași culoare

## Cerința stabilită
- **BUY:** piața ajunge într-un **minim local observat**; prima lumânare M5 se închide **verde** și confirmă întoarcerea de la o lumânare anterioară roșie; a doua lumânare M5 rămâne **verde** și are o retragere mică urmată de o revenire parțială. Abia atunci rezultă un candidat BUY.
- **SELL:** simetric, la un **maxim local observat**; prima lumânare M5 se închide **roșie**, după una verde; a doua lumânare M5 rămâne **roșie** și realizează o mică retragere și revenire. Rezultă un candidat SELL.
- **FĂRĂ regula de 2:30** — semnalul apare în lumânarea 2 după ce condițiile sunt îndeplinite, nu la un minut fix.
- Maximum un candidat pentru aceeași pereche și aceeași a doua lumânare.

## Definiția implementată a MIN/MAX
- Extremul este **local**, nu maximul sau minimul absolut. Detectorul folosește ultimele **trei lumânări M5 complet închise dinaintea lumânării 1**, plus lumânarea 1 închisă, și date LIVE din lumânarea 2.
- BUY dacă minimul (wick low) lumânării 1 este cel puțin la fel de jos ca cele trei minime anterioare; SELL dacă maximul (wick high) al lumânării 1 este cel puțin la fel de sus ca cele trei maxime anterioare.
- Lumânarea dinaintea primei trebuie să fie de culoare opusă, pentru a distinge o întoarcere de continuarea unui trend.
- Retragerea simbolică este un pas de cotație valid pentru instrument, urmat de o revenire parțială observată cronologic; nu se emite semnal direct la vechiul maxim/minim al lumânării 2.
- Culoarea celei de-a doua lumânări este cea **din momentul evaluării**, nu o presupunere despre închiderea ei.

## Implementare și limitări
- `scalp-atlas-new/localReversalM5_560.ts` — logică pură pentru cotații și lumânări OHLC M5 verificate; emite **doar candidat DEMO**, nu ordin.
- `scalp-atlas-new/localReversalM5_560.test.mjs` — teste de BUY/SELL, culori, min/max, cotații întârziate, de-duplicare.
- `scalp-atlas-new/shockNativeEngine.ts` — doar un **indiciu optic** de minim/maxim calculat din corpuri de lumânare vizibile. Nu pretinde că a citit valorile wick high/low ale pieței.
- `.github/native-overlay/ScalpOverlayService.kt` — afișează „TEST FĂRĂ ORDIN” sau așteptarea minimului/maximului; nu transformă indiciul optic în ordin.
- `.github/scripts/test_560_visual_extrema.mjs` — verificări ale indiciului optic și ale izolării de execuția ordinelor.
- În cont REAL, nici acest modul, nici indiciul optic nu trebuie să execute BUY/SELL.

### Ce mai lipsește pentru o tranzacție automată în QT DEMO
1. Sursă autorizată și verificată de valori M5 OHLC (inclusiv **high** și **low**, nu numai culoarea sau pixelii) și cotații din aceeași pereche.
2. Conectarea noului detector la fluxul Android, cu confirmare a perechii și a contului QT DEMO.
3. Test pe cotații reale/sesiune demonstrativă, validarea minimului/maximului și a intrării; fără utilizarea unei mișcări de preț neconfirmate.
4. Abia după verificare, integrarea cu mecanismul existent de **o singură tranzacție activă**, payout 92%, expirare 5 minute, stare verificată de ordin; fără relaxarea protecțiilor împotriva tranzacțiilor duplicate.

**Nu este încă un APK 560 instalabil.** Versiunea 559 existentă rămâne neschimbată; niciun test logic nu dovedește rentabilitatea strategiei.
