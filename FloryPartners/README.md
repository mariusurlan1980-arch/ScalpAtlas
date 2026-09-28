# Flory Partners

Portal separat pentru florăriile partenere Flory Flowers.

## Flux
Comandă nouă → Acceptată / Refuzată → În pregătire → Pregătită + fotografie → În livrare → Livrată.

## Starea actuală
Frontend funcțional de demonstrație. Datele sunt salvate local doar pentru test. Nu este încă potrivit pentru comenzi reale între mai mulți floriști.

Cont demo:
- Email: partner@floryflowers.demo
- Cod: FLORY2026

## Integrarea de producție
Pentru utilizare reală, frontendul va fi conectat la un backend gratuit cu:
- autentificare separată pentru fiecare florist;
- tabel partners;
- tabel orders;
- tabel order_events;
- stocare fotografii;
- reguli prin care un florist vede doar comenzile proprii;
- webhook Shopify pentru comenzi plătite;
- evenimente Resend la fiecare schimbare de status.

## Comision
Exemplul demo folosește 75% pentru florist și 25% pentru Flory Flowers. Procentul trebuie salvat per partener și poate fi schimbat ulterior prin contract.
