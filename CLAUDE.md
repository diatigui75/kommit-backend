# kommit-backend

API backend du projet Kommit, en Node.js, Express et TypeScript.

## Arborescence

Mettre à jour cette arborescence à chaque ajout, déplacement ou suppression de fichier ou de dossier dans le repo.

```
kommit-backend/
├── .claude/
│   ├── agents/            # subagents Claude Code
│   ├── hooks/
│   │   ├── ci-fix.sh      # attend la CI d'une PR ; si rouge, lance un worker qui la corrige
│   │   ├── ci-watch.sh    # hook PostToolUse : après gh pr create, lance ci-fix.sh en arrière-plan
│   │   └── lint.sh        # hook Stop : lance pnpm lint
│   ├── rules/             # conventions du repo
│   ├── skills/            # skills Claude Code
│   └── settings.json      # branchement des hooks
├── .github/
│   └── workflows/
│       └── ci.yml         # CI : lint, typecheck, build, tests sur les PR vers dev et main
├── .vscode/
│   └── settings.json
├── docs/
│   ├── TECH.md            # stack technique
│   ├── testing-strategy.md
│   └── workflow-ticket-backend.md
├── prisma/
│   ├── migrations/        # migrations Prisma
│   └── schema.prisma      # schéma Prisma : tables de Better Auth et Standup
├── src/
│   ├── index.ts           # démarrage du serveur
│   ├── app.ts             # assemblage de l'app Express
│   ├── config/
│   │   ├── appConfig.ts   # port, nom, version, URL de la base, config Better Auth, origins du front
│   │   ├── cookieSameSite/ # lecture de COOKIE_SAME_SITE (none par défaut)
│   │   │   ├── cookieSameSite.ts
│   │   │   └── cookieSameSite.test.ts
│   │   └── frontendOrigins/ # lecture de FRONTEND_ORIGINS, repli sur localhost
│   │       ├── frontendOrigins.ts
│   │       └── frontendOrigins.test.ts
│   ├── middlewares/
│   │   ├── authRateLimit.ts  # 5 essais ratés par minute sur sign-in et sign-up → 429
│   │   ├── corsMiddleware.ts # whitelist des origins CORS, avec credentials
│   │   ├── errorHandler.ts   # erreur imprévue → 500 INTERNAL_ERROR
│   │   ├── notFound.ts
│   │   ├── validateBody.ts   # validation du corps → 400 ou res.locals.body
│   │   ├── validateInput.ts  # validation de la query et des paramètres → 400 ou res.locals.query / params
│   │   └── requireSession/
│   │       ├── requireSession.ts      # pas de session → 401, sinon res.locals.sessionUser
│   │       └── requireSession.test.ts
│   ├── routes/
│   │   ├── index.ts       # router principal
│   │   ├── authRoutes.ts  # /api/auth : routes de Better Auth
│   │   ├── dbHealthRoutes.ts
│   │   ├── healthRoutes.ts
│   │   ├── rootRoutes.ts
│   │   └── standupRoutes.ts # /standups : calendrier, jour, today, validation, conversation SSE (session requise)
│   ├── repositories/
│   │   ├── generated/     # client Prisma généré (ignoré par git)
│   │   ├── authClient.ts  # instance unique de Better Auth
│   │   ├── authRepository.ts # appels auth.api.*, cookies de session
│   │   ├── dbHealthRepository.ts
│   │   ├── groqClient.ts  # client Groq réel, implémente le port LlmClient
│   │   ├── prismaClient.ts # instance unique du client Prisma
│   │   └── standupRepository.ts # upsert du standup sur UNIQUE (userId, jour), lecture d'une fenêtre
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── dbHealthController.ts
│   │   ├── healthController.ts
│   │   ├── rootController.ts
│   │   └── standupController.ts # calendrier, jour, état du jour, validation, flux SSE
│   ├── services/
│   │   ├── auth/
│   │   │   ├── authService/           # orchestrateur : appels d'auth + ré-emballage des erreurs
│   │   │   │   ├── authService.ts
│   │   │   │   └── authService.test.ts
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
│   │   ├── root/
│   │   │   └── rootService.ts
│   │   └── standup/
│   │       ├── standupPrompts.ts      # prompt système, instruction de récap et marqueur de fin (fournis par KOM-18)
│   │       ├── llmClient.ts           # port du LLM, formes reprises de groq-sdk
│   │       ├── standupService/        # orchestrateur : état du jour, enregistrement, calendrier, standup d'un jour
│   │       │   ├── standupService.ts
│   │       │   └── standupService.test.ts
│   │       ├── standupDay/            # jour civil en Europe/Paris
│   │       │   ├── standupDay.ts
│   │       │   └── standupDay.test.ts
│   │       ├── standupValidation/     # validation du corps de POST /standups (schéma Zod)
│   │       │   ├── standupValidation.ts
│   │       │   └── standupValidation.test.ts
│   │       ├── calendrierValidation/  # validation des dates de GET /standups et /standups/:jour
│   │       │   ├── calendrierValidation.ts
│   │       │   └── calendrierValidation.test.ts
│   │       ├── conversationValidation/ # validation du corps de POST /standups/conversation
│   │       │   ├── conversationValidation.ts
│   │       │   └── conversationValidation.test.ts
│   │       ├── standupConversation/   # flux LLM → événements SSE, retrait du marqueur
│   │       │   ├── standupConversation.ts
│   │       │   └── standupConversation.test.ts
│   │       ├── summaryGeneration/     # récap JSON du LLM, retry unique
│   │       │   ├── summaryGeneration.ts
│   │       │   └── summaryGeneration.test.ts
│   │       └── llmErrorMapping/       # erreurs Groq → ApiError
│   │           ├── llmErrorMapping.ts
│   │           └── llmErrorMapping.test.ts
│   └── types/
│       └── apiContract.ts # contrat de l'API, copie du front
├── testing/
│   ├── inventaire-KOM-06.md # classement des règles de KOM-06
│   ├── inventaire-KOM-18.md # classement des règles de KOM-18
│   ├── inventaire-KOM-21.md # classement des règles de KOM-21
│   ├── inventaire-KOM-25.md # classement des règles de KOM-25
│   ├── inventaire-KOM-27.md # classement des règles de KOM-27
│   ├── smokes-KOM-06.md     # scénarios de test manuels de KOM-06
│   ├── smokes-KOM-18.md     # scénarios de test manuels de KOM-18
│   ├── smokes-KOM-21.md     # scénarios de test manuels de KOM-21
│   ├── smokes-KOM-25.md     # scénarios de test manuels de KOM-25
│   └── smokes-KOM-27.md     # scénarios de test manuels de KOM-27
├── .env.example           # modèle des variables d'environnement
├── .gitignore
├── .nvmrc                 # version de Node (CI et Render)
├── CLAUDE.md              # ce fichier
├── eslint.config.js       # ESLint : imports en @/ obligatoires
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml    # scripts d'installation autorisés
├── prisma.config.ts       # config de la CLI Prisma
├── render.yaml            # Blueprint Render : serveur backend de DEV (dev) et de PROD (main)
├── tsconfig.build.json    # config du build : tsconfig.json sans les tests
├── tsconfig.json
└── vitest.config.ts       # config Vitest (alias @/ via vite-tsconfig-paths)
```
