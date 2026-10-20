---
change_id: guest-vote-flow-analysis
title: Analiza przepływu gościa od linku do głosu
status: preparing
created: 2026-10-20
updated: 2026-10-20
archived_at: null
---

## Notes

Analiza przepływu gościa od linku do głosu: jak gość z /j/<token> dostaje tożsamość gracza (nick + sekret) i jak ta tożsamość wraca przy głosie; start od src/pages/j/[token].astro i src/lib/rooms/server.ts, bo mapa wskazała tu strefę ryzyka 2 (pokój + wejście gościa) i obserwację „runda”; wejście do planu S-04 (powrót po odświeżeniu). Tylko badanie, bez zmian w kodzie.
