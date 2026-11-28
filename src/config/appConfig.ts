import { readFileSync } from 'node:fs'
import { parseCookieSameSite } from '@/config/cookieSameSite/cookieSameSite.js'
import { parseFrontendOrigins } from '@/config/frontendOrigins/frontendOrigins.js'

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

const betterAuthUrl = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`

// En ligne (https), le repli sur localhost refuserait le front sans signal : /health resterait vert.
if (betterAuthUrl.startsWith('https://') && !process.env.FRONTEND_ORIGINS?.replaceAll(',', '').trim()) {
  throw new Error('FRONTEND_ORIGINS manquante : renseigne les origins du front dans les variables du service.')
}

const frontendOrigins = parseFrontendOrigins(process.env.FRONTEND_ORIGINS)

export const appConfig = {
  port,
  name: packageJson.name,
  version: packageJson.version,
  databaseUrl,
  betterAuthSecret,
  betterAuthUrl,
  frontendOrigins,
  // N'agit qu'en https. Lax quand le front et l'API partagent le même site (www et api.kommitapp.com), None sinon.
  cookieSameSite: parseCookieSameSite(process.env.COOKIE_SAME_SITE),
  // Optionnelle au démarrage : sans elle, seul le standup échoue (LLM_UNAVAILABLE), le reste de l'API tourne.
  groqApiKey: process.env.GROQ_API_KEY,
  // llama-3.3-70b-versatile n'est plus accessible sans contrat (« Contact Sales » sur console.groq.com, 2026-11-27).
  groqModel: process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b',
}
