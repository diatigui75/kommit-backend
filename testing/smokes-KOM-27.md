# Smokes : KOM-27 « Créer une CD · backend »

> **Écrits avant l'implémentation, à exécuter après.** Ces scénarios se jouent à la main une fois le renommage `FRONTEND_ORIGINS` → `CORS_ORIGINS` mergé sur `dev` et déployé sur Render (cf. `docs/workflow-ticket-backend.md`). Cocher la case d'un scénario quand son résultat attendu est constaté.

Source : `testing/inventaire-KOM-27.md` (mêmes sections, même ordre), ticket KOM-27 (page Notion), `render.yaml`, `src/routes/index.ts` et `src/routes/authRoutes.ts` (routes), `src/middlewares/corsMiddleware.ts`, `src/repositories/authClient.ts` (attributs du cookie), `src/middlewares/requireSession/requireSession.ts` (`401` sans corps), contrat `src/types/apiContract.ts`.

Les scénarios visent le service Render, pas le serveur local.

## Mise en place commune

À faire une fois, dans le terminal où l'on joue les scénarios. Outils : `curl`, `git`, un navigateur Chrome (fenêtre normale, pas en navigation privée).

```bash
# Back DEV déployé sur Render et front DEV déployé sur Vercel.
API=https://kommit-backend-diatigui-dev.onrender.com
FRONT=https://kommit-frontend-diatigui-dev.vercel.app

# Un compte neuf à chaque passe : la base Neon est partagée avec le local.
STAMP=$(date +%s)
EMAIL="smoke-kom27-$STAMP@kommit.dev"
PASSWORD='motdepasse-smoke-1'

# Dossier des cookie jars (fichiers où curl stocke les cookies reçus).
JARS=$(mktemp -d)
```

Plan gratuit Render : si le service s'est endormi, la 1re requête peut mettre jusqu'à 1 minute à répondre. Relancer la commande avant de conclure à une panne.

**Ordre d'exécution** : jouer les sections dans l'ordre du fichier. CA1 produit le déploiement sur lequel tournent CA2, CA3 et CA4.

### 1. Déploiement continu (DEV)

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA1 | 🔴 | Une PR mergée sur `dev` déclenche un déploiement automatique sur Render | Smoke ci-dessous |
| CA2 | 🔴 | Une fois déployée, l'API répond sur son URL publique et `/health` renvoie OK | Smoke ci-dessous |

#### CA1 : un merge sur dev lance un déploiement Render terminé en « Live »

> ✅ **Ce qu'on vérifie :**
> - Le merge d'une PR sur `dev` lance tout seul un déploiement sur Render, sur le commit du merge, sans clic sur « Manual Deploy ».
> - Le déploiement va au bout : build pnpm, démarrage, statut « Live ».
> - Testé à la main parce qu'aucun code du repo n'est en jeu : c'est le comportement réel de Render (`branch: dev`, `autoDeploy: true` dans `render.yaml`) branché sur le repo GitHub.

**Préconditions** : une PR vers `dev` prête à merger, avec l'accord de merge donné pour cette PR (la PR de ce ticket fait l'affaire). Accès au dashboard Render du service `kommit-backend-diatigui-dev`.

**Étapes**

1. Merger la PR sur GitHub, puis lire le commit de merge :
   ```bash
   git fetch origin && git log origin/dev -1 --format='%h %s'
   ```
2. Dans le dashboard Render, ouvrir le service, onglet **Events**, sans rien cliquer.
3. Attendre la fin du déploiement, puis relire l'onglet **Events**.

**Résultat attendu**

- Étape 2 : en moins de 1 minute après le merge, un événement « Deploy started » apparaît, déclenché par un **new commit**, avec le même sha court et le même message que l'étape 1.
  - Aucun événement : auto-deploy désactivé, ou service non relié à la branche `dev` (le Blueprint n'a pas été synchronisé, ou le service a été créé à la main hors `render.yaml`).
  - Un déploiement sur un autre sha : le service suit une autre branche que `dev`.
- Étape 3 : « Deploy live » pour ce même commit.
  - « Deploy failed » : ouvrir les logs du déploiement. Un échec au build vise `pnpm install --frozen-lockfile && pnpm build`, un échec après le build vise le démarrage ou le health check (cf. CA2).

- [ ] CA1 vérifié

---

#### CA2 : l'URL publique répond et /health renvoie OK

> ✅ **Ce qu'on vérifie :**
> - Le service déployé répond sur son URL publique en https et `GET /health` renvoie `200` avec `status: "ok"`.
> - Aucune variable `PORT` n'est définie dans Render : l'app écoute sur le port que Render lui fournit, et le health check passe.
> - Testé à la main parce que le handler `/health` existe déjà : ce qu'on vérifie, c'est le service réel sur Render (build pnpm, démarrage sur le `PORT` fourni, health check).

**Préconditions** : CA1 joué, déploiement « Live ».

**Étapes**

1. Appeler `/health` :
   ```bash
   curl -i "$API/health"
   ```
2. Dans le dashboard Render, onglet **Environment** : lire la liste des variables.
3. Onglet **Logs** du dernier déploiement : chercher la ligne de démarrage du serveur et le passage du health check.

**Résultat attendu**

- Étape 1 : `HTTP/2 200`, corps JSON `{"status":"ok","uptime":…,"timestamp":"…"}`.
  - `502` ou `503` après plusieurs essais : le process ne tourne pas ou n'écoute pas sur le bon port.
- Étape 2 : aucune variable `PORT`. Les clés présentes sont `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GROQ_API_KEY`, `BETTER_AUTH_URL` (`https://kommit-backend-diatigui-dev.onrender.com`) et `CORS_ORIGINS`.
  - Une variable `PORT` : la supprimer, c'est contraire au ticket (le health check tombe si elle diffère du port attendu par Render).
- Étape 3 : le serveur annonce l'écoute sur le port fourni par Render (`10000` par défaut), et le déploiement est passé « Live » sans « Health check failed ».

- [ ] CA2 vérifié

### 2. Accès et authentification depuis un autre domaine

| Règle | Inventaire | Ce qu'on vérifie | Scénario |
|---|---|---|---|
| CA3 | 🟠 | Seules les origines de `CORS_ORIGINS` (localhost:5173 et l'URL Vercel) sont acceptées, toute autre origine est refusée | Unitaire sur la lecture de `CORS_ORIGINS` + smoke ci-dessous (complément) |
| CA4 | 🔴 | Depuis une origine autorisée, un utilisateur se connecte au back DEV et reste connecté d'une requête à l'autre | Smoke ci-dessous (version curl + version navigateur) |
| (sans numéro) | Hors périmètre | Empêcher le backend Render de dormir (cron job) | Aucun smoke : porté hors repo |

#### CA3 (complément smoke) : Vercel et localhost acceptés avec credentials, origine tierce refusée

> ✅ **Ce qu'on vérifie :**
> - Sur l'URL Render, une requête qui porte l'origine Vercel ou `http://localhost:5173` reçoit `Access-Control-Allow-Origin` égal à cette origine et `Access-Control-Allow-Credentials: true`.
> - Une requête d'une autre origine ne reçoit aucun `Access-Control-Allow-Origin` : le navigateur bloquera la lecture de la réponse.
> - La lecture de `CORS_ORIGINS` (virgules, espaces, entrées vides, repli sur localhost) est couverte en unitaire. Le smoke couvre la tranche réelle : le middleware `cors` et la valeur de `CORS_ORIGINS` réellement présente sur Render après le renommage. Si elle manque, le repli ne garde que localhost et Vercel est refusé.

**Préconditions** : CA2 vérifié, mise en place commune faite.

**Étapes**

1. Origine Vercel :
   ```bash
   curl -s -o /dev/null -D - "$API/health" -H "Origin: $FRONT" | grep -i '^access-control'
   ```
2. Origine localhost :
   ```bash
   curl -s -o /dev/null -D - "$API/health" -H "Origin: http://localhost:5173" | grep -i '^access-control'
   ```
3. Origine tierce :
   ```bash
   curl -s -o /dev/null -D - "$API/health" -H "Origin: https://evil.example" | grep -i '^access-control' ; echo "lignes trouvées : $?"
   ```
4. Requête préalable (preflight) que le navigateur envoie avant le sign-in du front :
   ```bash
   curl -s -o /dev/null -D - -X OPTIONS "$API/api/auth/sign-in/email" \
     -H "Origin: $FRONT" -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type' | grep -iE '^(HTTP|access-control)'
   ```

**Résultat attendu**

- Étape 1 : `access-control-allow-origin: https://kommit-frontend-diatigui-dev.vercel.app` et `access-control-allow-credentials: true`.
  - Aucune ligne alors que l'étape 2 passe : `CORS_ORIGINS` absente sur Render (le code tombe sur le repli localhost), ou l'URL Vercel mal écrite dedans (slash final, `http` au lieu de `https`).
- Étape 2 : `access-control-allow-origin: http://localhost:5173` et `access-control-allow-credentials: true`.
- Étape 3 : aucune ligne, puis `lignes trouvées : 1` (le `1` de `grep` veut dire « rien trouvé »). Le code HTTP reste `200` : `cors` n'empêche pas la réponse, il retire l'en-tête et c'est le navigateur qui bloque.
  - Une ligne `access-control-allow-origin: *` ou `https://evil.example` : la whitelist n'est pas appliquée.
- Étape 4 : `HTTP/2 204`, `access-control-allow-origin` égal à l'URL Vercel, `access-control-allow-credentials: true`, `access-control-allow-methods` qui contient `POST`.

- [ ] CA3 (complément smoke) vérifié

---

#### CA4 : la session tient en cross-domaine (version curl)

> ✅ **Ce qu'on vérifie :**
> - Un sign-in envoyé avec l'origine Vercel est accepté et pose un cookie de session en `SameSite=None; Secure` (`BETTER_AUTH_URL` en https sur Render).
> - Ce cookie, renvoyé sur une route protégée, donne `200` et pas `401`.
> - Testé à la main parce que c'est le cookie réellement posé par Better Auth sur le service déployé. Le mocker reviendrait à mocker la règle. curl ne vérifie que les attributs du cookie : il n'applique pas les règles cross-site du navigateur, d'où la version navigateur juste après.

**Préconditions** : CA3 vérifié (l'origine Vercel est dans `trustedOrigins` de Better Auth, qui lit la même variable que le CORS). Mise en place commune faite (`$EMAIL` neuf).

**Étapes**

1. Créer le compte de test (le signup connecte aussi, mais on se reconnecte à l'étape 2 pour tester le sign-in seul) :
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/auth/sign-up/email" \
     -H "Origin: $FRONT" -H 'Content-Type: application/json' \
     -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
   ```
2. Sign-in avec l'origine Vercel, cookie stocké dans un jar :
   ```bash
   curl -s -o /dev/null -D - -c "$JARS/signin.txt" -X POST "$API/api/auth/sign-in/email" \
     -H "Origin: $FRONT" -H 'Content-Type: application/json' \
     -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | grep -iE '^(HTTP|set-cookie|access-control)'
   ```
3. Renvoyer le cookie sur une route protégée :
   ```bash
   curl -i -b "$JARS/signin.txt" "$API/standups/today" -H "Origin: $FRONT"
   ```
4. Même route sans cookie, pour témoin :
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' "$API/standups/today" -H "Origin: $FRONT"
   ```

**Résultat attendu**

- Étape 1 : `200`.
- Étape 2 : `HTTP/2 200`, `access-control-allow-credentials: true`, et une ligne `set-cookie` dont le nom contient `session_token` (en https, Better Auth le préfixe en `__Secure-better-auth.session_token`) avec `Secure`, `HttpOnly` et `SameSite=None`.
  - `SameSite=Lax` : la branche https de `advanced.defaultCookieAttributes` dans `authClient.ts` n'est pas prise, donc `BETTER_AUTH_URL` est absente ou en http sur Render.
  - `403` ou erreur d'origine : l'origine Vercel n'est pas dans `trustedOrigins`, donc pas dans `CORS_ORIGINS` sur Render.
  - `401` `{"code":"INVALID_CREDENTIALS",…}` : le compte de l'étape 1 n'a pas été créé.
- Étape 3 : `HTTP/2 200`, corps de forme `GetTodayResponse` : `{"done":false,"standup":null}` pour un compte neuf.
- Étape 4 : `401`, corps vide (`requireSession`).

- [ ] CA4 (curl) vérifié

---

#### CA4 : la session tient en cross-domaine (version navigateur)

> ✅ **Ce qu'on vérifie :**
> - Depuis le front Vercel, un vrai navigateur se connecte au back Render, stocke le cookie sur le domaine Render et le renvoie sur les appels suivants : l'utilisateur reste connecté, y compris après un rechargement de la page.
> - Testé à la main parce que c'est le navigateur qui décide d'envoyer ou non un cookie cross-site. C'est la seule façon de vérifier que `SameSite=None; Secure` suffit en vrai. Dépend du front déployé (autre repo).

**Préconditions** : CA4 (curl) vérifié, compte `$EMAIL` créé. Front déployé sur `$FRONT` et pointé sur `$API`. Chrome en fenêtre normale (la navigation privée bloque les cookies tiers par défaut, Safari et Firefox en mode strict aussi : un échec dans ces cas vient du navigateur, pas du back).

**Étapes**

1. Ouvrir `https://kommit-frontend-diatigui-dev.vercel.app`, DevTools ouverts sur l'onglet **Network**, et se connecter avec `$EMAIL` / `$PASSWORD`.
2. DevTools, onglet **Application** > **Cookies** > `https://kommit-backend-diatigui-dev.onrender.com` : lire le cookie de session.
3. Recharger la page (F5), puis dans **Network** cliquer sur l'appel à `/standups/today` (ou à `/api/auth/get-session`).

**Résultat attendu**

- Étape 1 : l'appel `sign-in/email` répond `200`, sans erreur CORS dans la **Console**, et le front affiche l'accueil connecté.
  - Erreur CORS dans la console : revenir à CA3.
- Étape 2 : un cookie `__Secure-better-auth.session_token` sur le domaine `kommit-backend-diatigui-dev.onrender.com`, colonnes `Secure` et `HttpOnly` cochées, `SameSite` à `None`.
  - Cookie absent, ou l'appel de sign-in marqué d'un triangle jaune dans **Network** (onglet **Cookies** de la requête : « This Set-Cookie was blocked… ») : le navigateur a refusé le cookie, lire la raison affichée.
- Étape 3 : après rechargement, toujours connecté. La requête porte un en-tête `Cookie` avec le `session_token` et répond `200`, pas `401`.

- [ ] CA4 (navigateur) vérifié
