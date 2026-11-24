# Inventaire de tests : KOM-06 « Authentification · backend »

Source : règles métier et contraintes techniques du ticket KOM-06 (transmises par la session parente, le ticket Notion n'ayant pas pu être lu directement). Doctrine appliquée : `docs/testing-strategy.md`.

> **Découpage créé par l'inventaire, pas par le ticket.** Les règles ont été transmises sans paquets. Comme il y en a plus de 8, elles sont regroupées ici par thème, dans l'ordre du ticket. Si le ticket Notion a ses propres paquets, ils remplacent ce découpage.

Contraintes techniques prises en compte :

- Better Auth possède les routes `/sign-up/email`, `/sign-in/email`, `/sign-out`, `/get-session` (aucune nouvelle route). Son handler lit lui-même le corps de la requête et écrit lui-même la réponse.
- Validation Zod côté serveur, un seul schéma qui fait `trim` + `lowercase`.
- Erreurs Better Auth et Prisma ré-emballées en `ApiError { code, message }` en français, `INTERNAL_ERROR` pour toute erreur inconnue.
- CORS `credentials: true` + `trustedOrigins` (le cookie de session doit passer entre le front et l'API).
- Contrainte `UNIQUE` Prisma sur l'email.
- Contrat d'API dans `src/types/apiContract.ts`.

### Parcours d'authentification

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| RM8 | Un signup valide (prénom, email non utilisé, mot de passe valide) crée le compte en base et connecte l'utilisateur automatiquement | 🔴 | La création du compte et la pose du cookie de session sont faites par Better Auth et Prisma. Les mocker reviendrait à mocker exactement ce qu'on vérifie. Le cookie doit aussi passer avec CORS `credentials: true` + `trustedOrigins` | Manuel (smoke) : `POST /sign-up/email` valide, vérifier le compte en base, le `Set-Cookie`, puis `GET /get-session` renvoie l'utilisateur |
| RM12 | Un signin valide connecte l'utilisateur | 🔴 | La vérification du mot de passe haché et la création de session sont le comportement réel de Better Auth | Manuel (smoke) : `POST /sign-in/email` avec un compte existant, vérifier le `Set-Cookie` puis `GET /get-session` |
| RM5 | Le signout ferme la session | 🔴 | L'invalidation de la session en base et la suppression du cookie sont faites par Better Auth | Manuel (smoke) : `POST /sign-out` avec le cookie, puis `GET /get-session` renvoie `null` |

### Validation des champs du signup

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| RM10 | Un email mal formé ou un mot de passe < 8 caractères (ou > 128) est refusé, aucun compte n'est créé | 🟠 | Le schéma Zod est du code à nous (🟢). Reste une tranche réelle : que ce schéma soit bien branché devant le handler Better Auth, qui possède la route. Sinon c'est la validation par défaut de Better Auth qui répond, avec son propre format d'erreur, et rien ne garantit l'absence de compte créé | Unitaire (schéma Zod : email invalide, 7 / 8 / 128 / 129 caractères) + smoke manuel : `POST /sign-up/email` avec un email mal formé, vérifier `400` + `ApiError` en français et aucune ligne en base |
| RM11 | Un signup sans prénom est refusé | 🟢 | Décision prise par le schéma Zod. Le branchement du schéma devant Better Auth est déjà couvert par le smoke de RM10 | Unitaire, test-first |
| RM20 | Un prénom composé uniquement d'espaces est refusé comme RM11 | 🟢 | Le `trim` puis le refus de la chaîne vide sont faits par le schéma Zod. Même branchement que RM10, déjà couvert par son smoke | Unitaire, test-first |

### Unicité de l'email

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| RM9 | Un email déjà utilisé renvoie `EMAIL_ALREADY_EXISTS`, et une violation `UNIQUE` ressort en RM9, jamais en 500 | 🟠 | Le mapping vers `EMAIL_ALREADY_EXISTS` est du code à nous, testé en mockant l'erreur de Better Auth (utilisateur déjà existant) et l'erreur Prisma `P2002`. Ces formes d'erreur mockées ne sont confirmées par aucun smoke existant, et c'est la contrainte `UNIQUE` réelle qui arbitre | Unitaire (mapping des 2 formes d'erreur) + smoke manuel : 2 `POST /sign-up/email` avec le même email, vérifier `EMAIL_ALREADY_EXISTS` et pas de 500 |
| RM21 | L'unicité est insensible à la casse et aux espaces (`" MARC@x.com "` et `"marc@x.com"` sont le même email) | 🟠 | La normalisation `trim` + `lowercase` est dans le schéma Zod (🟢). Mais le handler Better Auth lit lui-même le corps de la requête : il faut vérifier que c'est bien l'email normalisé qui arrive en base, pas l'email brut | Unitaire (normalisation du schéma) + smoke manuel : signup avec `marc@x.com`, puis signup avec `" MARC@x.com "`, vérifier `EMAIL_ALREADY_EXISTS` ; signin avec `" MARC@x.com "` connecte |

### Erreurs renvoyées

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| RM13 | Des identifiants incorrects renvoient `INVALID_CREDENTIALS` | 🟠 | Le mapping est du code à nous, testé en mockant l'erreur Better Auth de mauvais identifiants. Cette forme d'erreur mockée n'est confirmée par aucun smoke existant | Unitaire (mapping) + smoke manuel : `POST /sign-in/email` avec un mauvais mot de passe, puis avec un email inconnu, vérifier `INVALID_CREDENTIALS` dans les 2 cas |
| RM18, RM19 | Une panne (5xx, timeout) renvoie `INTERNAL_ERROR`, distinct des erreurs métier | 🟠 | Le repli « erreur inconnue → `INTERNAL_ERROR` » est du code à nous. Reste une tranche réelle : Better Auth écrit lui-même ses réponses d'erreur, il faut vérifier qu'une vraie panne passe bien par notre ré-emballage et pas par la réponse 500 brute de Better Auth | Unitaire (erreur inconnue, erreur Prisma non mappée → `INTERNAL_ERROR`, message en français) + smoke manuel : base arrêtée, `POST /sign-in/email`, vérifier `500` + `{ code: "INTERNAL_ERROR" }` |

### Protection des routes

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| RM2 | Une route protégée appelée sans session renvoie 401 | 🟠 | La décision « pas de session → 401 `ApiError` » est du code à nous, testée en mockant la lecture de session. Reste à vérifier que la lecture réelle du cookie par Better Auth fonctionne derrière ce middleware | Unitaire (session mockée absente → 401, présente → passe) + smoke manuel : appeler une route protégée sans cookie → 401, avec le cookie d'un signin → accès |

## Récap

**Test unitaire automatisé (→ `unit-test-writer`)**

- RM11 : signup sans prénom refusé (schéma Zod).
- RM20 : prénom composé d'espaces refusé (schéma Zod).

**Couverture partielle 🟠 (unitaire + smoke manuel)**

- RM10 : unitaire sur le schéma Zod ; smoke `POST /sign-up/email` avec email mal formé → `400` + aucun compte créé (couvre aussi le branchement pour RM11 et RM20).
- RM9 : unitaire sur le mapping Better Auth / Prisma `P2002` → `EMAIL_ALREADY_EXISTS` ; smoke double signup avec le même email.
- RM21 : unitaire sur la normalisation `trim` + `lowercase` ; smoke signup `marc@x.com` puis `" MARC@x.com "` → `EMAIL_ALREADY_EXISTS`.
- RM13 : unitaire sur le mapping → `INVALID_CREDENTIALS` ; smoke signin avec mauvais mot de passe et avec email inconnu.
- RM18, RM19 : unitaire sur le repli → `INTERNAL_ERROR` ; smoke base arrêtée → `500 INTERNAL_ERROR`.
- RM2 : unitaire sur le middleware de session → 401 ; smoke route protégée sans cookie puis avec cookie.

**Vérification manuelle (→ `smoke-test-writer`)**

- RM8 : signup valide → compte en base + session posée.
- RM12 : signin valide → session posée.
- RM5 : signout → session fermée.
