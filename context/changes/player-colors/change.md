---
change_id: player-colors
title: Stały kolor każdego gracza na kole odsłony i podsumowania
status: implementing
created: 2026-10-25
updated: 2026-10-25
archived_at: null
---

## Notes

Uwaga Karola po grze testowej S-15 (2026-10-25): kolor na kole zależy dziś od miejsca w wyniku (`SLICE_FILLS[index]` w `RoundReveal.tsx` i `GameSummary.tsx`), więc kto ma najwięcej głosów, ten zawsze jest różowy, i co rundę różowy jest ktoś inny; ludzie się mylą.

Decyzja Karola (2026-10-25): wariant A. Gra sama nadaje każdemu graczowi stały kolor na całą grę (np. według miejsca przy stole), pokazuje go kropką przy nicku na liście graczy i używa tego samego koloru na kole każdej odsłony i w podsumowaniu. Odrzucony na teraz wariant B: gracz sam wybiera kolor w poczekalni (nowe pole w bazie, wybór, konflikt dwóch osób chcących ten sam kolor); można go dołożyć później na wierzchu A.

Znane granice: 20 kolorów (`--chart-1` … `--chart-20`), PRD nie ma limitu graczy; przy więcej niż 20 graczach kolory się powtórzą (odsłona i tak pokazuje wtedy same paski). Szary kawałek „pozostali” w podsumowaniu zostaje szary.
