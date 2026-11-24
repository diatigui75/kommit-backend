# Smokes : KOM-06 « Authentification · backend »

> **Écrits avant l'implémentation, à exécuter après.** Ces scénarios se jouent à la main une fois le code en place, au fil de l'eau (cf. `docs/workflow-ticket-backend.md`, étape 3). Cocher la case d'un scénario quand son résultat attendu est constaté.

Source : `testing/inventaire-KOM-06.md` (mêmes sections, même ordre), contrat `src/types/apiContract.ts`.

## Mise en place commune

À faire une fois, dans le terminal où l'on joue les scénarios. Le serveur tourne avec `pnpm dev` sur le port 3000, branché sur la base DEV.

```bash
# Préfixe des routes Better Auth. /api/auth est le basePath par défaut de Better Auth,
# mais rien n'est encore monté dans le repo : à ajuster sur le préfixe réellement choisi.
# Un 404 sur tous les scénarios = mauvais préfixe (ou handler Better Auth pas monté dans routes/).
BASE=http://localhost:3000/api/auth

# Origine du front : envoyée sur chaque requête, comme le ferait le navigateur.
# Better Auth refuse les requêtes à cookie dont l'origine n'est pas dans trustedOrigins.
ORIGIN=http://localhost:5173

# Un email neuf à chaque passe, pour ne pas dépendre de l'état de la base.
STAMP=$(date +%s)
EMAIL="smoke-$STAMP@kommit.dev"
PASSWORD='motdepasse-smoke-1'
NAME='Marc'

# Dossier des cookie jars (fichiers où curl stocke les cookies reçus).
JARS=$(mktemp -d)
```

Lecture de la base : les vérifications « en base » utilisent `psql "$DATABASE_URL"` (variable du `.env`). La table des utilisateurs s'appelle `"user"` si le modèle Prisma de Better Auth garde son `@@map("user")` par défaut ; sinon, ajuster le nom de table. `pnpm prisma studio` fait aussi l'affaire.

**Ordre d'exécution** : les scénarios de la section 1 créent le compte `$EMAIL` réutilisé ensuite (RM13, RM21, RM2). Les jouer dans l'ordre du fichier, dans le même terminal.

### Parcours d'authentification

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| RM8 | 🔴 | Signup valide : compte créé en base, cookie de session posé, utilisateur connecté | Scénario RM8 ci-dessous |
| RM12 | 🔴 | Signin valide : cookie de session posé, utilisateur connecté | Scénario RM12 ci-dessous |
| RM5 | 🔴 | Signout : session fermée, l'ancien cookie ne connecte plus | Scénario RM5 ci-dessous |

#### RM8 : un signup valide crée le compte et connecte

> ✅ **Ce qu'on vérifie :**
> - Un signup avec prénom, email non utilisé et mot de passe valide crée le compte en base et connecte l'utilisateur tout de suite (cookie de session posé, `/get-session` renvoie l'utilisateur).
> - Manuel parce que la création du compte et la pose du cookie sont faites par Better Auth et Prisma : les mocker reviendrait à mocker exactement ce qu'on vérifie. Le cookie doit aussi passer avec CORS `credentials: true` + `trustedOrigins`.

**Préconditions** : serveur lancé, base DEV joignable, mise en place commune faite (`$EMAIL` neuf).

**Étapes**

1. Signup :
   ```bash
   curl -i -c "$JARS/signup.txt" -X POST "$BASE/sign-up/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
   ```
2. Lire la session avec le cookie reçu :
   ```bash
   curl -i -b "$JARS/signup.txt" "$BASE/get-session" -H "Origin: $ORIGIN"
   ```
3. Vérifier la base :
   ```bash
   psql "$DATABASE_URL" -c "select id, name, email from \"user\" where email = '$EMAIL';"
   ```

**Résultat attendu**

- Étape 1 : `200`. En-têtes `Access-Control-Allow-Origin: http://localhost:5173` et `Access-Control-Allow-Credentials: true`. Un `Set-Cookie` contenant `better-auth.session_token=…`, avec `HttpOnly` et `SameSite=Lax`.
- Étape 2 : `200`, corps avec `user.name = "Marc"` et `user.email = $EMAIL` (forme `Session` du contrat, `user: SessionUser`). Pas `null`.
- Étape 3 : exactement 1 ligne, `name = Marc`, email en minuscules.

- [ ] RM8 vérifié

---

#### RM12 : un signin valide connecte

> ✅ **Ce qu'on vérifie :**
> - Un signin avec un compte existant et le bon mot de passe pose un cookie de session, et `/get-session` renvoie l'utilisateur.
> - Manuel parce que la vérification du mot de passe haché et la création de la session sont le comportement réel de Better Auth.

**Préconditions** : scénario RM8 joué (le compte `$EMAIL` existe). On part d'un cookie jar vide : la connexion ne doit rien devoir au cookie du signup.

**Étapes**

1. Signin :
   ```bash
   curl -i -c "$JARS/signin.txt" -X POST "$BASE/sign-in/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
   ```
2. Lire la session :
   ```bash
   curl -i -b "$JARS/signin.txt" "$BASE/get-session" -H "Origin: $ORIGIN"
   ```

**Résultat attendu**

- Étape 1 : `200`, `Access-Control-Allow-Credentials: true`, un `Set-Cookie` `better-auth.session_token=…` (`HttpOnly`, `SameSite=Lax`).
- Étape 2 : `200`, `user.email = $EMAIL`, `user.name = "Marc"`. Pas `null`.

- [ ] RM12 vérifié

---

#### RM5 : le signout ferme la session

> ✅ **Ce qu'on vérifie :**
> - Après un signout, la session est fermée : `/get-session` renvoie `null`, y compris si l'on rejoue l'ancien cookie (la session est invalidée en base, pas seulement effacée du navigateur).
> - Manuel parce que l'invalidation de la session en base et la suppression du cookie sont faites par Better Auth.

**Préconditions** : scénario RM12 joué (`$JARS/signin.txt` contient un cookie de session valide).

**Étapes**

1. Garder une copie de l'ancien cookie, puis se déconnecter :
   ```bash
   cp "$JARS/signin.txt" "$JARS/old-session.txt"
   curl -i -b "$JARS/signin.txt" -c "$JARS/signin.txt" -X POST "$BASE/sign-out" \
     -H "Origin: $ORIGIN"
   ```
2. Lire la session avec le cookie jar mis à jour :
   ```bash
   curl -i -b "$JARS/signin.txt" "$BASE/get-session" -H "Origin: $ORIGIN"
   ```
3. Rejouer l'ancien cookie :
   ```bash
   curl -i -b "$JARS/old-session.txt" "$BASE/get-session" -H "Origin: $ORIGIN"
   ```

**Résultat attendu**

- Étape 1 : `200`, un `Set-Cookie` qui vide `better-auth.session_token` (valeur vide et/ou `Max-Age=0`).
- Étape 2 : `200`, corps `null`.
- Étape 3 : `200`, corps `null`. Si l'utilisateur revient ici, la session n'a pas été invalidée en base.

- [ ] RM5 vérifié

---

### Validation des champs du signup

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| RM10 | 🟠 | Le schéma Zod est bien branché devant Better Auth : email mal formé ou mot de passe trop court → `400 VALIDATION_ERROR`, aucun compte créé | Complément smoke ci-dessous |
| RM11 | 🟢 | Signup sans prénom refusé | Aucun smoke, couvert en unitaire (branchement couvert par le smoke de RM10) |
| RM20 | 🟢 | Prénom composé uniquement d'espaces refusé comme RM11 | Aucun smoke, couvert en unitaire (branchement couvert par le smoke de RM10) |

#### RM10 : email mal formé ou mot de passe trop court refusé, aucun compte créé

> ✅ **Ce qu'on vérifie :**
> - Un email mal formé ou un mot de passe de moins de 8 caractères est refusé avec notre `ApiError` (`VALIDATION_ERROR`, message en français), et aucune ligne n'est créée en base.
> - Le schéma Zod est testé en unitaire. Le smoke vérifie qu'il est bien branché devant le handler Better Auth, qui possède la route : sinon c'est la validation par défaut de Better Auth qui répond, avec son propre format d'erreur, et rien ne garantit l'absence de compte créé.

**Préconditions** : serveur lancé, mise en place commune faite.

**Étapes**

1. Email mal formé :
   ```bash
   curl -i -X POST "$BASE/sign-up/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"name\":\"$NAME\",\"email\":\"pas-un-email-$STAMP\",\"password\":\"$PASSWORD\"}"
   ```
2. Mot de passe de 7 caractères :
   ```bash
   curl -i -X POST "$BASE/sign-up/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"name\":\"$NAME\",\"email\":\"court-$STAMP@kommit.dev\",\"password\":\"1234567\"}"
   ```
3. Vérifier qu'aucun compte n'a été créé :
   ```bash
   psql "$DATABASE_URL" -c "select email from \"user\" where email in ('pas-un-email-$STAMP', 'court-$STAMP@kommit.dev');"
   ```

**Résultat attendu**

- Étapes 1 et 2 : `400`, corps exactement de la forme `{ "code": "VALIDATION_ERROR", "message": "<texte en français>" }`, aucun `Set-Cookie` de session. Un corps au format Better Auth (`{ "code": "INVALID_EMAIL", … }`, `PASSWORD_TOO_SHORT`, message en anglais) signifie que le schéma Zod n'est pas branché devant le handler.
- Étape 3 : 0 ligne.

- [ ] RM10 vérifié

---

### Unicité de l'email

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| RM9 | 🟠 | La vraie erreur de doublon (Better Auth ou `UNIQUE` Prisma) ressort en `EMAIL_ALREADY_EXISTS`, jamais en 500 | Complément smoke ci-dessous |
| RM21 | 🟠 | L'email normalisé (trim + minuscules) est bien celui qui arrive en base et sert au signin | Complément smoke ci-dessous |

#### RM9 : un email déjà utilisé renvoie EMAIL_ALREADY_EXISTS, jamais 500

> ✅ **Ce qu'on vérifie :**
> - Un 2e signup avec un email déjà utilisé renvoie `EMAIL_ALREADY_EXISTS` avec le message « Un compte avec cet email existe déjà », jamais une 500.
> - Le mapping est testé en unitaire en mockant l'erreur Better Auth « utilisateur déjà existant » et l'erreur Prisma `P2002`. Ces formes d'erreur mockées ne sont confirmées par aucun autre smoke, et c'est la vraie contrainte `UNIQUE` qui arbitre.

**Préconditions** : scénario RM8 joué (le compte `$EMAIL` existe).

**Étapes**

1. Rejouer le signup avec le même email :
   ```bash
   curl -i -X POST "$BASE/sign-up/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"name\":\"Autre\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
   ```
2. Vérifier qu'il n'y a toujours qu'un compte :
   ```bash
   psql "$DATABASE_URL" -c "select count(*) from \"user\" where email = '$EMAIL';"
   ```

**Résultat attendu**

- Étape 1 : un statut 4xx (pas 500 ; le contrat ne fixe pas le statut HTTP, seulement le corps), corps `{ "code": "EMAIL_ALREADY_EXISTS", "message": "Un compte avec cet email existe déjà" }`, aucun `Set-Cookie` de session. Une 500 ou un `INTERNAL_ERROR` signifie que la forme réelle de l'erreur ne correspond pas à celle mockée dans le test unitaire.
- Étape 2 : `count = 1`.

- [ ] RM9 vérifié

---

#### RM21 : unicité insensible à la casse et aux espaces

> ✅ **Ce qu'on vérifie :**
> - `" MARC@x.com "` et `"marc@x.com"` sont le même email : le 2e signup est refusé en `EMAIL_ALREADY_EXISTS`, et le signin avec la version en majuscules entourée d'espaces connecte.
> - La normalisation `trim` + `lowercase` est testée en unitaire sur le schéma Zod. Mais le handler Better Auth lit lui-même le corps de la requête : il faut vérifier que c'est bien l'email normalisé qui arrive en base, pas l'email brut.

**Préconditions** : scénario RM8 joué (le compte `$EMAIL`, en minuscules, existe).

**Étapes**

1. Préparer la variante en majuscules avec espaces, puis signup :
   ```bash
   EMAIL_MESSY=" $(echo "$EMAIL" | tr '[:lower:]' '[:upper:]') "
   curl -i -X POST "$BASE/sign-up/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"name\":\"$NAME\",\"email\":\"$EMAIL_MESSY\",\"password\":\"$PASSWORD\"}"
   ```
2. Signin avec la même variante :
   ```bash
   curl -i -X POST "$BASE/sign-in/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL_MESSY\",\"password\":\"$PASSWORD\"}"
   ```
3. Vérifier la base :
   ```bash
   psql "$DATABASE_URL" -c "select email from \"user\" where lower(trim(email)) = '$EMAIL';"
   ```

**Résultat attendu**

- Étape 1 : 4xx, `{ "code": "EMAIL_ALREADY_EXISTS", "message": "Un compte avec cet email existe déjà" }`. Un `200` signifie que l'email brut est arrivé en base.
- Étape 2 : `200` + `Set-Cookie` `better-auth.session_token=…`. Un `INVALID_CREDENTIALS` signifie que le signin ne passe pas par la normalisation.
- Étape 3 : exactement 1 ligne, en minuscules et sans espaces.

- [ ] RM21 vérifié

---

### Erreurs renvoyées

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| RM13 | 🟠 | La vraie erreur Better Auth de mauvais identifiants ressort en `INVALID_CREDENTIALS`, même réponse pour mauvais mot de passe et email inconnu | Complément smoke ci-dessous |
| RM18, RM19 | 🟠 | Une vraie panne (base injoignable) ressort en `500 INTERNAL_ERROR` via notre ré-emballage, pas en 500 brute de Better Auth | Complément smoke ci-dessous |

#### RM13 : des identifiants incorrects renvoient INVALID_CREDENTIALS

> ✅ **Ce qu'on vérifie :**
> - Un mauvais mot de passe et un email inconnu renvoient tous les 2 `INVALID_CREDENTIALS`, avec le même message générique qui ne dit pas lequel des 2 est faux.
> - Le mapping est testé en unitaire en mockant l'erreur Better Auth de mauvais identifiants. Cette forme d'erreur mockée n'est confirmée par aucun autre smoke.

**Préconditions** : scénario RM8 joué (le compte `$EMAIL` existe).

**Étapes**

1. Bon email, mauvais mot de passe :
   ```bash
   curl -i -X POST "$BASE/sign-in/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\",\"password\":\"mauvais-mot-de-passe\"}"
   ```
2. Email inconnu :
   ```bash
   curl -i -X POST "$BASE/sign-in/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"email\":\"inconnu-$STAMP@kommit.dev\",\"password\":\"$PASSWORD\"}"
   ```

**Résultat attendu**

- Étapes 1 et 2 : même statut 4xx (pas 500 ; le contrat ne fixe pas le statut HTTP), même corps `{ "code": "INVALID_CREDENTIALS", "message": "<même texte en français>" }`, aucun `Set-Cookie` de session. Deux messages différents révèleraient lequel des 2 champs est faux, ce que le contrat interdit.

- [ ] RM13 vérifié

---

#### RM18, RM19 : une panne renvoie INTERNAL_ERROR

> ✅ **Ce qu'on vérifie :**
> - Quand la base est injoignable (erreur serveur ou timeout), le signin renvoie `500` + `{ code: "INTERNAL_ERROR" }` avec un message en français, distinct des erreurs métier.
> - Le repli « erreur inconnue → `INTERNAL_ERROR` » est testé en unitaire. Better Auth écrit lui-même ses réponses d'erreur : il faut vérifier qu'une vraie panne passe bien par notre ré-emballage et pas par la réponse 500 brute de Better Auth.

**Préconditions** : la base DEV est sur Neon, on ne l'arrête pas. On simule la panne en relançant le serveur avec une URL de base qui pointe sur un port fermé. Remettre le serveur normal après le scénario.

**Étapes**

1. Arrêter `pnpm dev`, puis le relancer sur une base injoignable :
   ```bash
   DATABASE_URL='postgresql://smoke:smoke@localhost:5999/smoke' pnpm dev
   ```
2. Dans l'autre terminal, signin :
   ```bash
   curl -i --max-time 60 -X POST "$BASE/sign-in/email" \
     -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
   ```
3. Arrêter le serveur et relancer `pnpm dev` normalement.

**Résultat attendu**

- Étape 2 : `500`, corps exactement `{ "code": "INTERNAL_ERROR", "message": "<texte en français>" }`. Pas de corps vide, pas de message Prisma ou Better Auth en anglais, pas de stack trace. Si curl abandonne au bout de 60 s sans réponse, le timeout n'est pas géré (RM19).

- [ ] RM18, RM19 vérifié

---

### Protection des routes

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| RM2 | 🟠 | La lecture réelle du cookie par Better Auth fonctionne derrière notre middleware : sans cookie → `401`, avec cookie → accès | Complément smoke ci-dessous (route protégée à fournir) |

#### RM2 : une route protégée sans session renvoie 401

> ✅ **Ce qu'on vérifie :**
> - Une route protégée appelée sans session renvoie `401` avec une `ApiError`, et la même route appelée avec le cookie d'un signin donne accès.
> - La décision « pas de session → 401 » est testée en unitaire en mockant la lecture de session. Reste à vérifier que la lecture réelle du cookie par Better Auth fonctionne derrière ce middleware.

> ⚠️ **Route à ajuster.** Le ticket ne crée aucune route protégée, et `/get-session` ne convient pas : il renvoie `200` + `null` sans session, pas `401`. `PROTECTED_URL` est à renseigner avec la route protégée par le middleware de session une fois qu'elle existe. Un `404` à l'étape 1 signifie que la route n'existe pas (pas un échec de RM2) ; un `200` signifie que le middleware n'est pas monté dessus.

**Préconditions** : scénario RM12 rejoué juste avant (après RM5, `$JARS/signin.txt` ne contient plus de session valide) :

```bash
curl -s -o /dev/null -c "$JARS/signin.txt" -X POST "$BASE/sign-in/email" \
  -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
PROTECTED_URL=http://localhost:3000/A_AJUSTER
```

**Étapes**

1. Sans cookie :
   ```bash
   curl -i "$PROTECTED_URL" -H "Origin: $ORIGIN"
   ```
2. Avec le cookie du signin :
   ```bash
   curl -i -b "$JARS/signin.txt" "$PROTECTED_URL" -H "Origin: $ORIGIN"
   ```

**Résultat attendu**

- Étape 1 : `401`, corps de la forme `ApiError` `{ "code": …, "message": "<texte en français>" }`. Le contrat ne définit aucun code dédié à l'absence de session : le code exact est à confirmer (voir le point ouvert remonté avec ce fichier).
- Étape 2 : pas de `401` ; la réponse normale de la route.

- [ ] RM2 vérifié
