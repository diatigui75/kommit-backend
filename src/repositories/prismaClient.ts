import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/repositories/generated/prisma/client.js'
import { appConfig } from '@/config/appConfig.js'

// Instance unique, partagée par tous les repositories.
const adapter = new PrismaPg({ connectionString: appConfig.databaseUrl })

export const prisma = new PrismaClient({ adapter })
