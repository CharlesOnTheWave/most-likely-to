---
change_id: live-sync-spike
title: Live sync spike
status: impl_reviewed
created: 2026-09-27
updated: 2026-10-04
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- 2026-10-04, faza 3: darmowy Supabase uśpił projekt po 7 dniach bez ruchu (ostatni smoke 2026-09-27). Objaw: wyspa „rozłączono”, `CHANNEL_ERROR: transport failure`; host `<ref>.supabase.co` nie istniał w DNS (router, 1.1.1.1, 8.8.8.8), więc padało też logowanie w produkcyjnej grze. Karol przywrócił projekt w panelu; Realtime odpowiadał kilka minut po DNS i Auth. Ryzyko nr 1 z `infrastructure.md` potwierdzone; decyzja o usypianiu (pytanie 9 roadmapy) przed pierwszym wieczorem gry.
