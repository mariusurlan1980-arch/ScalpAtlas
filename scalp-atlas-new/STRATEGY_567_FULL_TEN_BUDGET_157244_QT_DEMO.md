# Scalp Atlas 567 – buget QT DEMO planificat exact 1.572,44 USD, maximum 10 încercări

## Cerința actualizată
Utilizatorul a indicat că dorește **1.572,44 USD în QT DEMO** pentru un plan Martingale care urmărește un profit net de cel puțin **1 USD pe seria încheiată la primul WIN**. Nu putem alimenta contul Pocket Option din GitHub. Suma este **plafonul planificat**, nu dovada soldului din broker. Orice modificare a câmpului de miză trebuie să confirme separat soldul curent din interfața QT DEMO.

## Calcul cu payout exact de 92%
| Încercare | Miză USD | Pierderi cumulate dacă pierde USD |
|---:|---:|---:|
| 1 | 1,09 | 1,09 |
| 2 | 2,28 | 3,37 |
| 3 | 4,75 | 8,12 |
| 4 | 9,92 | 18,04 |
| 5 | 20,70 | 38,74 |
| 6 | 43,20 | 81,94 |
| 7 | 90,16 | 172,10 |
| 8 | 188,16 | 360,26 |
| 9 | 392,68 | 752,94 |
| 10 | 819,50 | **1.572,44** |

- După fiecare LOSS **CLOSED verificat**, următoarea miză este propusă numai dacă este acoperită de buget și soldul brokerului.
- După primul WIN **CLOSED verificat**, seria se închide, iar suma este resetată la 1,09 USD pentru următorul semnal nou.
- După 10 LOSS în aceeași serie, **STOP**: pierdere totală de 1.572,44 USD. Nu există nivel 11.
- Orice necunoaștere a rezultatului (fără ID OPEN/CLOSED verificat, fără 0 OPEN 2/2) blochează ajustarea. Contul REAL rămâne interzis.
- Modul `MIZĂ AUTO DEMO` este opt-in; aplicația nu face automat alimentarea contului.

## Ce s-a modificat în 567
- `.github/native-overlay/DemoAutoStakePlan565.kt`: `PLANNED_BUDGET_CENTS = 157244L` (numele clasei se păstrează pentru a nu rupe integrarea Android), `STOP_AFTER_LOSSES=10`, verificare a sumei pierdute cumulativ și a următoarei mize înainte să permită editarea.
- `.github/native-overlay/DemoStakeEditor.kt` și `TouchTestService.kt`: suport experimental pentru mize QT DEMO până la 819,50 USD; editorul verifică payout 92%, cont, câmp, sold și re-citirea valorii după `ACTION_SET_TEXT`.
- `.github/native-overlay/ScalpOverlayService.kt`: modul opt-in editează suma doar după dovada unei tranzacții închise, apoi poate re-arma doar pe un semnal nou în sesiune LIVE.
- `.github/scripts/test_566_balance_risk.mjs`: verifică atât insuficiența a 1.500 USD, cât și acoperirea aritmetică a tuturor celor zece trepte cu 1.572,44 USD.

## Limitări de verificare
Acestea sunt teste de logică/cod. Nu sunt tranzacții de broker și nu demonstrează că Pocket Option permite oricare dintre mizele mari, că OCR recunoaște corect soldul sau că strategia este profitabilă. Cu zece pierderi consecutive, soldul exact alocat este consumat complet. Martingale nu garantează profit.
