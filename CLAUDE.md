# kommit-backend

API backend du projet Kommit, en Node.js, Express et TypeScript.

## Arborescence

Mettre à jour cette arborescence à chaque ajout, déplacement ou suppression de fichier ou de dossier dans le repo.

```
kommit-backend/
├── .claude/
│   ├── rules/             # conventions du repo
│   └── skills/            # skills Claude Code
├── .vscode/
│   └── settings.json
├── docs/
│   └── TECH.md            # stack technique
├── src/
│   ├── index.ts           # démarrage du serveur
│   ├── app.ts             # assemblage de l'app Express
│   ├── config/
│   │   └── appConfig.ts   # port, nom et version du service
│   ├── middlewares/
│   │   ├── errorHandler.ts
│   │   └── notFound.ts
│   ├── routes/
│   │   ├── index.ts       # router principal
│   │   ├── healthRoutes.ts
│   │   └── rootRoutes.ts
│   ├── controllers/
│   │   ├── healthController.ts
│   │   └── rootController.ts
│   └── services/
│       ├── health/
│       │   └── healthService.ts
│       └── root/
│           └── rootService.ts
├── .gitignore
├── CLAUDE.md              # ce fichier
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```
