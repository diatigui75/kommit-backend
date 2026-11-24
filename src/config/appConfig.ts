import { readFileSync } from 'node:fs'

type PackageJson = {
  name: string
  version: string
}

// Le chemin est le même depuis `src/config/` et depuis `dist/config/` après build.
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
) as PackageJson

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL manquante : renseigne-la dans .env (voir .env.example).')
}

const betterAuthSecret = process.env.BETTER_AUTH_SECRET

if (!betterAuthSecret) {
  throw new Error('BETTER_AUTH_SECRET manquante : renseigne-la dans .env (voir .env.example).')
}

const port = Number(process.env.PORT ?? 3000)

export const appConfig = {
  port,
  name: packageJson.name,
  version: packageJson.version,
  databaseUrl,
  betterAuthSecret,
  betterAuthUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  // Les ports de développement de Vite : il prend le port suivant quand le précédent est déjà occupé.
  frontendOrigins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
  ],
}
