# Archive SHA repoint — keep-supabase-awake

## 2026-10-24

- **Target**: `origin/main` @ `36e3a25911abd94f0a4ae15accb4ab8e6e05957e` (fetched fresh; `git ls-remote --symref origin HEAD` → `refs/heads/main`)
- **Implementation PR**: https://github.com/CharlesOnTheWave/most-likely-to/pull/13 (merged into `main`); integration commit `5e2ace6` "Merge pull request #13 from CharlesOnTheWave/keep-supabase-awake"
- **Problem**: the Progress SHAs were recorded before the 2026-10-22 history rewrite (`context/deployment/history-rewrite-2026-10-22.md`); none of the old commits is in the target history.
- **Evidence**: the rewrite map pairs each old SHA with a new one (lines 203–205); subjects are identical; `git patch-id --stable` matches for both phase commits; both merge commits change the same 14 files (+854/−50); every new SHA is an ancestor of the target snapshot.
- **Scope**: phases 1–3 of this plan (script, workflow, ask rules, documents, PR #13). Row 3.4 has no SHA and stays unchanged.
- **Decision**: Karol chose "Zaktualizuj i archiwizuj" (Update and archive) on 2026-10-24.

| Row ID                  | Old suffix (resolved OID)                              | New SHA   |
| ----------------------- | ------------------------------------------------------ | --------- |
| 1.1, 1.2, 1.3, 1.4, 1.5 | `c5dac7f` (`c5dac7f01e48876d037d615cc457a90becb5e4b4`) | `2c692e4` |
| 2.1, 2.2, 2.3           | `fa36dcd` (`fa36dcd0f2a4ea3bd86e8f1b2228a5c44b3ecb10`) | `e6fbec3` |
| 3.1, 3.2, 3.3, 3.5, 3.6 | `8a5e6a2` (`8a5e6a2b661994ffd528e750a04d3bf7d76e74a1`) | `5e2ace6` |

Rows repointed: 13.
