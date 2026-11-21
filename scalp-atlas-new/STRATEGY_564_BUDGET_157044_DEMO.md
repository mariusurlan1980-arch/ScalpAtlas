# Scalp Atlas 564 — buget planificat QT DEMO 1.570,44 USD

## Solicitare
Utilizatorul intenționează să aloce **1.570,44 USD** contului QT DEMO și dorește ca, în eventualitatea unui **LOSS închis și confirmat de broker**, să se modifice automat câmpul de miză pentru următorul trade. Scopul este **+1 USD net pe o serie Martingale terminată cu WIN**, nu +1 USD garantat la fiecare trade.

**IMPORTANT:** suma comunicată este **buget planificat**, nu sold citit/verificat din broker. Codul nu a creditat contul și nu cunoaște soldul real actual din QT DEMO.

## Calcul matematic exact, payout 92%
| Nivel | Miză USD | Pierdere cumulată dacă pierde USD |
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
| 10 | 819,50 | 1.572,44 |

Pentru toate cele 10 niveluri este nevoie matematic de **1.572,44 USD**, adică **2,00 USD peste** bugetul planificat. După 9 LOSS: pierdere 752,94 USD; rămân **817,50 USD**, mai puțin decât ultima miză necesară de **819,50 USD**. Dacă s-ar risca tot restul și acesta ar câștiga, profitul brut 92% ar fi 752,10 USD, ceea ce ar lăsa totuși **−0,84 USD net** pe serie, nu +1 USD.

## Ce s-a implementat
- `allocatedBudgetAfterLoss564.ts`: logică separată de buget / citire intenție financiară (nu sold broker) și citare miza următoare după pierderi confirmate.
- `allocatedBudgetAfterLoss564.test.mjs`: teste ale bugetului de 1.570,44 USD, deficitului exact de 2 USD, mizelor după LOSS, opririi la 3 pierderi și imposibilității de a edita automat / trimite ordine din acest modul.
- `.github/native-overlay/DemoLossStakeEditor563.kt`: am introdus `ALLOCATED_DEMO_BUDGET_CENTS_564 = 157044L` ca **limită de risc planificată** pentru editorul experimental; suma nu autorizează plasarea vreunui ordin și nu ține loc de verificarea soldului efectiv.
- Acțiune automată CI în `.github/workflows/scalp-atlas-564-budget-tests.yml`.

## Limitări active
1. **Nu există APK 564**, nici integrarea automată în aplicația deja instalată pe Motorola.
2. Editorul nativ existent acceptă numai mize între **1,00 și 39,64 USD**, nu nivelurile 6–10.
3. Politica de risc 561 / 563 oprește seria **după trei LOSS consecutive**. În această etapă nu se dezactivează această protecție.
4. Editorul nativ poate modifica un câmp numai dacă găsește un **QT DEMO confirmat**, payout exact 92%, aceeași pereche, câmpul unic Sumă și sold disponibil **citit din broker**; rezultatul trebuie recitit după editare.
5. O modificare a mizei nu înseamnă plasarea unui trade. În special, niciun număr de secunde, bip sau gest Android nu este suficient pentru a confirma un LOSS. Sunt necesare identități OPEN/CLOSED potrivite și zero poziții active confirmate.

## Pasul următor
Un adaptor verificabil al recepțiilor brokerului pentru LOSS, cu control explicit al utilizatorului în QT DEMO, test real de setare a sumei pe Motorola, apoi validarea separată a nivelurilor. Nu modifica pe cont REAL și nu promite profit.
