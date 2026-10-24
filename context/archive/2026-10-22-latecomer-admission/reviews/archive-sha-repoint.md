# Archive SHA repoint — latecomer-admission

## 2026-10-24

- **Target**: `origin/main` @ `36e3a25911abd94f0a4ae15accb4ab8e6e05957e` (fetched fresh; `refs/heads/main` is the remote's default branch)
- **Implementation PR**: https://github.com/CharlesOnTheWave/most-likely-to/pull/14 (merged into `main`); integration commit `2e2010f` "Merge pull request #14 from CharlesOnTheWave/latecomer-admission"
- **Problem**: the Progress SHAs were recorded before the 2026-10-22 history rewrite (`context/deployment/history-rewrite-2026-10-22.md`); none of the old commits is in the target history.
- **Evidence**: the rewrite map pairs each old SHA with a new one; the subjects are identical. `git patch-id --stable` matches for all five ordinary commits. The merge commits' diffs against their first parents are identical once the removed course files are left out. Every new SHA is an ancestor of the target snapshot.
- **Scope**: phases 1–4 of this plan (migration and db tests, link page and Worker, game screens, deployment). Row 4.4 has no SHA and stays unchanged.
- **Decision**: Karol chose "Zaktualizuj i archiwizuj" (Update and archive) on 2026-10-24.

| Row ID             | Old suffix (resolved OID)                              | New SHA   |
| ------------------ | ------------------------------------------------------ | --------- |
| 1.1, 1.2, 1.3, 1.5 | `682d5a5` (`682d5a5e798e46a16746706f720d13d70045c680`) | `1e3cbca` |
| 1.4                | `75831a4` (`75831a4f260977448ca7dfaa511fe2dd6f067baf`) | `29e18e8` |
| 2.1, 2.2, 2.3, 2.4 | `295beca` (`295beca5527a58be7d2d53e01f3d7b752df32123`) | `140eba3` |
| 3.1, 3.2, 3.3, 3.4 | `d84f144` (`d84f144c41dc45938c9255e10728e6c7ecca476f`) | `9b4ed8f` |
| 4.1                | `5add8c9` (`5add8c98f71d0e784868a22f5e04b8ba4c340b2b`) | `050c14d` |
| 4.2, 4.3           | `2ed1304` (`2ed130428e730f009fdec110826c7b733cf8cbd4`) | `2e2010f` |

Rows repointed: 16.
