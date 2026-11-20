# Scalp Atlas 559 — două lumânări M5 de aceeași culoare + retragere mică

## Regula nouă aleasă
1. Lumânarea 1 este M5 și **complet închisă**.
2. Lumânarea 2 este M5, consecutivă și are **aceeași culoare în momentul semnalului**. Nu trebuie așteptată închiderea ei.
3. Căutăm o deplasare în direcția lumânării 1, **retragere mică** în sens opus (minimum un pas valid al cotației pentru pereche), apoi revenire parțială demonstrată de prețurile observate LIVE, nu de o singură fotografie.
4. **FĂRĂ cronometru de 2 minute și 30 secunde:** semnalul poate apărea înainte sau după acest reper, numai când secvența s-a produs și datele sunt valide.
5. BUY = prima verde + a doua verde + mică retragere și revenire. SELL = prima roșie + a doua roșie + mică retragere și revenire.
6. Nu emitem semnal în momentul unui maxim/minim atins anterior; maximum un semnal per pereche și a doua lumânare.
7. Pasul de cotare `priceTickSize` se verifică pentru fiecare pereche. Un singur tick de retragere nu garantează un semnal: pentru revenirea **parțială**, pot fi necesari cel puțin doi pași de retragere la un instrument cu cotații discretizate.

## Fișiere modificate separat pe branch
- `scalp-atlas-new/oneHalfCandleM5.ts` — eliminată condiția `elapsedPercent < 50`; calculul progresului timpului a rămas doar informativ.
- `scalp-atlas-new/oneHalfM5LiveFeed.ts` — mesajul de semnal a fost actualizat, păstrând protecțiile pentru sursa LIVE, timeframe, schimbarea perechii, duplicate și cotații vechi.
- Testele existente au fost modificate și extinse: `oneHalfCandleM5.test.mjs` (19 teste) și `oneHalfM5LiveFeed.test.mjs` (16 teste).

## Limite și activare
Aceasta este o **strategie experimentală DEMO**. Codul nu este conectat la fluxul real de cotații al brokerului și nu poate plasa ordine în aplicația Pocket Option. Nu s-a produs un APK 559; versiunea instalată pe Motorola rămâne intactă. Activarea trebuie precedată de verificarea provenienței cotațiilor, teste cu date DEMO și verificarea dispozitivului.

Nici două lumânări de aceeași culoare, nici o retragere mică nu garantează direcția viitoare sau un profit.
