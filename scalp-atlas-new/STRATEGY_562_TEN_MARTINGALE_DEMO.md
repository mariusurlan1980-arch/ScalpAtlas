# Scalp Atlas 562 — Martingale cu țintă +1 USD pe serie, maxim 10 trade-uri, QT DEMO

## Ce înseamnă exact obiectivul
La payout 92% constant, un WIN la o miză `s` produce `0.92 × s` profit, din care se scad **toate pierderile precedente din aceeași serie**. Un plan Martingale poate urmări **+1 USD la prima victorie din serie**, nu +1 USD garantat la fiecare trade. După fiecare WIN seria se resetează la primul nivel.

## Tabel de risc (mize rotunjite în sus la cent)
| Nivel | Miză USD | Pierderi cumulate dacă nivelul pierde USD |
|---:|---:|---:|
| 1 | 1.09 | 1.09 |
| 2 | 2.28 | 3.37 |
| 3 | 4.75 | 8.12 |
| 4 | 9.92 | 18.04 |
| 5 | 20.70 | 38.74 |
| 6 | 43.20 | 81.94 |
| 7 | 90.16 | 172.10 |
| 8 | 188.16 | 360.26 |
| 9 | 392.68 | 752.94 |
| 10 | 819.50 | 1572.44 |

**Sold necesar teoretic:** 1,572.44 USD pentru zece LOSS consecutive. Un WIN la ultimul nivel ar acoperi exact 752.94 USD pierdute anterior și ar realiza 1.00 USD net (la 92% payout și înainte de orice cost suplimentar). **Zece LOSS = −1,572.44 USD.**

## Siguranță și compatibilitate
- `martingaleTenDemo562.ts` este un **simulator de mize, nu un executor**.
- Teste numai pe `QT DEMO`, payout **exact** 92%, 5 minute și cel mult o poziție deschisă, conform proiectului de bază.
- Proiectul 561 încă impune în faza de evaluare **pauză după trei LOSS sau pierdere netă 5 USD**. Simulatorul 562 nu dezactivează aceste protecții. Pentru a ajunge în practică la toate cele zece niveluri ar fi necesară o decizie separată privind riscurile; nu facem această schimbare automat.
- Afișajul soldului folosește un snapshot **citit de la broker în mod read-only**, cont DEMO, verificat în ultimele 15 secunde. Dacă lipsește, este vechi, din cont REAL, cu payout diferit sau doar introdus manual, arată sold **neconfirmat**.
- Calculatorul indică soldul minim, deficitul și câte niveluri succesive ar fi finanțate matematic. Aceasta nu dovedește că brokerul va accepta miza maximă, incrementul de un cent sau payout-ul la toate perechile.
- Nu modifică niciun modul de accesibilitate, ordine, rotire FX, bip, Android, sold sau Martingale REAL.
- `simulateMartingaleSeries562` acceptă exclusiv rezultate deja decontate, marcate WIN/LOSS/DRAW. Doar o verificare separată a închiderii în broker le poate furniza legitim.

## Status
- Cod și teste în `scalp-atlas-new/martingaleTenDemo562.ts` și `martingaleTenDemo562.test.mjs`.
- Workflow în `.github/workflows/scalp-atlas-562-martingale-demo.yml`.
- Nu există încă un APK 562; versiunea 560 instalabilă rămâne independentă.
- **Niciun randament sau WIN nu poate fi garantat** de Martingale. Mărirea mizei după LOSS amplifică rapid riscul și poate depăși limitele brokerului.
