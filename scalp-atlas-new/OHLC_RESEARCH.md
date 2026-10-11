# SCALP ATLAS — motor OHLC experimental (nu este APK)

Această ramură **nu schimbă interfața veche**, aplicația instalată, overlay-ul sau Bip 1. Introduce numai un motor separat, verificabil pe date numerice OHLC reale și un evaluator istoric. Codul nu este încă conectat la CAMERA LIVE.

## Datele de intrare
Apel: evaluateReversal({ candles, symbol, timeframeMinutes: 10 })

Fiecare lumânare trebuie să aibă:
- time: începutul intervalului în milisecunde UTC, număr întreg
- open / high / low / close: valori numerice reale, valide
- complete: true pentru o lumânare închisă, false numai pentru ultima lumânare aflată în formare

Sunt necesare minimum 15 lumânări închise consecutive pe același simbol și același interval (fără decalaje). Datele pentru OTC Pocket Option trebuie să fie chiar ale instrumentului OTC tranzacționat; OHLC de la un furnizor Forex obișnuit poate avea prețuri diferite și nu trebuie prezentat ca echivalent.

## O singură strategie, nu 70 de etichete
- BUY: fitil inferior lung aproape de minimul ultimelor 12 lumânări, urmat de **două lumânări verzi închise** cu confirmare ascendentă.
- SELL: fitil superior lung aproape de maximul ultimelor 12 lumânări, urmat de **două lumânări roșii închise** cu confirmare descendentă.
- Orice situație ambiguă, lumânare neînchisă, gol de date sau contradicție produce WAIT, fără bip.
- Semnalul nu există până când a doua lumânare de confirmare nu s-a închis. signalId este determinist: un UI viitor poate da **un singur bip lung per ID**.
- probability rămâne null: un procent de încredere fără calibrare pe rezultate reale ar fi înșelător.
- M10: orizont de evaluare de 10 minute (următoarea lumânare), nu promisiune de reușită.

## Verificare și limitări
Rulare locală cu Node 22: node --test scalp-atlas-new/ohlcReversalEngine.test.js

backtestReversals folosește doar lumânările deja închise pentru decizie, prețul de deschidere al lumânării următoare pentru intrare și închiderea aceleia pentru rezultat. TIE este ținut separat și contează nefavorabil în rata conservatoare. Nu sunt modelate latența, execuția, spreadul, slippage-ul, restricțiile sau payout-ul brokerului.

Plan de validare înaintea oricărei integrări de alertă: cel puțin **300 de cazuri istorice**, apoi **200 de semnale Demo**, fiecare jurnalizat cu timestamp, instrument, timeframe și rezultat. Analiza trebuie să fie în afara eșantionului folosit pentru ajustări și raportată separat pentru OTC versus piață obișnuită. O rată de 58–60% observată nu garantează profit: pragul rentabilității depinde de payout și de execuție; se evaluează și intervalele de incertitudine.

Acest motor **nu plasează tranzacții, nu produce APK și nu primește date LIVE** în această ramură. Nu folosiți bani reali pe baza sa.
