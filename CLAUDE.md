Project rules for all agents: @AGENTS.md

<!-- BEGIN @przeprogramowani/10x-cli -->

## Zestaw narzędzi AI 10xDevs — Moduł 5, Lekcja 4 (Wspólny rejestr AI)

Dystrybuuj umiejętności zespołu, prompty i reguły jako wersjonowany pakiet w rejestrze, który Twoja organizacja już posiada. GitHub Packages to domyślna ścieżka; AWS CodeArtifact z Terraform to opcjonalna ścieżka zarządzanej infrastruktury.

```
m5l4-shared-* -> m5l4-github-packages-spec-* + config templates -> publish -> npm install in consumer repos
```

### Router zadań — od czego zacząć

| Umiejętność / prompt / szablon | Użyj, gdy |
| --- | --- |
| `m5l4-shared-conventions`, `m5l4-shared-spec-skill` (prompty) | Definiujesz pierwszą wspólną umiejętność zespołu i jej konwencje. |
| `m5l4-github-packages-spec-pack`, `m5l4-github-packages-spec-cicd` (prompty) + `m5l4-github-packages-*.template` | Tworzysz domyślny pakiet: package.json, instalator i deinstalator, konsumencki `.npmrc`, początkowy `rules/CLAUDE.md` oraz workflow publikowania. |
| `/pack-init` -> `/tf-registry` -> `/setup-cicd` | Opcjonalna ścieżka CodeArtifact: utwórz szkielet pakietu, skonfiguruj rejestr za pomocą Terraform, a następnie dodaj CI/CD. Odczytują specyfikacje `m5l4-*` z katalogu promptów Twojego narzędzia. |

### Twarde reguły

- **Nigdy nie nadpisuj tego, co napisał konsument.** Instalatory modyfikują tylko pliki, które śledzą w swoim manifeście, i wyłącznie tekst między ich znacznikami sentinelowymi.
- **Deinstalacja usuwa dokładnie to, co dodała instalacja**, używając manifestu.
- **Publikuj wyłącznie nową wersję.** Zwiększ wersję przed publikacją; rejestr odrzuca wersję, która już istnieje.
- **Tokeny pozostają w sekretach CI lub lokalnym env**, nigdy w zatwierdzonym `.npmrc`.

<!-- END @przeprogramowani/10x-cli -->
