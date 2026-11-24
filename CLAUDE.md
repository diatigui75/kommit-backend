# kommit-backend

API backend du projet Kommit, en Node.js, Express et TypeScript.

## Arborescence

Mettre à jour cette arborescence à chaque ajout, déplacement ou suppression de fichier ou de dossier dans le repo.

```
kommit-backend/
├── .claude/
│   ├── agents/            # subagents Claude Code
│   ├── hooks/
│   │   └── lint.sh        # hook Stop : lance pnpm lint
│   ├── rules/             # conventions du repo
│   ├── skills/            # skills Claude Code
│   └── settings.json      # branchement des hooks
├── .vscode/
│   └── settings.json
├── docs/
│   ├── TECH.md            # stack technique
│   ├── testing-strategy.md
│   └── workflow-ticket-backend.md
├── prisma/
│   ├── migrations/        # migrations Prisma
│   └── schema.prisma      # schéma Prisma : tables de Better Auth
├── src/
│   ├── index.ts           # démarrage du serveur
│   ├── app.ts             # assemblage de l'app Express
│   ├── config/
│   │   └── appConfig.ts   # port, nom, version, URL de la base, config Better Auth, origins du front
│   ├── middlewares/
│   │   ├── corsMiddleware.ts # whitelist des origins CORS, avec credentials
│   │   ├── errorHandler.ts   # erreur imprévue → 500 INTERNAL_ERROR
│   │   ├── notFound.ts
│   │   ├── validateBody.ts   # validation du corps → 400 ou res.locals.body
│   │   └── requireSession/
│   │       ├── requireSession.ts      # pas de session → 401 (monté en F2)
│   │       └── requireSession.test.ts
│   ├── routes/
│   │   ├── index.ts       # router principal
│   │   ├── authRoutes.ts  # /api/auth : routes de Better Auth
│   │   ├── dbHealthRoutes.ts
│   │   ├── healthRoutes.ts
│   │   └── rootRoutes.ts
│   ├── repositories/
│   │   ├── generated/     # client Prisma généré (ignoré par git)
│   │   ├── authClient.ts  # instance unique de Better Auth
│   │   ├── authRepository.ts # appels auth.api.*, cookies de session
│   │   ├── dbHealthRepository.ts
│   │   └── prismaClient.ts # instance unique du client Prisma
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── dbHealthController.ts
│   │   ├── healthController.ts
│   │   └── rootController.ts
│   ├── services/
│   │   ├── auth/
│   │   │   ├── authService.ts         # orchestrateur : appels d'auth + ré-emballage des erreurs
│   │   │   ├── signinValidation.ts    # validation du signin
│   │   │   ├── authErrorMapping/      # erreurs Better Auth / Prisma → ApiError
│   │   │   │   ├── authErrorMapping.ts
│   │   │   │   └── authErrorMapping.test.ts
│   │   │   └── signupValidation/      # validation du signup (schéma Zod)
│   │   │       ├── signupValidation.ts
│   │   │       └── signupValidation.test.ts
│   │   ├── dbHealth/
│   │   │   └── dbHealthService.ts
│   │   ├── health/
│   │   │   └── healthService.ts
│   │   └── root/
│   │       └── rootService.ts
│   └── types/
│       └── apiContract.ts # contrat de l'API, copie du front
├── testing/
│   ├── inventaire-KOM-06.md # classement des règles de KOM-06
│   └── smokes-KOM-06.md     # scénarios de test manuels de KOM-06
├── .env.example           # modèle des variables d'environnement
├── .gitignore
├── CLAUDE.md              # ce fichier
├── eslint.config.js       # ESLint : imports en @/ obligatoires
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml    # scripts d'installation autorisés
├── prisma.config.ts       # config de la CLI Prisma
├── tsconfig.json
└── vitest.config.ts       # config Vitest (alias @/ via vite-tsconfig-paths)
```
