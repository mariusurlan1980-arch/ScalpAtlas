# Scalp Atlas 557 — pregătire REAL + Fingerbot Touch Bluetooth

**Statut:** numai bază logică; nu există încă un driver BLE, instalare pe Motorola sau test fizic.

## Scop
- Păstrează separat calea QT Demo existentă. Niciun fișier existent de execuție DEMO nu este schimbat.
- Semnal REAL: M5, BUY/SELL, payout minim 92%, o singură poziție activă.
- Semnalul nu declanșează nicio acțiune fizică automat. Este obligatorie aprobarea utilizatorului pentru fiecare semnal și permisiunea brokerului pentru actuatoare externe.
- Înainte de o comandă BLE este necesară verificarea perechii Bluetooth, a modelului cu două canale capacitive și a calibrării canalelor A (BUY) și B (SELL).
- Semnalul are valabilitate limitată la 8 secunde; după aceea trebuie anulat.
- Pregătirea intenției nu înseamnă că brokerul a primit un ordin: starea ordinului trebuie verificată separat.

## Implementat și testat
- `realTradeBluetoothGate.ts`: funcție pură de validare care poate doar pregăti o intenție de apăsare, fără să apeleze Bluetooth.
- `realTradeBluetoothGate.test.mjs`: 10 teste de reguli și blocaje.
- Test local: `node --experimental-strip-types --test scalp-atlas-new/realTradeBluetoothGate.test.mjs` (Node 22.16.0). Toate cele 10 teste au trecut înainte de commit.

## De realizat după identificarea hardware-ului
1. Identificarea exactă a dispozitivului (model/firmware); într-o reclamă AliExpress nu apare dovada compatibilității protocolului.
2. Verificarea poziționării a două contacte capacitive și funcționarea lor pe un ecran de test, nu în cont REAL.
3. Conectarea unui driver Android Bluetooth LE corespunzător modelului.
4. Interfață care arată semnalul REAL și cere confirmare pentru fiecare apăsare.
5. Validarea în QT Demo, re-verificarea sesiunii/brokerului și protecție la comenzi repetate.
6. Solicitarea aprobării brokerului înaintea oricărei execuții REAL prin hardware.

**Atenție:** Termenii Pocket Option prevăd posibilitatea anulării/revizuirii ordinelor executate cu software bot neautorizat. Dispozitivul fizic nu este dovadă de conformitate. Acest branch nu execută tranzacții.
