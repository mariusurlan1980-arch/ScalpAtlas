# Scalp Atlas 558 — strategie DEMO: 1,5 lumânări M5 cu retragere

## Regula propusă
1. Prima lumânare M5 trebuie să fie complet închisă.
2. A doua lumânare M5 trebuie să aibă aceeași culoare ca prima la momentul evaluării.
3. Nu se analizează intrarea mai devreme de 50% din durata celei de-a doua lumânări (2 min 30 sec).
4. Retragere **simbolică**: minim un pas valid de cotație (*1 tick*) în direcția opusă, apoi revenire parțială observată LIVE. Pasul trebuie verificat pentru perechea analizată (nu este universal).
5. Evităm intrarea la extremul anterior; maximum un semnal pentru fiecare lumânare a doua.
6. BUY pentru două lumânări verzi; SELL simetric pentru două lumânări roșii.

**Atenție:** 50% reprezintă durata scursă, nu procentul retragerii prețului. Pentru că semnalul nu se emite când prețul revine chiar la maximul/minimul anterior, o retragere de exact un tick poate să nu fie suficientă pentru a produce un semnal, chiar dacă este pragul minim.

## Statut
- S-a adăugat exclusiv detectorul de semnal `oneHalfCandleM5.ts` și testele independente `oneHalfCandleM5.test.mjs`.
- La versiunea anterioară au fost raportate 12 teste de logică. Testele au fost extinse la 15 pentru condiția «retragere simbolică»; rezultatul rulării noi trebuie confirmat.
- Nu s-au modificat execuția DEMO, rotația, bipul, modul REAL sau Bluetooth.
- Detectorul NU este conectat la un flux live de cotații și NU este un APK instalabil.
- Detectorul folosește acum `priceTickSize`: pasul minim al cotei furnizat/verificat separat pentru fiecare pereche. În testele sintetice se utilizează 0.0001 doar pentru exemplificare; nu este valoare stabilită pentru broker sau un parametru global.
- Faptul că semnalul apare după 2:30 nu garantează o tranzacție favorabilă.

## Pași ulteriori
- Definirea și validarea criteriului minim de retragere pe cotații reale DEMO.
- Integrarea într-un flux de date LIVE M5 sigur, fără să se modifice versiunea instalată până la validare.
- Rulare paper trading și măsurarea rezultatului pe un eșantion, înainte de orice auto-execuție.
- Confirmare separată a funcționalității pe Motorola.
