# Inventaire de test : KOM-25, Créer une CI · backend (PROD)

Ticket de CI (GitHub Actions) sans logique dans `src/`. Chaque critère porte sur le comportement réel de GitHub Actions, de pnpm, des scripts du repo ou de la protection de branche sur `dev`. Aucun n'a de code à nous à isoler et mocker : un test unitaire mockerait exactement ce qu'on veut vérifier. Les vérifications se font à la main, en ouvrant des PR de test vers `dev` et en lisant le résultat du check `ci` et l'état du bouton de merge.

### 1. Déclenchement

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA1 | Une PR ouverte ou mise à jour vers `dev` lance la CI automatiquement | 🔴 | C'est GitHub Actions qui lit le déclencheur `pull_request` sur `dev` et lance le workflow. Aucune fonction à nous à tester. | Manuel (smoke) : ouvrir une PR vers `dev`, puis pousser un commit dessus, et constater 2 exécutions du check `ci` |
| CA2 | La CI en échec bloque le merge de la PR | 🔴 | C'est la protection de branche GitHub (check `ci` requis, `enforce_admins` activé) qui bloque, pas du code du repo | Manuel (smoke) : PR avec une erreur volontaire, constater le check rouge et le bouton de merge bloqué, y compris pour un admin |

### 2. Installation des dépendances

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA3 | `pnpm install --frozen-lockfile` installe les dépendances et échoue si `pnpm-lock.yaml` n'est pas à jour | 🔴 | Le refus d'un lockfile désynchronisé est le comportement réel de pnpm. La contrainte technique sur les build scripts (`esbuild`, `prisma`, `@prisma/engines`, autorisés via `allowBuilds` dans `pnpm-workspace.yaml`) ne se vérifie aussi que sur un vrai runner | Manuel (smoke) : PR qui modifie `package.json` sans mettre à jour le lockfile, constater l'échec à l'étape d'install ; sur une PR saine, constater que l'install passe sans blocage des build scripts |

### 3. Vérifications

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA4 | La CI lance `pnpm lint` et échoue sur une erreur de lint | 🔴 | On vérifie que l'étape est branchée dans le workflow et que son code de sortie fait échouer le job. C'est ESLint et GitHub Actions réels | Manuel (smoke) : PR avec une erreur de lint volontaire (ex. import relatif `./`), constater l'échec à l'étape Lint |
| CA5 | La CI lance `pnpm build` (`prisma generate` puis `tsc`) et échoue si le typecheck ou le build échoue | 🔴 | Comportement réel de Prisma et de `tsc` sur le runner. La contrainte « sans Postgres » (`prisma generate` lit seulement le schéma) ne se confirme que là | Manuel (smoke) : PR avec une erreur de type volontaire, constater l'échec à l'étape Build ; sur une PR saine, constater que `prisma generate` passe sans `DATABASE_URL` |
| CA6 | La CI lance `pnpm test` (Vitest, unitaires seuls, sans base) et échoue si un test échoue | 🔴 | On vérifie que Vitest tourne une fois et sort en `CI=true` et que son échec fait échouer le job. Comportement réel de Vitest et d'Actions | Manuel (smoke) : PR avec un test volontairement cassé, constater l'échec à l'étape Tests et l'absence de blocage en mode watch |

### 4. Résultat

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA7 | Lint, build et tests verts : le check `ci` est vert et le merge est autorisé | 🔴 | Résultat du check et déblocage du merge par la protection de branche GitHub réelle | Manuel (smoke) : PR saine vers `dev`, constater le check `ci` vert et le bouton de merge actif |

## Récap

**Test unitaire automatisé (→ `unit-test-writer`)**

- Aucun.

**Couverture partielle (🟠 : unitaire + smoke manuel)**

- Aucune.

**Vérification manuelle (→ `smoke-test-writer`)**

- CA1 : déclenchement sur ouverture et mise à jour d'une PR vers `dev`.
- CA2 : merge bloqué sur check rouge, admin compris.
- CA3 : échec de l'install sur lockfile désynchronisé, build scripts autorisés.
- CA4 : échec sur erreur de lint.
- CA5 : échec sur erreur de typecheck, `prisma generate` sans base.
- CA6 : échec sur test cassé, Vitest sans mode watch.
- CA7 : check vert et merge autorisé sur PR saine.
