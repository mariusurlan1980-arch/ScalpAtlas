# Scalp Atlas 558 — strategie DEMO: 1,5 lumânări M5 cu retragere

## Regula propusă
1. Prima lumânare M5 trebuie să fie complet închisă.
2. A doua lumânare M5 trebuie să aibă aceeași culoare ca prima la momentul evaluării.
3. Nu se analizează intrarea mai devreme de 50% din durata celei de-a doua lumânări (2 min 30 sec).
4. În lumânarea a doua trebuie să existe dovezi LIVE ale unei retrageri împotriva direcției inițiale, urmată de o revenire parțială.
5. Evităm intrarea la extremul anterior; maximum un semnal pentru fiecare lumânare a doua.
6. BUY pentru două lumânări verzi; SELL simetric pentru două lumânări roșii.

**Atenție:** 50% reprezintă durata scursă, nu procentul retragerii prețului.

## Statut
- S-a adăugat exclusiv detectorul de semnal `oneHalfCandleM5.ts` și testele independente `oneHalfCandleM5.test.mjs`.
- La test local cu Node 22.16, au trecut 12 din 12 teste de logică.
- Nu s-au modificat execuția DEMO, rotația, bipul, modul REAL sau Bluetooth.
- Detectorul NU este conectat la un flux live de cotații și NU este un APK instalabil.
- Pragul minim al retragerii este obligatoriu și trebuie calibrat pe pereche; valoarea 0.0003 din teste este doar un exemplu sintetic, nu setare de tranzacționare.
- Faptul că semnalul apare după 2:30 nu garantează o tranzacție favorabilă.

## Pași ulteriori
- Definirea și validarea criteriului minim de retragere pe cotații reale DEMO.
- Integrarea într-un flux de date LIVE M5 sigur, fără să se modifice versiunea instalată până la validare.
- Rulare paper trading și măsurarea rezultatului pe un eșantion, înainte de orice auto-execuție.
- Confirmare separată a funcționalității pe Motorola.
