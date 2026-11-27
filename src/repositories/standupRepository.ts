import type { Jour, Standup } from '@/types/apiContract.js'
import type { StandupRepository } from '@/services/standup/standupService/standupService.js'
import { prisma } from '@/repositories/prismaClient.js'

// La colonne est un DATE Postgres : Prisma le lit et l'écrit comme minuit UTC, donc le jour ne se décale jamais.
const toDate = (jour: Jour) => new Date(`${jour}T00:00:00.000Z`)
const toJour = (date: Date): Jour => date.toISOString().slice(0, 10)

type StandupRow = { id: string; jour: Date; fait: string[]; blocages: string[]; prevu: string[] }

const toStandup = ({ id, jour, fait, blocages, prevu }: StandupRow): Standup => ({
  id,
  jour: toJour(jour),
  summary: { fait, blocages, prevu },
})

export const standupRepository: StandupRepository = {
  findByUserAndDay: async (userId, jour) => {
    const row = await prisma.standup.findUnique({ where: { userId_jour: { userId, jour: toDate(jour) } } })
    return row ? toStandup(row) : null
  },

  // Upsert sur la contrainte UNIQUE (userId, jour) : une 2e validation du jour remplace la 1re (CA9).
  upsertForDay: async (userId, jour, summary) =>
    toStandup(
      await prisma.standup.upsert({
        where: { userId_jour: { userId, jour: toDate(jour) } },
        create: { userId, jour: toDate(jour), ...summary },
        update: summary,
      }),
    ),

  findInWindow: async () => [],
}
