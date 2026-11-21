# Scalp Atlas 563 — modificarea mizei din câmpul QT DEMO după LOSS confirmat

## Cerința
După o tranzacție **QT DEMO** închisă și confirmată **LOSS**, Scalp Atlas ar trebui să calculeze noua miză pentru recuperarea pierderii și un obiectiv de **+1 USD net pe seria încheiată cu WIN**. Editarea mizei nu este sinonimă cu autorizarea unei noi tranzacții și **nu garantează obținerea profitului**.

## Ce era implementat deja în Android
- `DemoStakeEditor.kt` recunoaște headerul QT DEMO, câmpul unic **Sumă**, payout-ul 92% pe BUY și SELL și soldul brokerului.
- Folosește `AccessibilityNodeInfo.ACTION_SET_TEXT` numai pe câmpul editabil. Citește apoi din nou valoarea exactă pentru a confirma că brokerul a acceptat suma.
- `TouchTestService.setVerifiedDemoRecoveryStakeOnBroker(pair, stakeCents)` expune intern această editare, cu verificarea perechii curente.
- Editorul acceptă numai **1.00–39.64 USD**. Nu acceptă toate nivelurile unui plan cu 10 trade-uri.

## Ce s-a pregătit în versiunea 563
- `.github/native-overlay/DemoLossStakeEditor563.kt` conține o decizie izolată după un șir de LOSS-uri cu OPEN/CLOSED verificate, ID-uri unice, 0 poziții OPEN în două citiri, cont `QT_DEMO:`, payout **exact 92%**, expirare 5 min, miză anterior deschisă verificată și dovadă recentă.
- Conectarea la editorul existent este disponibilă în funcția `editAfterVerifiedLossOnly`, **dar aceasta NU este apelată de motorul curent**. Nu există un callback Android care să editeze automat după LOSS în APK-ul existent.
- Cu ținta de 1 USD, mizele teoretice sunt 1.09 -> 2.28 -> 4.75 -> 9.92 -> 20.70 -> 43.20 -> ... -> 819.50 USD.
- **STOP de risc 561 la trei pierderi** rămâne obligatoriu în această etapă; funcția 563 poate propune numai 2.28 USD după primul LOSS confirmat de 1.09 USD, apoi 4.75 USD după al doilea LOSS. Nu se continuă dacă apare al treilea LOSS. Nu este o autorizare a seriei de 10 niveluri.
- Nivelurile de la **43.20 USD** în sus sunt oricum incompatibile cu limita actuală a editorului 39.64 USD; chiar cu sold de 1,572.44 USD, nu există garanție că brokerul acceptă acele mize.

## Ce lipsește până la funcționarea automată reală în QT DEMO
1. Un adaptor care identifică și persistă **același ordin** deschis și apoi închis, cu rezultat LOSS/WIN verificat independent; nu deduce LOSS din expirarea cronometrului sau din bip.
2. O confirmare `0 DESCHISE 2/2` încă actuală pe contul DEMO, fără schimbarea perechii și fără semnal/ordin în curs.
3. O opțiune explicită în UI pentru activarea editării de miză DEMO. Nu o activa implicit și nu executa BUY/SELL după editarea câmpului.
4. Verificarea pe Motorola G24 că `Sumă` este identificată și setată exact, urmată de citirea independentă a noii mize din ecranul brokerului.
5. Validare separată a limitelor brokerului și a bugetului; strategia nu trebuie să funcționeze în REAL și nu trebuie să suprascrie oprirea de risc 561 fără o revizuire explicită.

## Status
- Extensia 563 este în GitHub pe o ramură separată.
- Verificările statice ale contractelor de siguranță și ale calculelor au trecut (8/8); **nu sunt teste de execuție pe Motorola și nu demonstrează un LOSS/WIN broker**.
- **Nu există APK 563.** Aplicația 560 instalabilă rămâne neschimbată.
