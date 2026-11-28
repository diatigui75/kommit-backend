# Inventaire de tests : KOM-27 « Créer une CD · backend »

Source : ticket KOM-27 (page Notion). Existant de KOM-11 pris en compte : `render.yaml` (service `kommit-backend-diatigui-dev`, branche `dev`, `autoDeploy`, `healthCheckPath: /health`, secrets en `sync: false`, `BETTER_AUTH_URL` en `value`), `src/config/appConfig.ts` (lecture de la whitelist, repli sur `localhost:5173` à `5176`), `src/middlewares/corsMiddleware.ts` (`cors` avec `credentials`), `src/repositories/authClient.ts` (`SameSite=None; Secure` quand `BETTER_AUTH_URL` est en https). Doctrine appliquée : `docs/testing-strategy.md`.

Les paquets et leur ordre sont ceux du ticket.

Contraintes techniques prises en compte :

- Service décrit dans `render.yaml` (build et start pnpm, branche `dev`, auto-deploy, health check `/health`) : CA1 et CA2 reposent sur le comportement réel de Render, donc sur un smoke.
- Whitelist lue dans `FRONTEND_ORIGINS`, séparées par des virgules, sans retirer localhost. Écart assumé avec le ticket, qui la nomme `FRONTEND_ORIGINS` : la même liste sert au CORS et aux `trustedOrigins` de Better Auth, et `FRONTEND_ORIGINS` est déjà posée sur Render. La lecture de la variable est du code à nous (CA3).
- `BETTER_AUTH_URL` sur l'URL publique du back et cookie en `SameSite=None; Secure` en ligne : CA4 dépend du comportement réel de Better Auth et du navigateur.
- `PORT` jamais fixé dans Render : vérifié par le health check du smoke de CA2.
- Pas de `preDeployCommand` sur DEV et secrets jamais commités : contraintes de configuration, sans règle à tester, à contrôler en relecture de `render.yaml`.

Écart assumé avec le ticket : l'origine Vercel retenue est `https://kommit-frontend-diatigui-dev.vercel.app`, déjà déployée. Le modèle `kommit-frontend-dev-<prénom>` du ticket renvoie 404.

### 1. Déploiement continu (DEV)

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA1 | Une PR mergée sur `dev` déclenche un déploiement automatique sur Render | 🔴 | Aucun code à nous : c'est le comportement réel de Render (`branch: dev`, `autoDeploy: true`) branché sur le repo GitHub | Manuel (smoke) : merger une PR sur `dev`, constater dans le dashboard Render un nouveau déploiement lancé sur le commit du merge, terminé en « Live » |
| CA2 | Une fois déployée, l'API répond sur son URL publique et `/health` renvoie OK | 🔴 | Le handler `/health` existe déjà ; ce qu'on vérifie ici, c'est le service réel sur Render : build pnpm, démarrage sur le `PORT` fourni par Render, health check qui passe | Manuel (smoke) : `curl https://kommit-backend-diatigui-dev.onrender.com/health` → `200` OK ; dans Render, aucune variable `PORT` définie et le health check au vert |

### 2. Accès et authentification depuis un autre domaine

| Règle | Ce qu'on vérifie | Testable unitaire ? | Pourquoi | Comment |
|---|---|---|---|---|
| CA3 | Les requêtes navigateur ne sont acceptées que depuis les origines de `FRONTEND_ORIGINS` (localhost:5173 et l'URL Vercel), toute autre origine est refusée | 🟠 | La lecture de `FRONTEND_ORIGINS` (découpage aux virgules, espaces retirés, entrées vides ignorées, repli sur localhost si absente) est du code à nous. Reste la tranche réelle : le middleware `cors` qui pose ou non `Access-Control-Allow-Origin` et `Allow-Credentials`, et la valeur de `FRONTEND_ORIGINS` réellement présente sur Render après le renommage (si elle manque, le repli ne garde que localhost et Vercel est refusé). Aucun smoke existant ne couvre le CORS | Unitaire (lecture de la variable extraite en fonction pure, `appConfig.ts` levant une erreur à l'import sans `DATABASE_URL` : `"a, b,"` → `["a", "b"]`, absente → origines localhost) + smoke manuel sur l'URL Render : `curl -i -H "Origin: https://kommit-frontend-diatigui-dev.vercel.app"` et `-H "Origin: http://localhost:5173"` → `Access-Control-Allow-Origin` égal à l'origine et `Access-Control-Allow-Credentials: true` ; `-H "Origin: https://evil.example"` → aucun `Access-Control-Allow-Origin` |
| CA4 | Depuis une origine autorisée, un utilisateur se connecte au back DEV et reste connecté d'une requête à l'autre | 🔴 | Ce qu'on vérifie, c'est le cookie réellement posé par Better Auth (`SameSite=None; Secure` avec `BETTER_AUTH_URL` en https) et renvoyé par un vrai navigateur en cross-domaine. Le mocker reviendrait à mocker la règle. Le choix des attributs selon l'URL relève du ticket auth du soir 2 (trou du ticket) | Manuel (smoke) : depuis le front déployé sur Vercel, se connecter ; vérifier dans les DevTools que le cookie de session est en `SameSite=None; Secure` sur le domaine Render, puis qu'un appel suivant protégé (ex. `GET /standups/today`) répond `200` et non `401`. Dépend du déploiement du front (autre repo) |
| (sans numéro) | Empêcher le backend Render de dormir (cron job) | Hors périmètre | Hors repo : le cron existe déjà côté utilisateur, aucun code ni config de ce repo ne le porte | Aucun test dans ce repo |

## Récap

**Test unitaire automatisé (→ `unit-test-writer`)**

- Aucune règle en 🟢 seul.

**Couverture partielle 🟠 (unitaire + smoke manuel)**

- CA3 : unitaire sur la lecture de `FRONTEND_ORIGINS` (virgules, espaces, entrées vides, repli localhost) ; smoke `curl` avec `Origin` sur l'URL Render : Vercel et localhost:5173 acceptés avec credentials, origine tierce refusée.

**Vérification manuelle (→ `smoke-test-writer`)**

- CA1 : merge sur `dev` → déploiement Render automatique terminé en « Live ».
- CA2 : `GET /health` sur l'URL publique → `200` OK, pas de `PORT` fixé dans Render.
- CA4 : connexion depuis le front Vercel, cookie `SameSite=None; Secure`, session qui tient sur l'appel suivant.

Hors périmètre : le cron job anti-sommeil, porté hors repo.
