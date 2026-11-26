# Stack technique

## Backend

| Rôle             | Outil           |
| ---------------- | --------------- |
| Runtime          | Node.js         |
| Framework HTTP   | Express         |
| Langage          | TypeScript (v6) |
| Authentification | Better Auth     |
| Validation       | Zod             |
| ORM              | Prisma          |
| Base de données  | PostgreSQL      |
| Tests            | Vitest          |

## Infra

| Rôle                     | Outil                   |
| ------------------------ | ----------------------- |
| Hébergement frontend     | Vercel                  |
| Hébergement backend      | Render                  |
| Base de données hébergée | Neon                    |
| Code et CI/CD            | GitHub / GitHub Actions |
| Gestion de projet        | Notion                  |
| Maintien en éveil (DEV)  | cron-job.org            |

## Maintien en éveil du backend de DEV

Render endort le serveur gratuit après 15 minutes sans requête. Une tâche cron-job.org (« Keep-alive backend DEV ») appelle `GET https://kommit-backend-diatigui-dev.onrender.com/health` toutes les 14 minutes (`*/14 * * * *`) pour l'en empêcher. Elle est configurée sur le compte cron-job.org du propriétaire du repo, pas dans ce repo, et alerte par email après 3 échecs.
