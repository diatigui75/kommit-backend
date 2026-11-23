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

export const appConfig = {
  port: Number(process.env.PORT ?? 3000),
  name: packageJson.name,
  version: packageJson.version,
  databaseUrl,
}
