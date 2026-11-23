import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// La CLI Prisma ne lit pas .env toute seule. En local on le charge, en prod les variables viennent de l'hébergeur.
if (existsSync('.env')) process.loadEnvFile()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
