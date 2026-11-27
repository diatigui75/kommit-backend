# Smokes : KOM-21 « Consulter son calendrier de standups · backend »

> **Écrits avant l'implémentation, à exécuter après.** Ces scénarios se jouent à la main une fois le code en place (cf. `docs/workflow-ticket-backend.md`). Cocher la case d'un scénario quand son résultat attendu est constaté.

Source : `testing/inventaire-KOM-21.md` (mêmes sections, même ordre), ticket KOM-21 (page Notion), contrat `src/types/apiContract.ts` (`GetCalendrierQuery`, `GetCalendrierResponse`, `GetStandupResponse`, `STANDUP_NOT_FOUND`, `INTERNAL_ERROR`).

## Mise en place commune

À faire une fois, depuis la racine de `kommit-backend/`, dans le terminal où l'on joue les scénarios. Le serveur tourne dans un autre terminal avec `pnpm dev` sur le port 3000, branché sur la base DEV. Outils utilisés : `curl`, `grep`, `node`.

```bash
# Les routes du standup sont montées sous /standups, derrière requireSession.
# Un 404 avec le corps {"error":"Route introuvable : GET …"} = route pas déclarée dans standupRoutes.ts,
# pas un échec de la règle. Un STANDUP_NOT_FOUND, lui, a la forme ApiError {"code":…,"message":…}.
API=http://localhost:3000
AUTH=$API/api/auth
ORIGIN=http://localhost:5173

# Des comptes neufs à chaque passe : aucun standup n'existe encore pour eux.
STAMP=$(date +%s)
PASSWORD='motdepasse-smoke-1'
JARS=$(mktemp -d)

# Aujourd'hui à Paris (le jour que POST /standups impose), et ce jour décalé de N jours.
TODAY=$(node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(new Date()))")
day() { node -e "const d=new Date(process.argv[1]+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(process.argv[2]));console.log(d.toISOString().slice(0,10))" "$TODAY" "$1"; }

# Crée le compte $1 (a, b, c…) et garde son cookie de session dans $JARS/$1.txt.
signup() {
  curl -s -o /dev/null -w "signup $1 : %{http_code}\n" -c "$JARS/$1.txt" -X POST "$AUTH/sign-up/email" \
    -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Smoke $1\",\"email\":\"smoke-cal-$1-$STAMP@kommit.dev\",\"password\":\"$PASSWORD\"}"
}

# Le compte $1 valide le récap $2 pour aujourd'hui. Réponse gardée dans $JARS/$1-post.json.
post_standup() {
  curl -s -o "$JARS/$1-post.json" -w "POST /standups ($1) : %{http_code}\n" -b "$JARS/$1.txt" -X POST "$API/standups" \
    -H "Origin: $ORIGIN" -H 'Content-Type: application/json' -d "{\"summary\":$2}"
  cat "$JARS/$1-post.json"; echo
}

# GET $2 avec le cookie du compte $1 : affiche le corps puis le statut.
get() { curl -s -w '\n%{http_code}\n' -b "$JARS/$1.txt" "$API$2" -H "Origin: $ORIGIN"; }

# Compare 2 JSON sans tenir compte de l'ordre des clés : affiche « identiques » ou « DIFFÉRENTS ».
json_eq() { node -e "const s=v=>Array.isArray(v)?v.map(s):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,s(v[k])])):v;const [a,b]=process.argv.slice(1).map(x=>JSON.stringify(s(JSON.parse(x))));console.log(a===b?'identiques':'DIFFÉRENTS')" "$1" "$2"; }

# Compare 2 fichiers octet par octet : affiche « identiques » ou « DIFFÉRENTS ».
same_file() { node -e "const f=require('fs');console.log(f.readFileSync(process.argv[1],'utf8')===f.readFileSync(process.argv[2],'utf8')?'identiques':'DIFFÉRENTS')" "$1" "$2"; }

# 2 récaps valides (forme StandupSummary).
SUMMARY_A='{"fait":["Fini la page de connexion"],"blocages":[],"prevu":["Brancher le calendrier"]}'
SUMMARY_B='{"fait":["Revue de la PR auth"],"blocages":["CI rouge sur main"],"prevu":["Corriger la CI"]}'

signup a
```

**Limite assumée** : `POST /standups` n'enregistre que le jour courant, et ces smokes n'ont pas accès à la base en direct. Chaque compte a donc au plus 1 standup, daté d'aujourd'hui. Les bornes de fenêtre se vérifient en déplaçant la fenêtre autour de ce jour unique, et l'isolation en donnant le même jour à plusieurs comptes.

**Ordre d'exécution** : jouer les sections dans l'ordre du fichier, dans le même terminal. Chaque scénario s'appuie sur l'état laissé par le précédent.

### 1. Lecture du calendrier et du résumé

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA11, CA12 | 🟠 | `GET /standups?from&to` renvoie les jours renseignés de la fenêtre, bornes incluses, au format `YYYY-MM-DD`, sans résumé | Complément smoke ci-dessous |
| CA11 | 🟢 | `count` vaut exactement la longueur de `jours` et porte sur la fenêtre demandée | Aucun smoke, couvert en unitaire |
| CA14 | 🟠 | `GET /standups/:jour` renvoie le `Standup` de ce jour, résumé compris, et `GET /standups/today` reste servi par sa route | Complément smoke ci-dessous |

#### CA11, CA12 : le calendrier renvoie les jours renseignés de la fenêtre, sans résumé

> ✅ **Ce qu'on vérifie :**
> - Un jour renseigné est présent quand il tombe sur la borne `from`, sur la borne `to`, ou les 2 à la fois ; il est absent d'une fenêtre qui finit la veille ou commence le lendemain.
> - Les jours sortent au format `YYYY-MM-DD` et la réponse ne contient aucun `summary`.
> - Le passage « standups lus → liste de `Jour` sans résumé » et la transmission de `from` / `to` sont testés en unitaire avec un repository mocké. Reste le filtre réel de la requête Prisma sur la colonne `DATE` : bornes incluses, aucun décalage d'un jour à la conversion.

**Préconditions** : mise en place commune faite, le compte `a` n'a encore aucun standup.

**Étapes**

1. Le compte `a` valide le récap A pour aujourd'hui :
   ```bash
   post_standup a "$SUMMARY_A"
   ```
2. Interroger 5 fenêtres autour d'aujourd'hui :
   ```bash
   for W in "$TODAY $TODAY" "$TODAY $(day 7)" "$(day -7) $TODAY" "$(day -7) $(day -1)" "$(day 1) $(day 7)"; do
     read F T <<< "$W"
     echo "from=$F to=$T : $(curl -s -b "$JARS/a.txt" "$API/standups?from=$F&to=$T" -H "Origin: $ORIGIN")"
   done; echo "attendu : $TODAY"
   ```
3. Vérifier l'absence de résumé :
   ```bash
   curl -s -b "$JARS/a.txt" "$API/standups?from=$(day -7)&to=$(day 7)" -H "Origin: $ORIGIN" | grep -c 'summary\|fait\|prevu'
   ```

**Résultat attendu**

- Étape 1 : `200`, un `Standup` avec `jour` = `$TODAY`.
- Étape 2 : les 3 premières fenêtres répondent exactement `{"count":1,"jours":["<TODAY>"]}`, les 2 dernières `{"count":0,"jours":[]}`.
  - Today absent de la 2e ou de la 3e fenêtre : la borne correspondante est exclusive (`gt` / `lt` au lieu de `gte` / `lte`) ou le jour est décalé d'un jour à la conversion.
  - Today présent dans la 4e ou la 5e fenêtre : décalage d'un jour à la conversion.
  - Un jour au format `2026-11-27T00:00:00.000Z` au lieu de `2026-11-27` : la date Prisma n'est pas reconvertie en `Jour`.
  - Un 404 `Route introuvable` : `GET /` n'est pas déclaré dans `standupRoutes.ts`.
- Étape 3 : `0`. Toute autre valeur signifie que les résumés partent avec le calendrier.

- [x] CA11, CA12 vérifié
  Joué le 2026-11-27 : le jour apparaît sur `from`, sur `to` et sur les 2 (`count` 1), disparaît la veille et le lendemain (`count` 0). Aucun `summary` dans la réponse.

---

#### CA14 : GET /standups/:jour renvoie le standup de ce jour, et /today reste servi

> ✅ **Ce qu'on vérifie :**
> - `GET /standups/<aujourd'hui>` renvoie le `Standup` complet (`id`, `jour`, `summary`), identique à celui que `POST /standups` a renvoyé.
> - `GET /standups/today` répond toujours `{ done, standup }` : la nouvelle route `/:jour` ne le capte pas.
> - Le service qui lit `(userId de session, jour)` et renvoie le standup trouvé est testé en unitaire avec un repository mocké. Reste le branchement réel : le paramètre `:jour` de l'URL converti en date sans décalage, et l'ordre de déclaration des routes.

**Préconditions** : scénario CA11, CA12 joué (`a` a un standup aujourd'hui, réponse du POST dans `$JARS/a-post.json`).

**Étapes**

1. Lire le jour renseigné et le comparer à la réponse du POST :
   ```bash
   curl -s -o "$JARS/a-day.json" -w '%{http_code}\n' -b "$JARS/a.txt" "$API/standups/$TODAY" -H "Origin: $ORIGIN"
   cat "$JARS/a-day.json"; echo
   json_eq "$(cat "$JARS/a-day.json")" "$(cat "$JARS/a-post.json")"
   ```
2. Vérifier que `/today` est toujours servi par sa route :
   ```bash
   get a /standups/today
   ```

**Résultat attendu**

- Étape 1 : `200`, un `Standup` avec `jour` = `$TODAY` et `summary` = `$SUMMARY_A`, puis `identiques`. Un `STANDUP_NOT_FOUND` signifie que le `:jour` de l'URL est converti en une autre date que celle stockée (décalage d'un jour).
- Étape 2 : `200`, `{"done":true,"standup":{…}}` avec le même `id`. Un `STANDUP_NOT_FOUND` ou un `500 INTERNAL_ERROR` signifie que `/:jour` est déclaré avant `/today` et traite `today` comme une date.

- [x] CA14 vérifié
  Joué le 2026-11-27 : `GET /standups/2026-11-27` rend `200` et le même `Standup` que le POST ; `GET /standups/today` répond toujours `{ done, standup }`.

---

### 2. Isolation et jour manquant

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA38 | 🟠 | Le calendrier d'un utilisateur ne contient que ses propres standups | Complément smoke ci-dessous |
| CA45 | 🟢 | Un jour sans standup répond `STANDUP_NOT_FOUND` | Aucun smoke, couvert en unitaire |
| CA38, CA45 | 🟠 | Un jour qui appartient à quelqu'un d'autre répond le même `STANDUP_NOT_FOUND` qu'un jour vide, sans contenu d'autrui | Complément smoke ci-dessous |

#### CA38 : le calendrier ne contient que les standups de la session

> ✅ **Ce qu'on vérifie :**
> - Avec `a` et `b` qui ont chacun un standup aujourd'hui, le calendrier de `a` contient `$TODAY` une seule fois (`count` = 1), celui de `b` aussi, et celui d'un compte `c` sans standup est vide.
> - Que le service passe au repository l'`id` de la session est testé en unitaire. Reste la clause `userId` de la requête Prisma de lecture par fenêtre, qui seule isole les comptes en base.
> - Les comptes ne peuvent pas avoir de standups sur des jours différents (voir la limite en tête de fichier) : l'absence de clause `userId` se voit ici par un jour compté 2 fois chez `a` et par un calendrier non vide chez `c`.

**Préconditions** : scénario CA14 joué (`a` a un standup aujourd'hui).

**Étapes**

1. Créer `b` (qui valide le récap B) et `c` (sans standup) :
   ```bash
   signup b; post_standup b "$SUMMARY_B"; signup c
   ```
2. Lire le calendrier de chacun sur la même fenêtre :
   ```bash
   for U in a b c; do echo "$U : $(curl -s -b "$JARS/$U.txt" "$API/standups?from=$(day -7)&to=$(day 7)" -H "Origin: $ORIGIN")"; done
   ```

**Résultat attendu**

- Étape 1 : 2 signups en 2xx, `POST /standups (b) : 200`.
- Étape 2 : `a` et `b` répondent `{"count":1,"jours":["<TODAY>"]}`, `c` répond `{"count":0,"jours":[]}`. Un `count` à 2 (ou `$TODAY` listé 2 fois) chez `a` ou `b`, ou un `$TODAY` chez `c`, signifie que la requête ne filtre pas sur le `userId` de la session.

- [x] CA38 vérifié
  Joué le 2026-11-27 : `a` et `b` ont chacun `count` 1, `c` a `{"count":0,"jours":[]}`.

---

#### CA38, CA45 : le jour d'un autre répond comme un jour vide

> ✅ **Ce qu'on vérifie :**
> - `c` demande `$TODAY`, jour où `b` (et `a`) ont un standup mais pas `c` : la réponse est strictement identique, statut et corps, à celle que `c` reçoit pour hier, jour vide pour tout le monde. Aucun contenu de `b` n'apparaît.
> - Que la lecture se fasse sur `(userId de session, jour)` et produise la même `ApiError` qu'un jour vide est testé en unitaire. Reste la clé `userId_jour` en base, qui ne doit pas renvoyer la ligne d'un autre, et une réponse HTTP réellement identique.

**Préconditions** : scénario CA38 joué (`b` a un standup aujourd'hui, `c` n'en a aucun).

**Étapes**

1. `c` demande aujourd'hui (jour d'autrui) puis hier (jour vide) :
   ```bash
   get c "/standups/$TODAY" > "$JARS/c-today.txt"; cat "$JARS/c-today.txt"
   get c "/standups/$(day -1)" > "$JARS/c-yesterday.txt"; cat "$JARS/c-yesterday.txt"
   ```
2. Comparer et chercher une fuite du récap de `b` :
   ```bash
   same_file "$JARS/c-today.txt" "$JARS/c-yesterday.txt"
   grep -c 'Revue de la PR auth\|CI rouge' "$JARS/c-today.txt"
   ```

**Résultat attendu**

- Étape 1 : les 2 réponses ont la forme `{"code":"STANDUP_NOT_FOUND","message":"…"}`, avec le même statut. Le contrat ne fixe pas le statut HTTP : `404` est attendu (voir le point remonté avec ce fichier). Un `200` avec un `Standup` sur `$TODAY` signifie que la lecture ignore le `userId` et renvoie le standup d'un autre.
- Étape 2 : `identiques`, puis `0`. `DIFFÉRENTS` signifie qu'un appelant peut distinguer un jour où quelqu'un d'autre a fait son standup. Si la seule différence est la date reprise dans `message`, rien ne fuit, mais le message doit rester le même pour tous les jours pour que la réponse soit « le même `STANDUP_NOT_FOUND` » du ticket.

- [x] CA38, CA45 vérifié
  Joué le 2026-11-27 : jour d'autrui et jour vide répondent tous les 2 `404` avec un corps `STANDUP_NOT_FOUND` identique, sans rien du récap de `b`.

---

### 3. Erreurs

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA43, CA46 | 🟠 | Une erreur à la lecture ressort en `500 INTERNAL_ERROR`, distincte de `STANDUP_NOT_FOUND` et d'un calendrier vide | Complément smoke ci-dessous |

#### CA43, CA46 : une erreur de lecture sort en ApiError, pas en « aucun standup »

> ✅ **Ce qu'on vérifie :**
> - Une vraie erreur Prisma levée pendant la lecture traverse le controller jusqu'à `errorHandler` et sort en `500` `{"code":"INTERNAL_ERROR","message":…}`, sur `GET /standups?from&to` comme sur `GET /standups/:jour`. Jamais en `STANDUP_NOT_FOUND` ni en `{"count":0,"jours":[]}`.
> - Avec la base injoignable, le front reçoit aussi une `ApiError` `INTERNAL_ERROR`, pas un `401` qui le ferait croire déconnecté.
> - La propagation d'un repository qui rejette est testée en unitaire. Reste une erreur Prisma réelle, d'une forme qu'aucun smoke existant ne vérifie sur ces 2 routes.

> ⚠️ **Pourquoi 2 provocations.** L'inventaire propose de couper la base. Mais `requireSession` lit la session dans la même base, avant la route : avec la base coupée, la requête échoue dans `requireSession` et n'atteint jamais le code de lecture du calendrier. L'étape 1 provoque donc l'erreur Prisma **après** la session, avec une date invalide que Prisma refuse (`Invalid Date`). Si l'implémentation valide `from`, `to` et `:jour` et répond `400 VALIDATION_ERROR`, l'étape 1 ne provoque plus d'erreur de lecture : ce n'est pas un échec, et seule l'étape 2 reste jouable.

**Préconditions** : scénarios précédents joués (cookie de `a` valide). La session survit au redémarrage du serveur (elle est en base).

**Étapes**

1. Base joignable, dates que Prisma refuse :
   ```bash
   get a "/standups?from=pas-une-date&to=$TODAY"
   get a "/standups/2026-13-45"
   ```
2. Dans un autre terminal, lancer un 2e serveur sur une base injoignable :
   ```bash
   PORT=3001 DATABASE_URL=postgresql://smoke:smoke@localhost:5999/smoke pnpm dev
   ```
   Puis dans le terminal des scénarios :
   ```bash
   for P in "/standups?from=$(day -7)&to=$TODAY" "/standups/$TODAY" "/standups/today"; do
     curl -s --max-time 30 -w '\n%{http_code}\n' -b "$JARS/a.txt" "http://localhost:3001$P" -H "Origin: $ORIGIN"
   done
   ```
3. Arrêter le serveur du port 3001.

**Résultat attendu**

- Étape 1 : `500` et `{"code":"INTERNAL_ERROR","message":"Une erreur interne est survenue. Réessaie dans un instant."}` sur les 2 appels (ou `400 VALIDATION_ERROR`, voir l'encadré). Un `STANDUP_NOT_FOUND` ou un `{"count":0,"jours":[]}` signifie que l'erreur est avalée et convertie en « aucun standup », exactement ce que CA46 interdit. Une page HTML ou un corps vide signifie que l'erreur ne passe pas par `errorHandler`.
- Étape 2 : `500` et le même `INTERNAL_ERROR` sur les 3 appels, `/today` compris (il sert de témoin : l'erreur vient de `requireSession`). Un `401` signifie que Better Auth transforme la base injoignable en « pas de session » : le front afficherait un état déconnecté au lieu d'un échec de chargement. Si curl tourne jusqu'aux 30 s, la connexion à la base n'a pas de timeout.

- [x] CA43, CA46 vérifié
  Joué le 2026-11-27 : dates refusées par Prisma → `500 INTERNAL_ERROR` sur les 2 routes ; base injoignable (2e serveur, port 3001) → `500 INTERNAL_ERROR` sur les 3 routes, aucun `401`.
