# Smokes : KOM-25 « Créer une CI · backend (PROD) »

> **Écrits avant l'implémentation, à exécuter après.** Ces scénarios se jouent à la main une fois le workflow `.github/workflows/ci.yml` et la protection de branche sur `dev` en place (cf. `docs/workflow-ticket-backend.md`). Cocher la case d'un scénario quand son résultat attendu est constaté.

Source : `testing/inventaire-KOM-25.md` (mêmes sections, même ordre), ticket KOM-25 (page Notion), `.github/workflows/ci.yml` (job `ci`, étapes `Run pnpm install --frozen-lockfile`, `Lint`, `Build`, `Tests`), `package.json` (scripts `lint`, `build`, `test`), `pnpm-workspace.yaml` (`allowBuilds`).

Ticket de CI : il n'y a pas d'endpoint. Les scénarios ouvrent des PR de test vers `dev` et lisent le résultat avec `gh`.

## Mise en place commune

**Ouvrir les PR depuis un terminal ordinaire, pas depuis une session Claude Code.** Le hook `.claude/hooks/ci-watch.sh` réagit à tout `gh pr create` lancé par Claude Code : si la CI est rouge, il lance un worker qui la corrige. Il « réparerait » les erreurs volontaires des PR de test.

À faire une fois, depuis la racine de `kommit-backend/`, working tree propre. Outils utilisés : `git`, `gh` (connecté avec un compte admin du repo), `node`, `grep`.

```bash
# Branche qui porte le ci.yml final : les branches de test partent d'elle et visent dev.
# Remplacer par dev si le workflow de dev est déjà celui à tester.
FROM=KOM-25-ci-backend-prod
STAMP=$(date +%s)

# Nom de la branche de test $1 (saine, lint, lockfile, build, tests).
br() { echo "smoke/KOM-25-$1-$STAMP"; }

# Crée la branche de test $1 depuis origin/$FROM et s'y place.
start_branch() { git fetch origin && git switch -c "$(br $1)" "origin/$FROM"; }

# Commit tout, pousse, ouvre la PR vers dev.
open_pr() {
  git add -A && git commit -m "test: smoke KOM-25 ($1)" && git push -u origin HEAD
  gh pr create --base dev --head "$(br $1)" \
    --title "[smoke KOM-25] $1, ne pas merger" --body "PR de test du ticket KOM-25. À fermer sans merger."
}

# Attend la fin du check de la PR $1 (le sleep laisse à GitHub le temps de mettre le run en file).
wait_ci() { sleep 15; gh pr checks "$(br $1)" --watch; }

# Id du dernier run du workflow sur la branche $1.
run_id() { gh run list --branch "$(br $1)" --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId'; }

# Conclusion de chaque étape du job ci, dernier run de la branche $1.
steps() { gh run view "$(run_id $1)" --json jobs --jq '.jobs[] | select(.name=="ci") | .steps[] | "\(.name) : \(.conclusion)"'; }

# État du bouton de merge de la PR $1, vu par GitHub.
merge_state() { gh pr view "$(br $1)" --json mergeStateStatus,reviewDecision --jq '"\(.mergeStateStatus) (review : \(.reviewDecision))"'; }
```

Lecture de `steps` : `success` = étape passée, `failure` = étape en échec, `skipped` = étape non lancée parce qu'une étape précédente a échoué. Chaque PR en erreur est construite pour échouer à une seule étape : l'erreur de type passe le lint, le test cassé passe le lint et le typecheck.

**Ordre d'exécution** : jouer les sections dans l'ordre du fichier, dans le même terminal. CA3, CA5 et CA7 relisent la PR saine ouverte en CA1. CA4 relit la PR `lint` ouverte en CA2.

**Nettoyage** (après le dernier scénario) :

```bash
for N in saine lint lockfile build tests; do gh pr close "$(br $N)" --delete-branch; done
git switch "$FROM"
```

### 1. Déclenchement

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA1 | 🔴 | Une PR ouverte ou mise à jour vers `dev` lance la CI automatiquement | Smoke ci-dessous |
| CA2 | 🔴 | La CI en échec bloque le merge de la PR, y compris pour un admin | Smoke ci-dessous |

#### CA1 : une PR ouverte puis mise à jour vers dev lance 2 fois la CI

> ✅ **Ce qu'on vérifie :**
> - L'ouverture de la PR lance le check `ci`, et un nouveau commit poussé sur la PR le relance.
> - Les runs viennent de l'événement `pull_request` : les 2 `git push` ne lancent aucun run `push` (contrainte du ticket).
> - Testé à la main parce que c'est GitHub Actions qui lit le déclencheur `pull_request` sur `dev` et lance le workflow. Aucune fonction à nous à tester.

**Préconditions** : mise en place commune faite, `$FROM` poussée sur `origin`.

**Étapes**

1. Ouvrir la PR saine (un fichier texte ajouté, aucun code touché) et attendre son check :
   ```bash
   start_branch saine
   echo "smoke KOM-25 $STAMP" > testing/smoke-KOM-25.txt
   open_pr saine
   wait_ci saine
   ```
2. Pousser un 2e commit sur la PR et attendre le nouveau check :
   ```bash
   echo "mise à jour" >> testing/smoke-KOM-25.txt
   git commit -am "test: smoke KOM-25 (mise à jour)" && git push
   wait_ci saine
   ```
3. Lister les runs de la branche et les 2 commits :
   ```bash
   gh run list --branch "$(br saine)" --workflow ci.yml --json event,headSha,conclusion \
     --jq '.[] | "\(.event) \(.headSha[0:7]) \(.conclusion)"'
   git log -2 --format=%h
   ```

**Résultat attendu**

- Étapes 1 et 2 : `gh pr checks` affiche une ligne `ci` qui finit en `pass`.
- Étape 3 : exactement 2 lignes `pull_request <sha> success`, dont les sha sont ceux des 2 commits de `git log`.
  - 1 seule ligne : la mise à jour de la PR ne relance pas la CI (type d'événement restreint dans `on.pull_request`).
  - Aucune ligne, ou `gh pr checks` répond « no checks reported » après plusieurs minutes : le workflow ne se déclenche pas sur une PR vers `dev` (fichier absent de la branche, ou `branches` mal écrit).
  - Une ligne `push` : le workflow se déclenche aussi sur les push, hors périmètre du ticket.

- [ ] CA1 vérifié

---

#### CA2 : une CI rouge bloque le merge, admin compris

> ✅ **Ce qu'on vérifie :**
> - Sur une PR dont le check `ci` est rouge, GitHub refuse le merge : le check `ci` est requis sur `dev`.
> - Le blocage vaut aussi pour un admin du repo : `enforce_admins` est activé, l'option de contournement n'apparaît pas.
> - Testé à la main parce que c'est la protection de branche GitHub qui bloque, pas du code du repo.

**Préconditions** : mise en place commune faite. Être connecté à GitHub (CLI et navigateur) avec un compte admin du repo.

**Étapes**

1. Lire la protection de `dev` :
   ```bash
   gh api repos/{owner}/{repo}/branches/dev/protection \
     --jq '{checks: .required_status_checks.contexts, strict: .required_status_checks.strict, admins: .enforce_admins.enabled, reviews: .required_pull_request_reviews}'
   ```
2. Ouvrir une PR avec une erreur de lint volontaire (import relatif) et attendre son check :
   ```bash
   start_branch lint
   printf "import { appConfig } from './config/appConfig.js'\n\nexport const smokeLint = appConfig\n" > src/smokeLint.ts
   open_pr lint
   wait_ci lint
   ```
3. Lire l'état du bouton de merge :
   ```bash
   merge_state lint
   ```
4. Ouvrir la PR dans le navigateur (`gh pr view "$(br lint)" --web`) et regarder la zone de merge, **sans rien cliquer**.

**Résultat attendu**

- Étape 1 : `checks` contient `"ci"`, `admins` vaut `true`.
  - `required_status_checks` absent ou `checks` sans `"ci"` : le check n'est pas requis, le merge ne sera pas bloqué par la CI.
  - `admins` à `false` : un admin peut merger malgré le check rouge.
  - Un `404 Branch not protected` : aucune protection posée sur `dev`.
- Étape 2 : `gh pr checks` affiche `ci` en `fail`.
- Étape 3 : `BLOCKED`.
- Étape 4 : bouton de merge grisé avec « Merging is blocked » et le check `ci` marqué « Required ». Aucune case « Merge without waiting for requirements to be met (bypass branch protections) ».

Si `reviews` n'est pas `null` à l'étape 1, une review requise suffit à donner `BLOCKED` : le scénario ne prouve le blocage par la CI que si la PR saine passe à `CLEAN` en CA7 avec la même protection.

On ne tente pas `gh pr merge --admin` : si la protection est mal réglée, la PR de test partirait réellement dans `dev`.

- [ ] CA2 vérifié

### 2. Installation des dépendances

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA3 | 🔴 | `pnpm install --frozen-lockfile` installe les dépendances, autorise les build scripts, et échoue si `pnpm-lock.yaml` n'est pas à jour | Smoke ci-dessous |

#### CA3 : l'install échoue sur un lockfile désynchronisé et passe sur une PR saine

> ✅ **Ce qu'on vérifie :**
> - Une PR qui modifie `package.json` sans mettre à jour `pnpm-lock.yaml` échoue à l'étape d'install, et les étapes suivantes ne tournent pas.
> - Sur la PR saine, l'install passe et les build scripts de `esbuild`, `prisma` et `@prisma/engines` (autorisés par `allowBuilds` dans `pnpm-workspace.yaml`) tournent sans être ignorés.
> - Testé à la main parce que le refus d'un lockfile désynchronisé et l'autorisation des build scripts sont le comportement réel de pnpm sur un vrai runner.

**Préconditions** : scénario CA1 joué (PR saine verte).

**Étapes**

1. Ouvrir une PR qui ajoute une dépendance dans `package.json` sans toucher au lockfile, et attendre son check :
   ```bash
   start_branch lockfile
   node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['is-odd']='^3.0.1';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
   open_pr lockfile
   wait_ci lockfile
   ```
2. Lire les étapes et l'erreur :
   ```bash
   steps lockfile
   gh run view "$(run_id lockfile)" --log-failed | grep -i 'lockfile' | head -5
   ```
3. Sur la PR saine, chercher un build script ignoré dans le log d'install :
   ```bash
   gh run view "$(run_id saine)" --log | grep -iE 'ignored build scripts|approve-builds' ; echo "lignes trouvées : $?"
   ```

**Résultat attendu**

- Étape 1 : `ci` en `fail`.
- Étape 2 : `Run pnpm install --frozen-lockfile : failure`, puis `Lint`, `Build` et `Tests` en `skipped`. Le log contient `ERR_PNPM_OUTDATED_LOCKFILE` (lockfile pas à jour avec `package.json`).
  - Install en `success` : la CI n'installe pas en `--frozen-lockfile`, elle réécrit le lockfile en silence.
- Étape 3 : aucune ligne, puis `lignes trouvées : 1` (le `1` de `grep` veut dire « rien trouvé »). Une ligne « Ignored build scripts » signifie que pnpm sur le runner ne lit pas `allowBuilds` : le client Prisma n'est pas généré par le `postinstall`.

- [ ] CA3 vérifié

### 3. Vérifications

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA4 | 🔴 | La CI lance `pnpm lint` et échoue sur une erreur de lint | Smoke ci-dessous |
| CA5 | 🔴 | La CI lance `pnpm build` (`prisma generate` puis `tsc`) sans base et échoue si le typecheck échoue | Smoke ci-dessous |
| CA6 | 🔴 | La CI lance `pnpm test` (Vitest, unitaires seuls, sans base) et échoue si un test échoue | Smoke ci-dessous |

#### CA4 : une erreur de lint fait échouer l'étape Lint

> ✅ **Ce qu'on vérifie :**
> - L'étape `Lint` lance `pnpm lint` et son échec fait échouer le job ; `Build` et `Tests` ne tournent pas.
> - Testé à la main parce qu'on vérifie le branchement de l'étape dans le workflow et le code de sortie réel d'ESLint sur GitHub Actions.

**Préconditions** : scénario CA2 joué (PR `lint` rouge, avec `src/smokeLint.ts` qui importe en `./`).

**Étapes**

1. Lire les étapes et l'erreur :
   ```bash
   steps lint
   gh run view "$(run_id lint)" --log-failed | grep -E 'smokeLint|no-restricted-imports'
   ```

**Résultat attendu**

- `Run pnpm install --frozen-lockfile : success`, `Lint : failure`, `Build : skipped`, `Tests : skipped`.
- Le log cite `src/smokeLint.ts` et la règle `no-restricted-imports` (« Imports internes : utilise l'alias @/ »).
  - Échec à `Build` au lieu de `Lint` : l'étape `Lint` n'est pas dans le workflow, ou elle est placée après `Build`.

- [ ] CA4 vérifié

---

#### CA5 : une erreur de type fait échouer l'étape Build, et prisma generate passe sans base

> ✅ **Ce qu'on vérifie :**
> - Une erreur de type (sans erreur de lint) fait échouer l'étape `Build` ; `Tests` ne tourne pas.
> - Sur la PR saine, `prisma generate` passe sans `DATABASE_URL` ni Postgres.
> - Testé à la main parce que c'est le comportement réel de Prisma et de `tsc` sur le runner, et la contrainte « sans Postgres » ne se confirme que là.

**Préconditions** : scénario CA1 joué (PR saine verte).

**Étapes**

1. Ouvrir une PR avec une erreur de type et attendre son check :
   ```bash
   start_branch build
   printf "export const smokeBuild: number = 'pas un nombre'\n" > src/smokeBuild.ts
   open_pr build
   wait_ci build
   ```
2. Lire les étapes et l'erreur :
   ```bash
   steps build
   gh run view "$(run_id build)" --log-failed | grep -E 'error TS'
   ```
3. Sur la PR saine, lire la génération du client Prisma :
   ```bash
   gh run view "$(run_id saine)" --log | grep -E 'Generated Prisma Client|DATABASE_URL'
   ```

**Résultat attendu**

- Étape 1 : `ci` en `fail`.
- Étape 2 : `Lint : success`, `Build : failure`, `Tests : skipped`. Le log contient `src/smokeBuild.ts` et `error TS2322` (string non assignable à number).
- Étape 3 : au moins 2 lignes `Generated Prisma Client` (le `postinstall` pendant l'install, puis l'étape `Build`) et aucune ligne qui mentionne `DATABASE_URL`. Une erreur sur `DATABASE_URL` signifie que `prisma.config.ts` exige la variable à la génération, et la CI aurait besoin d'une base, contraire au ticket.

- [ ] CA5 vérifié

---

#### CA6 : un test cassé fait échouer l'étape Tests, sans mode watch

> ✅ **Ce qu'on vérifie :**
> - Un test en échec (qui passe le lint et le typecheck) fait échouer l'étape `Tests`.
> - Vitest tourne une fois et sort : le job se termine en quelques minutes, sans rester bloqué en attente.
> - Aucune base n'est demandée par les tests.
> - Testé à la main parce que c'est le comportement réel de Vitest en `CI=true` sur GitHub Actions.

**Préconditions** : mise en place commune faite.

**Étapes**

1. Ouvrir une PR avec un test volontairement faux et attendre son check :
   ```bash
   start_branch tests
   printf "import { expect, test } from 'vitest'\n\ntest('smoke KOM-25, échec volontaire', () => {\n  const total = 1 + 1\n\n  expect(total).toBe(3)\n})\n" > src/smokeTests.test.ts
   open_pr tests
   wait_ci tests
   ```
2. Lire les étapes, l'erreur et la durée du job :
   ```bash
   steps tests
   gh run view "$(run_id tests)" --log-failed | grep -E 'FAIL|smoke KOM-25|Tests '
   gh run view "$(run_id tests)" --json jobs --jq '.jobs[] | select(.name=="ci") | "\(.startedAt) → \(.completedAt)"'
   ```

**Résultat attendu**

- Étape 1 : `ci` en `fail`.
- Étape 2 : `Lint : success`, `Build : success`, `Tests : failure`. Le log montre `FAIL src/smokeTests.test.ts > smoke KOM-25, échec volontaire` et un récap `Tests  1 failed`. Le job dure quelques minutes.
  - Job annulé après un long délai (timeout) : Vitest est resté en mode watch.
  - Une erreur de connexion à Postgres : un test unitaire touche une vraie base.

- [ ] CA6 vérifié

### 4. Résultat

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA7 | 🔴 | Lint, build et tests verts : le check `ci` est vert et le merge est autorisé | Smoke ci-dessous |

#### CA7 : une PR saine a le check vert et le merge autorisé

> ✅ **Ce qu'on vérifie :**
> - Sur la PR saine, les 4 étapes passent, le check `ci` est vert et GitHub autorise le merge.
> - Testé à la main parce que le résultat du check et le déblocage du merge viennent de la protection de branche GitHub réelle.

**Préconditions** : scénario CA1 joué (PR saine). Ne pas merger la PR.

**Étapes**

1. Lire les étapes, le check et l'état du bouton de merge :
   ```bash
   steps saine
   gh pr checks "$(br saine)"
   merge_state saine
   ```

**Résultat attendu**

- `Run pnpm install --frozen-lockfile`, `Lint`, `Build` et `Tests` en `success`.
- `gh pr checks` : `ci` en `pass`.
- `merge_state` : `CLEAN`. Dans le navigateur, le bouton « Merge pull request » est actif (ne pas cliquer).
  - `BEHIND` : la protection exige une branche à jour (`strict`) et `dev` a avancé. Mettre la branche à jour (`gh pr update-branch "$(br saine)"`), attendre le check, relire.
  - `BLOCKED` avec `ci` en `pass` : une autre règle bloque (review requise, cf. `reviews` en CA2). Le blocage de CA2 n'est alors pas attribuable à la CI seule.

- [ ] CA7 vérifié
