# Smokes : KOM-18 « Renseigner son daily standup · backend »

> **Écrits avant l'implémentation, à exécuter après.** Ces scénarios se jouent à la main une fois le code en place (cf. `docs/workflow-ticket-backend.md`). Cocher la case d'un scénario quand son résultat attendu est constaté.

Source : `testing/inventaire-KOM-18.md` (mêmes sections, même ordre), ticket `assets/KOM-18/ticket.md`, prompts `assets/KOM-18/standupPrompts.ts`, contrat `src/types/apiContract.ts`.

## Mise en place commune

À faire une fois, depuis la racine de `kommit-backend/`, dans le terminal où l'on joue les scénarios. Le serveur tourne dans un autre terminal avec `pnpm dev` sur le port 3000, branché sur la base DEV et avec une `GROQ_API_KEY` valide dans `.env`. Outils utilisés : `curl`, `psql`, `jq`.

```bash
# DATABASE_URL pour les vérifications en base.
set -a; . ./.env; set +a

# Les routes du standup sont montées à la racine (le front appelle `${VITE_API_URL}/standups/...`).
# Un 404 sur une route du standup = route pas montée dans routes/index.ts, pas un échec de la règle.
API=http://localhost:3000
AUTH=$API/api/auth
ORIGIN=http://localhost:5173

# Un compte neuf à chaque passe : aucun standup n'existe encore pour lui aujourd'hui.
STAMP=$(date +%s)
EMAIL="smoke-standup-$STAMP@kommit.dev"
PASSWORD='motdepasse-smoke-1'
JARS=$(mktemp -d)

# Le jour que le serveur doit calculer : aujourd'hui à Paris.
TODAY=$(TZ=Europe/Paris date +%F)

# Compte + session (cookie dans $JARS/session.txt).
curl -s -o /dev/null -c "$JARS/session.txt" -X POST "$AUTH/sign-up/email" \
  -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Marc\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

# Envoie un fil de conversation (JSON en argument) : en-têtes dans last-headers.txt,
# flux brut affiché au fil de l'eau et gardé dans last-stream.txt.
converse() {
  curl -sS -N --max-time 120 -D "$JARS/last-headers.txt" -b "$JARS/session.txt" \
    -X POST "$API/standups/conversation" \
    -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
    -d "$1" | tee "$JARS/last-stream.txt"
}
# Texte de l'IA recollé à partir des événements `token` du dernier flux.
tokens_text() { grep '^data:' "$JARS/last-stream.txt" | sed 's/^data: *//' | jq -rj 'select(.type=="token") | .text'; echo; }
# Événements autres que `token` du dernier flux (summary, error).
other_events() { grep '^data:' "$JARS/last-stream.txt" | sed 's/^data: *//' | jq -c 'select(.type!="token")'; }

# 2 récaps valides (forme StandupSummary), utilisés en section 2 et 3.
SUMMARY_A='{"fait":["Fini la page de connexion"],"blocages":[],"prevu":["Brancher le standup"]}'
SUMMARY_B='{"fait":["Revue de la PR auth"],"blocages":["CI rouge sur main"],"prevu":["Corriger la CI"]}'
```

Le format SSE attendu : chaque événement arrive sur une ligne `data: <JSON>`, où le JSON est un `SseEvent` du contrat (`{"type":"token","text":…}`, `{"type":"summary","summary":…}` ou `{"type":"error","error":{"code":…,"message":…}}`). Si l'implémentation encode autrement (champ `event:` séparé, par exemple), adapter `tokens_text` et `other_events`.

Lecture de la base : la table du standup est supposée s'appeler `standup` (`@@map("standup")`, comme les tables de Better Auth) avec une colonne `"userId"` et une colonne `jour`. Ajuster les requêtes `psql` sur le schéma réellement posé.

**Ordre d'exécution** : jouer les sections dans l'ordre du fichier, dans le même terminal. La section 2 commence par un `GET /standups/today` qui suppose qu'aucun standup n'a encore été validé avec ce compte.

### 1. La conversation avec l'IA, en streaming

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA2, CA4 | 🟠 | La réponse de Groq arrive en `200 text/event-stream`, en événements `token` un par un, sans jamais le marqueur `[[STANDUP_COMPLETE]]` | Complément smoke ci-dessous |
| CA39 | 🟢 | Message vide ou blanc refusé en `VALIDATION_ERROR` | Aucun smoke, couvert en unitaire |
| CA3 | 🔴 | L'IA guide sur les 3 éléments et recadre une digression ou une réponse hors sujet | Scénario CA3 ci-dessous |
| CA5 | 🟠 | Une conversation complète produit un seul événement `summary`, bien formé, avec `[]` pour une catégorie vide | Complément smoke ci-dessous |

#### CA2, CA4 : la réponse de l'IA est relayée au fil de l'eau, sans le marqueur

> ✅ **Ce qu'on vérifie :**
> - Un message envoyé sur `POST /standups/conversation` reçoit `200` + `Content-Type: text/event-stream`, puis des événements `token` qui s'affichent un par un, pas d'un bloc à la fin.
> - Le texte `[[STANDUP_COMPLETE]]` n'apparaît jamais dans les tokens, même recollés (il peut arriver coupé sur 2 fragments).
> - Le retrait du marqueur est testé en unitaire sur un stream mocké. Reste la tranche réelle : la forme des fragments du SDK Groq, et l'envoi sans mise en tampon par Express ou une compression.

**Préconditions** : mise en place commune faite (`$JARS/session.txt` contient une session valide).

**Étapes**

1. Envoyer un fil qui réunit déjà les 3 éléments, pour que le modèle ait une raison d'émettre le marqueur, et regarder le flux s'afficher :
   ```bash
   converse "$(cat <<'EOF'
   {"messages":[
     {"role":"user","content":"Salut, je fais mon standup."},
     {"role":"assistant","content":"Qu'as-tu fait hier ?"},
     {"role":"user","content":"Hier j'ai fini la page de connexion."},
     {"role":"assistant","content":"As-tu des blocages ?"},
     {"role":"user","content":"Aucun blocage."},
     {"role":"assistant","content":"Que prévois-tu aujourd'hui ?"},
     {"role":"user","content":"Aujourd'hui je branche le standup."}
   ]}
   EOF
   )"
   ```
2. Lire les en-têtes et recoller le texte :
   ```bash
   cat "$JARS/last-headers.txt"; tokens_text
   tokens_text | grep -c 'STANDUP_COMPLETE'
   ```

**Résultat attendu**

- Étape 1 : les lignes `data: {"type":"token",…}` apparaissent progressivement dans le terminal. Si tout arrive d'un coup à la fin, le flux est mis en tampon (compression, absence de `flush`, en-têtes pas envoyés tout de suite).
- Étape 2 : `HTTP/1.1 200`, `Content-Type: text/event-stream`, `Access-Control-Allow-Credentials: true`. Le texte recollé est une phrase lisible en français. Le `grep -c` affiche `0` : un `1` signifie que le marqueur, entier ou coupé, n'est pas retiré.

- [ ] CA2, CA4 vérifié

---

#### CA3 : la conversation guide sur les 3 éléments et recadre les digressions

> ✅ **Ce qu'on vérifie :**
> - Face à une digression, l'IA ramène vers le standup ; face à une réponse qui porte sur un autre élément que celui demandé, elle revient sur sa question au lieu de passer à la suite.
> - Manuel parce que le ticket le dit : aucune sortie observable. C'est le modèle sous `SYSTEM_PROMPT` qui guide ; un test unitaire ne vérifierait que le passage du prompt, pas le comportement du modèle.

**Préconditions** : mise en place commune faite.

**Étapes**

1. Digression dès le premier message :
   ```bash
   converse '{"messages":[{"role":"user","content":"Salut ! Tu as vu le match hier soir ?"}]}'
   tokens_text; other_events
   ```
2. Réponse hors sujet : l'IA demande ce qui a été fait hier, l'utilisateur parle de ses blocages :
   ```bash
   converse "$(cat <<'EOF'
   {"messages":[
     {"role":"user","content":"Salut, je fais mon standup."},
     {"role":"assistant","content":"Qu'as-tu fait hier ?"},
     {"role":"user","content":"Je suis bloqué sur la CI depuis ce matin."}
   ]}
   EOF
   )"
   tokens_text; other_events
   ```

**Résultat attendu**

- Étape 1 : l'IA ne commente pas le match, elle recadre poliment et demande ce qui a été fait hier. `other_events` n'affiche rien (pas de `summary`).
- Étape 2 : l'IA prend note ou non du blocage, mais **redemande ce qui a été fait hier** ; elle ne passe pas à « aujourd'hui » et n'invente pas de contenu pour hier. `other_events` n'affiche rien.

- [ ] CA3 vérifié

---

#### CA5 : en fin de conversation, un seul événement summary bien formé

> ✅ **Ce qu'on vérifie :**
> - Quand les 3 éléments sont réunis, le flux se termine par un seul événement `summary` dont `summary` a exactement les clés `fait`, `blocages`, `prevu`, chacune une liste de chaînes, avec `[]` pour la catégorie vide (pas `["Aucun"]`).
> - La chaîne « marqueur → appel de résumé → JSON parsé → `summary` » est testée en unitaire avec un LLM mocké. Reste la tranche que le fichier de prompts signale : que le vrai modèle émette le marqueur quand les 3 éléments sont réunis, et rende un JSON que notre parsing accepte (sans bloc de code autour, par exemple).

**Préconditions** : scénario CA2, CA4 joué juste avant (`$JARS/last-stream.txt` contient le flux du fil complet).

**Étapes**

1. Lister les événements non `token` du flux de CA2, CA4 :
   ```bash
   other_events
   ```

**Résultat attendu**

- Exactement 1 ligne, de la forme `{"type":"summary","summary":{"fait":["…page de connexion…"],"blocages":[],"prevu":["…standup…"]}}`. `blocages` vaut `[]` : `["Aucun"]` ou `["Aucun blocage"]` signifie que `SUMMARY_INSTRUCTION` n'est pas respectée et devra être traité (prompt ou nettoyage).
- Aucune ligne : le modèle n'a pas émis le marqueur. Rejouer CA2, CA4 2 ou 3 fois ; si le `summary` ne tombe jamais, l'heuristique du `DONE_MARKER` ne tient pas avec le vrai modèle.
- Une ligne `{"type":"error","error":{"code":"SUMMARY_MALFORMED",…}}` : le marqueur est bien détecté, mais la sortie réelle du modèle n'est pas acceptée par le parsing, même après le retry.

- [ ] CA5 vérifié

---

### 2. L'enregistrement du standup du jour

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA1, CA8 | 🟠 | `GET /standups/today` relit vraiment la base : `done: false` avant validation, `done: true` + standup du jour après | Complément smoke ci-dessous |
| CA6 | 🔴 | `POST /standups` écrit réellement la ligne en base, pour le bon utilisateur et le jour courant | Scénario CA6 ci-dessous |
| CA26 | 🟢 | Le récap persisté est celui du front, validé sur sa forme, sans regénération | Aucun smoke, couvert en unitaire |
| CA35 | 🟠 | Une date envoyée dans le corps est ignorée, et le jour stocké est aujourd'hui à Paris, sans décalage d'un jour | Complément smoke ci-dessous |

#### CA1, CA8 : GET /standups/today dit si le standup du jour est fait

> ✅ **Ce qu'on vérifie :**
> - Avant toute validation, `GET /standups/today` renvoie `{ "done": false, "standup": null }` ; après un `POST /standups`, il renvoie `{ "done": true, "standup": { id, jour: <aujourd'hui à Paris>, summary } }`.
> - Le calcul du jour et la décision `done` sont testés en unitaire avec un repository mocké. Reste la lecture réelle en base par `(userId, jour)`, dont le résultat dépend de la façon dont Prisma stocke et relit la colonne « jour ».

**Préconditions** : mise en place commune faite, aucun `POST /standups` encore joué avec ce compte.

**Étapes**

1. Avant validation :
   ```bash
   curl -i -b "$JARS/session.txt" "$API/standups/today" -H "Origin: $ORIGIN"
   ```
2. Valider le récap A :
   ```bash
   curl -i -b "$JARS/session.txt" -X POST "$API/standups" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"summary\":$SUMMARY_A}"
   ```
3. Après validation :
   ```bash
   curl -s -b "$JARS/session.txt" "$API/standups/today" -H "Origin: $ORIGIN" | jq; echo "attendu : $TODAY"
   ```

**Résultat attendu**

- Étape 1 : `200`, corps exactement `{"done":false,"standup":null}`.
- Étape 2 : statut 2xx (le contrat ne fixe pas 200 ou 201).
- Étape 3 : `done: true`, `standup.jour` égal à `$TODAY`, `standup.summary` identique à `$SUMMARY_A`, `standup.id` non vide. `done: false` après l'étape 2 signifie que la lecture ne retrouve pas la ligne écrite (jour stocké et jour cherché différents).

- [ ] CA1, CA8 vérifié

---

#### CA6 : à la validation, le récap est réellement enregistré pour le jour courant

> ✅ **Ce qu'on vérifie :**
> - `POST /standups` avec un récap valide renvoie un `Standup` (`id`, `jour`, `summary`) et écrit en base une ligne rattachée au bon utilisateur, datée d'aujourd'hui, portant ce récap.
> - Manuel parce que l'écriture réelle de la ligne (relation à `User`, colonne jour, récap) est le comportement de Prisma et du schéma. Le calcul du jour et le contenu transmis sont couverts en unitaire par CA35 et CA26.

**Préconditions** : scénario CA1, CA8 joué.

**Étapes**

1. Valider le récap B :
   ```bash
   curl -s -b "$JARS/session.txt" -X POST "$API/standups" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"summary\":$SUMMARY_B}" | jq
   ```
2. Lire la base :
   ```bash
   psql "$DATABASE_URL" -c "select * from standup where \"userId\" = (select id from \"user\" where email = '$EMAIL');"
   ```

**Résultat attendu**

- Étape 1 : un JSON de forme `Standup`, `jour` = `$TODAY`, `summary` identique à `$SUMMARY_B`.
- Étape 2 : exactement 1 ligne, son `id` égal à celui de la réponse, son jour = `$TODAY`, son récap = `$SUMMARY_B`.

- [ ] CA6 vérifié

---

#### CA35 : daté du jour local, une date envoyée par le client est ignorée

> ✅ **Ce qu'on vérifie :**
> - Un `POST /standups` qui porte un champ `jour` d'un autre jour dans le corps enregistre quand même le standup à la date d'aujourd'hui à Paris, en base et dans la réponse.
> - La date stockée n'est pas décalée d'un jour (minuit à Paris tombe la veille en UTC).
> - Le calcul du jour civil Paris avec horloge injectée et l'absence de date dans le corps validé sont testés en unitaire. Reste la conversion réelle du jour en date stockée par Prisma (choix `@db.Date` ou `DateTime`), qui peut décaler d'un jour quelle que soit l'heure du test.

**Préconditions** : scénario CA6 joué.

**Étapes**

1. Valider en forçant une date :
   ```bash
   curl -s -w '\n%{http_code}\n' -b "$JARS/session.txt" -X POST "$API/standups" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"jour\":\"2020-01-01\",\"summary\":$SUMMARY_A}"
   ```
2. Lire la date stockée :
   ```bash
   psql "$DATABASE_URL" -c "select jour, jour::text from standup where \"userId\" = (select id from \"user\" where email = '$EMAIL');"
   echo "attendu : $TODAY"
   ```

**Résultat attendu**

- Étape 1 : statut 2xx, `jour` = `$TODAY` dans la réponse (pas `2020-01-01`). Un `400 VALIDATION_ERROR` signifie que le schéma refuse les champs inconnus au lieu de les ignorer : le client ne force toujours pas de date, mais l'écart avec l'inventaire (« date du corps ignorée ») est à trancher.
- Étape 2 : 1 seule ligne, aucune à `2020-01-01`. Avec `@db.Date` : exactement `$TODAY`. Avec `DateTime` : la valeur doit retomber sur `$TODAY` ; une valeur à `22:00` ou `23:00` la veille signifie un décalage à la conversion.

- [ ] CA35 vérifié

---

### 3. Unicité : un seul standup par jour

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA9 | 🔴 | 2 validations le même jour, en série puis en parallèle, laissent une seule ligne, avec le dernier récap | Scénario CA9 ci-dessous |

#### CA9 : resoumettre remplace, n'ajoute pas

> ✅ **Ce qu'on vérifie :**
> - 2 `POST /standups` le même jour, en série puis lancés en parallèle, laissent une seule ligne pour `(userId, jour)` ; en série, elle porte le second récap.
> - Aucune des 2 requêtes parallèles ne finit en 500 : l'écriture est un upsert atomique sur la contrainte `UNIQUE (userId, jour)`, pas un `if` applicatif.
> - Manuel parce que c'est la contrainte en base et l'upsert qui le garantissent ; les mocker reviendrait à mocker exactement ce qu'on vérifie.

**Préconditions** : scénario CA35 joué (une ligne existe déjà pour aujourd'hui, avec le récap A).

**Étapes**

1. En série, récap B puis récap A :
   ```bash
   for S in "$SUMMARY_B" "$SUMMARY_A"; do
     curl -s -o /dev/null -w '%{http_code}\n' -b "$JARS/session.txt" -X POST "$API/standups" \
       -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -d "{\"summary\":$S}"
   done
   psql "$DATABASE_URL" -c "select * from standup where \"userId\" = (select id from \"user\" where email = '$EMAIL');"
   ```
2. En parallèle, récap A et récap B en même temps :
   ```bash
   for S in "$SUMMARY_A" "$SUMMARY_B"; do
     curl -s -w '\n%{http_code}\n' -b "$JARS/session.txt" -X POST "$API/standups" \
       -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -d "{\"summary\":$S}" &
   done; wait
   psql "$DATABASE_URL" -c "select * from standup where \"userId\" = (select id from \"user\" where email = '$EMAIL');"
   ```

**Résultat attendu**

- Étape 1 : 2 statuts 2xx. En base, exactement 1 ligne, jour = `$TODAY`, récap = `$SUMMARY_A` (le dernier envoyé).
- Étape 2 : 2 statuts 2xx. Un `500` / `INTERNAL_ERROR` sur l'une des 2 signifie que l'upsert n'est pas atomique (lecture puis écriture, ou upsert Prisma non natif qui lève `P2002` en concurrence). En base, toujours exactement 1 ligne, portant l'un des 2 récaps.

- [ ] CA9 vérifié

---

### 4. Les erreurs du flux et l'accès

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA29 | 🟢 | Sortie de résumé non conforme : retry unique, puis `SUMMARY_MALFORMED`, jamais de `summary` | Aucun smoke, couvert en unitaire |
| CA31, CA32 | 🟠 | Un provider injoignable donne `200 text/event-stream` puis un événement `error` `LLM_UNAVAILABLE`, pas une 500 | Complément smoke ci-dessous |
| (sans numéro) | 🔴 | Sans cookie, les 3 routes du standup répondent `401` sans ouvrir de flux ; avec le cookie, accès | Scénario ci-dessous |

#### CA31, CA32 : une erreur du provider part en événement SSE error

> ✅ **Ce qu'on vérifie :**
> - Quand Groq est injoignable, `POST /standups/conversation` répond quand même `200 text/event-stream`, puis émet un événement `{"type":"error","error":{"code":"LLM_UNAVAILABLE","message":…}}` et ferme le flux. Pas de 500, pas de `INTERNAL_ERROR` via `errorHandler`.
> - Le mapping des erreurs du SDK Groq est testé en unitaire en mockant ces erreurs. Ces formes d'erreur ne sont confirmées par aucun autre smoke, et une erreur levée après l'envoi des en-têtes doit réellement sortir dans le flux.
> - Le quota (`429` → `LLM_QUOTA_EXCEEDED`) n'est pas provocable à la demande : il reste couvert par l'unitaire seul.

> ⚠️ **Simulation à ajuster.** On rend Groq injoignable en relançant le serveur avec `GROQ_BASE_URL` sur un port fermé : le SDK `groq-sdk` lit cette variable quand le code ne lui passe pas de `baseURL` explicite. Si l'implémentation fixe `baseURL` en dur ou n'utilise pas `groq-sdk`, l'étape 1 ne coupe rien (le flux répond normalement) : couper alors le réseau de la machine pendant l'appel, ou pointer la config sur un port fermé.

**Préconditions** : mise en place commune faite. La session survit au redémarrage du serveur (elle est en base).

**Étapes**

1. Arrêter `pnpm dev`, puis le relancer avec un provider injoignable :
   ```bash
   GROQ_BASE_URL=http://localhost:5999 pnpm dev
   ```
2. Dans le terminal des scénarios :
   ```bash
   converse '{"messages":[{"role":"user","content":"Salut, je fais mon standup."}]}'
   cat "$JARS/last-headers.txt"; other_events
   ```
3. Arrêter le serveur et relancer `pnpm dev` normalement.

**Résultat attendu**

- Étape 2 : en-têtes `200` + `Content-Type: text/event-stream`, puis exactement 1 événement `{"type":"error","error":{"code":"LLM_UNAVAILABLE","message":"<texte en français>"}}`, aucun `token`, aucun `summary`, et le flux se ferme (curl rend la main avant `--max-time`). La réponse peut mettre quelques secondes : le SDK retente avant d'abandonner.
- Une réponse `500` JSON ou un `INTERNAL_ERROR` signifie que l'erreur finit dans `errorHandler` au lieu du flux. Un statut 5xx avec un corps `LLM_UNAVAILABLE` signifie que l'appel à Groq est fait avant l'envoi des en-têtes SSE, ce qui s'écarte du contrat (« erreur pendant le flux → événement `error` »). Si curl tourne jusqu'aux 120 s, le timeout n'est pas géré.

- [ ] CA31, CA32 vérifié

---

#### Sans session valide, 401 avant le flux

> ✅ **Ce qu'on vérifie :**
> - Sans cookie, `POST /standups/conversation`, `GET /standups/today` et `POST /standups` répondent `401`, et la conversation n'ouvre aucun flux (pas de `text/event-stream`).
> - Avec le cookie d'un signin, les mêmes routes donnent accès.
> - La décision « pas de session → 401 » est dans `requireSession`, testé en unitaire par KOM-06. Ce qui est nouveau ici est le branchement : le middleware monté devant les 3 routes du standup, avant l'ouverture du flux, et le cookie qui passe avec CORS credentials.

**Préconditions** : mise en place commune faite, serveur relancé normalement après CA31, CA32.

**Étapes**

1. Les 3 routes sans cookie (corps valides, pour que seul le manque de session puisse expliquer le refus) :
   ```bash
   curl -i -N --max-time 10 -X POST "$API/standups/conversation" -H "Origin: $ORIGIN" \
     -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Salut"}]}'
   curl -i "$API/standups/today" -H "Origin: $ORIGIN"
   curl -i -X POST "$API/standups" -H "Origin: $ORIGIN" \
     -H 'Content-Type: application/json' -d "{\"summary\":$SUMMARY_A}"
   ```
2. Avec le cookie :
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -b "$JARS/session.txt" "$API/standups/today" -H "Origin: $ORIGIN"
   ```

**Résultat attendu**

- Étape 1 : `401` sur les 3, réponse immédiate, aucun `Content-Type: text/event-stream`, aucun `data:`. Le contrat ne définit aucun code `ApiError` pour l'absence de session, et `requireSession` renvoie aujourd'hui un corps vide : le corps exact est à confirmer (voir le point remonté avec ce fichier). Un `200` signifie que le middleware n'est pas monté sur la route ; un `400 VALIDATION_ERROR` sur la conversation signifie que `validateBody` passe avant `requireSession`.
- Étape 2 : `200`.

- [ ] Sans session, 401 vérifié
