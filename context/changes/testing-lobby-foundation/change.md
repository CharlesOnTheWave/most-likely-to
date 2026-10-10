---
change_id: testing-lobby-foundation
title: Fundament testów i zabezpieczenie lobby (faza 1 planu testów)
status: implementing
created: 2026-10-10
updated: 2026-10-10
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Fundament testów i zabezpieczenie lobby".
Risks covered: #4 (ktoś działa ponad swoją rolę), #6 (gość nie wchodzi do pokoju albo traci nick). Test types planned: unit + integration (DB).
Risk response intent:
- #4: każda rola dostaje odmowę tam, gdzie PRD Access Control jej zabrania (host: przejścia etapów gry, ponowne otwarcie zamkniętego pokoju, wybór kodu linku; gość: działanie w cudzym pokoju albo jako inny gracz), sprawdzane rolą, która nie omija uprawnień.
- #6: identycznie wyglądające nicki (niewidoczne znaki, selektor wariantu emotki) są odrzucane, za długi nick dostaje czytelną odmowę, samo otwarcie linku niczego nie zmienia; oczekiwania pochodzą z listy par nicków i z PRD, nie z funkcji normalizującej.
After creating the folder, follow the downstream continuation rule.
