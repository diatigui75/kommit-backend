import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/repositories/generated/prisma/client.js'
import { appConfig } from '@/config/appConfig.js'

// Sans délai maximal, pg attend indéfiniment une base injoignable et /db-health ne répondrait jamais.
const adapter = new PrismaPg({
  connectionString: appConfig.databaseUrl,
  connectionTimeoutMillis: 5000,
})

export const prisma = new PrismaClient({ adapter })
