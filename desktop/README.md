# Scalp Atlas pe Windows · monitor QT Demo

Din rădăcina proiectului, cu Node.js 24 instalat, rulează `node desktop/server.mjs`.
Deschide [panoul local](http://localhost:8765) în Chrome sau Edge.

1. Deschide graficele Pocket Option QT Demo în ferestre de browser și așază-le astfel încât toate lumânările să rămână vizibile simultan. Configurează M5 pentru fiecare.
2. În panou apasă **Pornește captura** și partajează ecranul cu graficele. Pentru configurare, ține panoul pe alt ecran sau poziționează-l astfel încât graficul delimitat să fie vizibil.
3. Pentru fiecare dintre cele șase poziții, introdu perechea, selectează numărul poziției și trasează dreptunghiul graficului în previzualizare. Exclude bara brokerului și butoanele de tranzacționare. Redelimitează zona dacă muți sau redimensionezi fereastra.
4. Panoul afișează perechea selectată când există un ȘOC valid în cadre recente. Departajarea folosește retragerea măsurată, apoi revenirea și recența. Procentul arată retragerea lumânării.

Motorul optic este încărcat direct din sursa Android. Panoul menține câte un istoric pentru fiecare zonă și analizează cadrele local. Numele perechii și M5 sunt configurate manual. Versiunea Windows monitorizează și selectează semnale. Conectarea la broker pentru execuție automată necesită verificarea independentă a contului QT Demo, a perechii, a expirării și a stării ordinului.
