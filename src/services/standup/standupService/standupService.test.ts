import { describe, expect, it } from 'vitest'
import type { Jour, Standup, StandupSummary } from '@/types/apiContract.js'
import {
  type StandupRepository,
  getTodayStandup,
  saveStandup,
} from '@/services/standup/standupService/standupService.js'

const userId = 'user-awa'

const summary: StandupSummary = {
  fait: ['Fini la page de connexion'],
  blocages: ['La CI est rouge sur dev'],
  prevu: ['Brancher le daily standup'],
}

const noonInParisOnJuly15 = new Date('2026-07-15T10:00:00Z')
const halfPastMidnightInParisOnJuly15 = new Date('2026-07-14T22:30:00Z')

const standupOf = (jour: Jour, standupSummary: StandupSummary = summary): Standup => ({
  id: `standup-${jour}`,
  jour,
  summary: standupSummary,
})

const inMemoryStandupRepository = (existing: Array<{ userId: string; standup: Standup }> = []): StandupRepository => {
  const rows = new Map(existing.map((row) => [`${row.userId}|${row.standup.jour}`, row.standup]))

  return {
    findByUserAndDay: async (owner, jour) => rows.get(`${owner}|${jour}`) ?? null,
    upsertForDay: async (owner, jour, standupSummary) => {
      const standup = standupOf(jour, standupSummary)
      rows.set(`${owner}|${jour}`, standup)
      return standup
    },
  }
}

describe('KOM-18 · 2. L’enregistrement du standup du jour', () => {
  describe('CA1, CA8 · état du standup du jour', () => {
    it('répond done: true avec le standup quand celui du jour existe', async () => {
      const standupOfJuly15 = standupOf('2026-07-15')
      const repository = inMemoryStandupRepository([{ userId, standup: standupOfJuly15 }])

      const todayState = await getTodayStandup(repository, userId, noonInParisOnJuly15)

      expect(todayState).toEqual({ done: true, standup: standupOfJuly15 })
    })

    it('répond done: false et standup: null quand aucun standup n’existe', async () => {
      const emptyRepository = inMemoryStandupRepository()

      const todayState = await getTodayStandup(emptyRepository, userId, noonInParisOnJuly15)

      expect(todayState).toEqual({ done: false, standup: null })
    })

    it('répond done: false quand seul le standup de la veille existe', async () => {
      const repository = inMemoryStandupRepository([{ userId, standup: standupOf('2026-07-14') }])

      const todayState = await getTodayStandup(repository, userId, noonInParisOnJuly15)

      expect(todayState).toEqual({ done: false, standup: null })
    })

    it('à 00h30 heure de Paris, lit le standup du jour de Paris et non celui du jour UTC', async () => {
      const standupOfJuly15 = standupOf('2026-07-15')
      const repository = inMemoryStandupRepository([
        { userId, standup: standupOf('2026-07-14') },
        { userId, standup: standupOfJuly15 },
      ])

      const todayState = await getTodayStandup(repository, userId, halfPastMidnightInParisOnJuly15)

      expect(todayState).toEqual({ done: true, standup: standupOfJuly15 })
    })
  })

  describe('CA26 · le récap enregistré est celui envoyé par le front, sans regénération', () => {
    it('renvoie le standup avec le récap reçu, à l’identique', async () => {
      const repository = inMemoryStandupRepository()

      const savedStandup = await saveStandup(repository, userId, summary, noonInParisOnJuly15)

      expect(savedStandup.summary).toEqual(summary)
    })

    it('transmet le récap tel quel au repository', async () => {
      const repository = inMemoryStandupRepository()

      await saveStandup(repository, userId, summary, noonInParisOnJuly15)

      expect(await repository.findByUserAndDay(userId, '2026-07-15')).toEqual(standupOf('2026-07-15', summary))
    })

    it('garde une catégorie vide en liste vide, sans y ajouter d’item « Aucun »', async () => {
      const summaryWithoutBlocker: StandupSummary = { fait: ['Revue de PR'], blocages: [], prevu: ['Tests du standup'] }
      const repository = inMemoryStandupRepository()

      const savedStandup = await saveStandup(repository, userId, summaryWithoutBlocker, noonInParisOnJuly15)

      expect(savedStandup.summary).toEqual({ fait: ['Revue de PR'], blocages: [], prevu: ['Tests du standup'] })
    })
  })

  describe('CA35 · daté du jour civil de Paris, calculé par le serveur', () => {
    it('date du jour de Paris un standup validé à midi', async () => {
      const repository = inMemoryStandupRepository()

      const savedStandup = await saveStandup(repository, userId, summary, noonInParisOnJuly15)

      expect(savedStandup.jour).toBe('2026-07-15')
    })

    it('date du jour civil de Paris un standup validé à 00h30, encore la veille en UTC', async () => {
      const repository = inMemoryStandupRepository()

      const savedStandup = await saveStandup(repository, userId, summary, halfPastMidnightInParisOnJuly15)

      expect(savedStandup.jour).toBe('2026-07-15')
    })

    it('rend le standup validé à 00h30 lisible comme standup du jour', async () => {
      const repository = inMemoryStandupRepository()
      await saveStandup(repository, userId, summary, halfPastMidnightInParisOnJuly15)

      const todayState = await getTodayStandup(repository, userId, noonInParisOnJuly15)

      expect(todayState).toEqual({ done: true, standup: standupOf('2026-07-15', summary) })
    })
  })
})
