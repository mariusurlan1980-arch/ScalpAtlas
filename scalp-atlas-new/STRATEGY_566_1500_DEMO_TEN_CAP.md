# Scalp Atlas 566 — QT DEMO, +1 USD pe serie cu WIN; maximum 10 încercări sau STOP la sold insuficient

## Cerință
Buget **planificat** $1,500 în QT DEMO; după LOSS confirmat de broker se pregătește și se recitește miza următoare. Dacă brokerul confirmă WIN, se consideră seria încheiată și se revine la **$1.09** pentru seria următoare. Nu oprim automat după 3 LOSS; noul plafon teoretic este **10 trade-uri pe serie**, dar dacă miza următoare depășește bugetul planificat sau soldul real citit din broker, ne oprim **înainte** de ordin.

**Important:** 10 niveluri care recuperează toate pierderile și aduc +$1 net pe un WIN cer **$1,572.44**, nu $1,500. Cu $1,500 sunt finanțate numai PRIMELE 9 niveluri: total LOSS până la #9 = $752.94, sold rămas = $747.06, însă #10 necesită $819.50. Diferență = **$72.44**. Deci după 9 LOSS oprește fără al zecelea ordin. Dacă WIN apare pe oricare din nivelurile 1–9, un payout de 92% ar trebui să recupereze seria și să lase +$1.00 net, numai dacă mizele/închiderile sunt acceptate exact.

## Mize (cumul de pierderi după fiecare LOSS)
| Nivel | Miză USD | Total pierdere potențială USD |
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
| 10 | 819.50 | 1,572.44 (nu este permis cu $1,500 alocați) |

## Implementarea 566
- `.github/native-overlay/DemoAutoStakePlan565.kt`: păstrează numele clasei 565 pentru compatibilitate, dar folosește plafon planificat **150000 cenți**, **maximum 10 pierderi** și refuză pregătirea oricărei mize ce ar depăși soldul alocat. Un WIN confirmat readuce nivelul 1.
- `.github/native-overlay/DemoStakeEditor.kt`: editare DEMO prin `ACTION_SET_TEXT`, limită tehnică de $819.50, verificare QT Demo, payout 92%, sold broker suficient, aceeași pereche și recitirea exactă a câmpului după modificare. Extinderea limitei de cod nu dovedește că interfața brokerului acceptă sumele mari.
- `.github/native-overlay/TouchTestService.kt`: citire și preflight al sumelor DEMO mai mari, fără cont REAL.
- `.github/native-overlay/ScalpOverlayService.kt`: control opt-in `MIZĂ AUTO DEMO • ON/OFF`, setare miză numai după dovadă **CLOSED 2/2 + EMPTY OPEN 2/2** pentru același ordin; reintrare automată în starea de armare numai după citirea exactă a mizei noi și cu LIVE încă activ, pentru un **semnal nou**, nu repetarea celui vechi.
- `.github/scripts/test_566_balance_risk.mjs`: verificări de riscuri, buget, cap de 10, revenire după WIN, confirmări și preflight.

## Limite și risc
1. Nu se confirmă că soldul $1,500 este deja în broker: este suma **planificată**. Sursa de sold în timpul editării este UI QT DEMO, nu mesajul utilizatorului.
2. Operația din aplicație poate eșua în condiții reale pe Motorola, dacă brokerul nu expune câmpul editabil, limita sa diferă sau are OCR ambiguu. În acest caz nu se modifică miza și nu se lansează ordinul.
3. Modelul optic 560 MIN/MAX este **preview**: nu a devenit un declanșator automat. Executarea tradițională DEMO rămâne supusă tuturor filtrelor de payout, stare și semnal confirmat.
4. Dacă un LOSS/WIN nu este verificat prin detaliile individuale ale tranzacției închise, nu creștem miza și nu reluăm seria. Un timer de 5 minute sau un bip nu reprezintă dovadă.
5. Programarea pe QT DEMO nu poate garanta +$1 pe serie; o serie de pierderi consumă fondurile alocate, iar Martingale amplifică riscul.
6. Nu este autorizată tranzacționarea REAL. Testele GitHub nu echivalează cu un test în broker pe Motorola.

## Următorul test real
Pe Motorola G24, în QT DEMO, verificăm întâi afișajul `MIZĂ AUTO DEMO`, suma inițială $1.09, apoi o închidere verificată și suma următoare. Nu se pornește pe REAL. Se păstrează pachetul anterior dacă APK-ul 566 nu este publicat cu semnătură validă.
