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
├── prisma/
│   └── schema.prisma      # schéma Prisma, sans modèle pour le moment
├── src/
│   ├── index.ts           # démarrage du serveur
│   ├── app.ts             # assemblage de l'app Express
│   ├── config/
│   │   └── appConfig.ts   # port, nom, version et URL de la base
│   ├── middlewares/
│   │   ├── corsMiddleware.ts # whitelist des origins CORS
│   │   ├── errorHandler.ts
│   │   └── notFound.ts
│   ├── routes/
│   │   ├── index.ts       # router principal
│   │   ├── dbHealthRoutes.ts
│   │   ├── healthRoutes.ts
│   │   └── rootRoutes.ts
│   ├── repositories/
│   │   ├── generated/     # client Prisma généré (ignoré par git)
│   │   ├── dbHealthRepository.ts
│   │   └── prismaClient.ts # instance unique du client Prisma
│   ├── controllers/
│   │   ├── dbHealthController.ts
│   │   ├── healthController.ts
│   │   └── rootController.ts
│   └── services/
│       ├── dbHealth/
│       │   └── dbHealthService.ts
│       ├── health/
│       │   └── healthService.ts
│       └── root/
│           └── rootService.ts
├── .env.example           # modèle des variables d'environnement
├── .gitignore
├── CLAUDE.md              # ce fichier
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml    # scripts d'installation autorisés
├── prisma.config.ts       # config de la CLI Prisma
└── tsconfig.json
```
