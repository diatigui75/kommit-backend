# Inventaire de tests : KOM-21 « Consulter son calendrier de standups · backend »

Source : ticket KOM-21 (page Notion), contrat `src/types/apiContract.ts` (`GetCalendrierQuery`, `GetCalendrierResponse`, `GetStandupResponse`, `STANDUP_NOT_FOUND`). Code existant de KOM-18 pris en compte : `StandupRepository` (port dans `standupService.ts`), `standupRepository.ts` (colonne `jour` en `DATE`, clé `userId_jour`), `requireSession` monté sur tout `standupRoutes`, `errorHandler` (erreur imprévue → `500 INTERNAL_ERROR`). Doctrine appliquée : `docs/testing-strategy.md`.

Les paquets et leur ordre sont ceux du ticket.

Contraintes techniques prises en compte :

- Le calendrier ne transporte pas les résumés : ils se chargent jour par jour via `GET /standups/:jour`.
- Le `count` est calculé par le serveur, sur la fenêtre demandée, jamais sur tout l'historique.
- Tout est scopé par la session : aucun identifiant fourni par le client ne donne accès aux données d'un autre utilisateur.
- Fenêtre glissante, carrés, jours futurs et dates pièges sont du frontend : le serveur ne renvoie qu'une liste de `Jour`.

### 1. Lecture du calendrier et du résumé

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA11, CA12 | `GET /standups?from&to` renvoie les jours renseignés de la fenêtre, au format `YYYY-MM-DD`, sans les résumés | 🟠 | Le passage « standups lus → liste de `Jour`, sans `summary` » et la transmission de `from` / `to` au repository sont du code à nous, testés avec un repository mocké. Reste la tranche réelle : le filtre de la requête Prisma sur la colonne `DATE` (bornes incluses, aucun décalage d'un jour à la conversion) n'est vérifié par aucun smoke existant | Unitaire (repository mocké → `jours` sans résumé, `from` / `to` transmis tels quels) + smoke manuel : standups en base dont un le jour `from`, un le jour `to` et un hors fenêtre ; `GET /standups?from=…&to=…` avec cookie → les 2 bornes présentes, le jour hors fenêtre absent, aucun champ `summary` |
| CA11 | `count` vaut exactement la longueur de `jours` et porte sur la fenêtre demandée | 🟢 | Le calcul de `count` à partir de la liste est du code à nous ; qu'il porte sur la fenêtre découle de la liste filtrée, dont le filtre réel est couvert par le smoke de CA11, CA12 | Unitaire, test-first (liste de N jours → `count` = N ; liste vide → `count` = 0) |
| CA14 | `GET /standups/:jour` renvoie le `Standup` de ce jour, résumé compris | 🟠 | Le service qui lit `(userId de session, jour)` et renvoie le standup trouvé est du code à nous, testé avec un repository mocké. Reste le branchement réel : le paramètre `:jour` de l'URL converti en date sans décalage, et la nouvelle route `/:jour` déclarée sans capter `GET /standups/today` | Unitaire (standup trouvé → renvoyé tel quel) + smoke manuel : `GET /standups/<jour renseigné>` avec cookie → `Standup` avec `summary` identique à celui validé ; `GET /standups/today` répond toujours `{ done, standup }` |

### 2. Isolation et jour manquant

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA38 | Le calendrier d'un utilisateur A ne contient que ses propres standups | 🟠 | Que le service interroge le repository avec l'`id` de la session, et jamais avec un identifiant venu de la requête, est du code à nous, testé avec un repository mocké. Reste la tranche réelle : la clause `userId` de la requête Prisma de lecture par fenêtre, qui seule isole A de B en base | Unitaire (repository appelé avec l'`id` de `sessionUser`, un `userId` glissé dans la query est ignoré) + smoke manuel : comptes A et B ayant chacun des standups sur des jours différents ; `GET /standups?from&to` avec le cookie de A → uniquement les jours de A, `count` sans les jours de B |
| CA45 | Un jour sans standup répond `STANDUP_NOT_FOUND` | 🟢 | La décision « repository renvoie `null` → `ApiError` `STANDUP_NOT_FOUND` » est du code à nous, testée avec un repository mocké. Le `null` réel sur un jour vide est déjà confirmé par le smoke `GET /standups/today` de KOM-18 (`standup: null`) | Unitaire, test-first |
| CA38, CA45 | Un jour qui appartient à quelqu'un d'autre répond le même `STANDUP_NOT_FOUND`, sans contenu et sans distinction avec un jour vide | 🟠 | Que la lecture se fasse sur `(userId de session, jour)` et produise exactement la même erreur qu'un jour vide est du code à nous, testé avec un repository mocké. Reste la tranche réelle : la clé `userId_jour` en base qui ne renvoie pas la ligne de B quand A demande ce jour, et une réponse HTTP strictement identique (statut et corps) | Unitaire (repository appelé avec l'`id` de session ; même `ApiError` que pour un jour vide) + smoke manuel : B a un standup le jour J, A n'en a pas ; `GET /standups/J` avec le cookie de A → même statut et même corps que `GET` sur un jour vide de A, aucun champ de B |

### 3. Erreurs

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA43, CA46 | Une erreur à la lecture ressort en `ApiError`, distincte de « aucun standup » | 🟠 | Qu'un échec du repository se propage sans être converti en `STANDUP_NOT_FOUND` ni en calendrier vide est du code à nous, testé en mockant un repository qui rejette. Reste la tranche réelle : une vraie erreur Prisma (base injoignable) qui traverse le controller jusqu'à `errorHandler` et sort en `500 INTERNAL_ERROR` JSON, ce qu'aucun smoke existant ne vérifie sur ces 2 routes | Unitaire (repository qui rejette → erreur propagée, ni `STANDUP_NOT_FOUND` ni `{ count: 0, jours: [] }`) + smoke manuel : base arrêtée ou `DATABASE_URL` invalide, `GET /standups?from&to` et `GET /standups/:jour` avec cookie → `500` `{ code: "INTERNAL_ERROR", message }` |

Point non tranché par le ticket : le traitement d'un `from` / `to` absent ou mal formé, ou d'un `:jour` mal formé dans l'URL. Aucune règle ne le couvre, donc aucune ligne ici ; sans validation, une telle date finit en erreur Prisma, donc en `500` au lieu d'un `400 VALIDATION_ERROR`.

## Récap

**Test unitaire automatisé (→ `unit-test-writer`)**

- CA11 : `count` = longueur de `jours`.
- CA45 : repository `null` → `STANDUP_NOT_FOUND`.

**Couverture partielle 🟠 (unitaire + smoke manuel)**

- CA11, CA12 : unitaire sur la liste de jours sans résumé ; smoke `GET /standups?from&to`, bornes incluses, jour hors fenêtre absent, aucun `summary`.
- CA14 : unitaire sur le standup trouvé renvoyé ; smoke `GET /standups/:jour` sur un jour renseigné, et `GET /standups/today` toujours servi par sa route.
- CA38 : unitaire sur l'`id` de session passé au repository ; smoke 2 comptes, le calendrier de A sans les jours de B.
- CA38, CA45 : unitaire sur la même erreur que pour un jour vide ; smoke 2 comptes, le jour de B demandé par A → réponse identique à un jour vide.
- CA43, CA46 : unitaire sur l'erreur du repository propagée ; smoke base injoignable → `500 INTERNAL_ERROR` sur les 2 routes.

**Vérification manuelle (→ `smoke-test-writer`)**

- Aucune règle en 🔴 seul. Les smokes à écrire sont ceux des 5 lignes 🟠 ci-dessus.
