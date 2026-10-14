# SCALP ATLAS LIVE ALERT — protocol de verificare Motorola G24

## Scop
Aplicație separată, fără tranzacționare automată: captează ecranul cu acordul proprietarului și suprapune alerta sonoră/vizuală BUY sau SELL. Un semnal nu garantează rezultat pozitiv.

## Prima verificare
1. Instalează APK-ul numai după o compilare GitHub Actions cu rezultat SUCCESS și semnătură verificată.
2. Deschide SCALP ATLAS LIVE ALERT, acordă „Afișare peste alte aplicații”, apoi pornește „SUPRAPUNERE LIVE”.
3. Acceptă dialogul Android de capturare a ecranului pentru acea sesiune.
4. Deschide un grafic de broker disponibil pentru captură. În Android 14, selectarea ferestrei individuale poate afișa o imagine diferită de captura întregului ecran.
5. Verifică panoul: Cadre crește, Rez crește, Erori rămâne mic. Panoul nu trebuie să clipească sau să dispară.
6. Selectează M5/M10/M15 identic cu graficul afișat. Selectează poziția GRAFIC 1/3, 2/3 ori 3/3 astfel încât lumânările să fie în decupaj.
7. Verifică dacă la lipsa graficului sau la captură protejată rămâne AȘTEAPTĂ și nu sună semnalul.
8. Confirmă că bipul BUY este distinct de SELL și că nu se aud semnale contradictorii la intervale scurte.
9. Compară fiecare alertă cu graficul real și notează întârzierile; nu folosi inițial bani reali.

## Criterii de acceptare înainte de utilizare
- Cel puțin 30 minute de suprapunere stabilă fără blocare sau clipire.
- Fără alerte când imaginea este blocată sau neclară.
- Fără dublarea bipului pentru aceeași decizie.
- Simbolul și timeframe-ul corecte; dacă detectarea automată lipsește, sunt introduse manual.
- 100 de alerte urmărite și înregistrate cu oră, simbol, direcție, interval, preț și rezultat; datele trebuie să arate performanța, nu un scor teoretic.
- Nu sunt apăsate butoanele BUY/SELL în broker.

## Limitări cunoscute în starea actuală
- Nu este compatibilitate demonstrată cu toți brokerii; aplicațiile care protejează ecranul pot refuza capturarea.
- Scorul vizual al algoritmului nu este o probabilitate statistică demonstrată.
- Nu există, în acest moment, verificare pe dispozitiv real ori certificarea acurateței motorului.
- Repo-ul GitHub este public. Nu include chei, parole sau strategii comerciale confidențiale.

## Testare și diagnostic
Păstrează capturi ale erorilor panoului și numărătoarea Cadre / Rez / Erori. Oprirea capturii Android trebuie să oprească serviciul. Nu șterge aplicația veche SCALP ATLAS.
