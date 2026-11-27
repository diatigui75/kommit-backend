import { describe, expect, it } from 'vitest'
import type { GetCalendrierQuery, Jour, Standup, StandupSummary } from '@/types/apiContract.js'
import {
  type StandupRepository,
  getCalendrier,
  getStandupOfDay,
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
    findInWindow: async (owner, from, to) =>
      [...rows.entries()]
        .filter(([key, standup]) => key.startsWith(`${owner}|`) && standup.jour >= from && standup.jour <= to)
        .map(([, standup]) => standup)
        .sort((a, b) => a.jour.localeCompare(b.jour)),
  }
}

const failingStandupRepository = (databaseError: Error): StandupRepository => ({
  findByUserAndDay: async () => {
    throw databaseError
  },
  upsertForDay: async () => {
    throw databaseError
  },
  findInWindow: async () => {
    throw databaseError
  },
})

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

describe('KOM-21 · 1. Lecture du calendrier et du résumé', () => {
  const window: GetCalendrierQuery = { from: '2026-07-01', to: '2026-07-31' }

  describe('CA11, CA12 · jours renseignés de la fenêtre, sans les résumés', () => {
    it('renvoie les jours renseignés de la fenêtre au format YYYY-MM-DD', async () => {
      const repository = inMemoryStandupRepository([
        { userId, standup: standupOf('2026-07-03') },
        { userId, standup: standupOf('2026-07-15') },
      ])

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: 2, jours: ['2026-07-03', '2026-07-15'] })
    })

    it('inclut les jours posés exactement sur les bornes from et to', async () => {
      const repository = inMemoryStandupRepository([
        { userId, standup: standupOf('2026-07-01') },
        { userId, standup: standupOf('2026-07-31') },
      ])

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: 2, jours: ['2026-07-01', '2026-07-31'] })
    })

    it('ignore les jours renseignés hors de la fenêtre demandée', async () => {
      const repository = inMemoryStandupRepository([
        { userId, standup: standupOf('2026-06-30') },
        { userId, standup: standupOf('2026-07-10') },
        { userId, standup: standupOf('2026-08-01') },
      ])

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: 1, jours: ['2026-07-10'] })
    })

    it('ne transporte aucun résumé : chaque jour est une simple chaîne', async () => {
      const repository = inMemoryStandupRepository([{ userId, standup: standupOf('2026-07-15') }])

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: 1, jours: ['2026-07-15'] })
    })
  })

  describe('CA11 · compteur de la fenêtre', () => {
    it('renvoie un count égal au nombre de jours de la liste', async () => {
      const daysInJuly: Jour[] = ['2026-07-02', '2026-07-08', '2026-07-09', '2026-07-20']
      const repository = inMemoryStandupRepository(daysInJuly.map((jour) => ({ userId, standup: standupOf(jour) })))

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: daysInJuly.length, jours: daysInJuly })
    })

    it('compte la fenêtre demandée, pas tout l’historique', async () => {
      const daysInWindow: Jour[] = ['2026-07-06', '2026-07-07']
      const daysBeforeWindow: Jour[] = ['2026-05-04', '2026-05-05', '2026-06-01', '2026-06-29']
      const repository = inMemoryStandupRepository(
        [...daysBeforeWindow, ...daysInWindow].map((jour) => ({ userId, standup: standupOf(jour) })),
      )

      const calendrier = await getCalendrier(repository, userId, window)

      expect(calendrier).toEqual({ count: 2, jours: daysInWindow })
    })

    it('renvoie count 0 et une liste vide quand aucun jour de la fenêtre n’est renseigné', async () => {
      const emptyRepository = inMemoryStandupRepository()

      const calendrier = await getCalendrier(emptyRepository, userId, window)

      expect(calendrier).toEqual({ count: 0, jours: [] })
    })
  })

  describe('CA14 · résumé d’un jour', () => {
    it('renvoie le standup du jour demandé, résumé compris', async () => {
      const standupOfJuly15 = standupOf('2026-07-15')
      const repository = inMemoryStandupRepository([{ userId, standup: standupOfJuly15 }])

      const standupOutcome = await getStandupOfDay(repository, userId, '2026-07-15')

      expect(standupOutcome).toEqual({ success: true, data: standupOfJuly15 })
    })

    it('renvoie le standup du jour demandé et non celui d’un autre jour', async () => {
      const standupOfJuly14 = standupOf('2026-07-14', { fait: ['Hier'], blocages: [], prevu: [] })
      const standupOfJuly15 = standupOf('2026-07-15')
      const repository = inMemoryStandupRepository([
        { userId, standup: standupOfJuly14 },
        { userId, standup: standupOfJuly15 },
      ])

      const standupOutcome = await getStandupOfDay(repository, userId, '2026-07-14')

      expect(standupOutcome).toEqual({ success: true, data: standupOfJuly14 })
    })
  })
})

describe('KOM-21 · 2. Isolation et jour manquant', () => {
  const awaId = 'user-awa'
  const bobId = 'user-bob'
  const window: GetCalendrierQuery = { from: '2026-07-01', to: '2026-07-31' }

  describe('CA38 · calendrier scopé à la session', () => {
    it('ne renvoie que les jours de l’utilisateur de la session', async () => {
      const repository = inMemoryStandupRepository([
        { userId: awaId, standup: standupOf('2026-07-03') },
        { userId: bobId, standup: standupOf('2026-07-04') },
        { userId: bobId, standup: standupOf('2026-07-05') },
      ])

      const calendrierOfAwa = await getCalendrier(repository, awaId, window)

      expect(calendrierOfAwa).toEqual({ count: 1, jours: ['2026-07-03'] })
    })

    it('ignore un userId glissé dans la query et lit le calendrier de la session', async () => {
      const repository = inMemoryStandupRepository([
        { userId: awaId, standup: standupOf('2026-07-03') },
        { userId: bobId, standup: standupOf('2026-07-04') },
      ])
      const queryTargetingBob = { ...window, userId: bobId } as GetCalendrierQuery

      const calendrierOfAwa = await getCalendrier(repository, awaId, queryTargetingBob)

      expect(calendrierOfAwa).toEqual({ count: 1, jours: ['2026-07-03'] })
    })
  })

  describe('CA45 · jour sans standup', () => {
    it('répond STANDUP_NOT_FOUND quand le jour demandé n’a pas de standup', async () => {
      const emptyRepository = inMemoryStandupRepository()

      const standupOutcome = await getStandupOfDay(emptyRepository, awaId, '2026-07-15')

      expect(standupOutcome).toEqual({
        success: false,
        error: { code: 'STANDUP_NOT_FOUND', message: expect.any(String) },
      })
    })
  })

  describe('CA38, CA45 · jour d’autrui', () => {
    it('répond STANDUP_NOT_FOUND quand le jour demandé n’a de standup que chez un autre utilisateur', async () => {
      const repository = inMemoryStandupRepository([{ userId: bobId, standup: standupOf('2026-07-15') }])

      const standupOutcome = await getStandupOfDay(repository, awaId, '2026-07-15')

      expect(standupOutcome).toEqual({
        success: false,
        error: { code: 'STANDUP_NOT_FOUND', message: expect.any(String) },
      })
    })

    it('répond exactement la même chose que pour un jour vide, sans rien du standup d’autrui', async () => {
      const repository = inMemoryStandupRepository([{ userId: bobId, standup: standupOf('2026-07-15') }])
      const outcomeOnEmptyDay = await getStandupOfDay(repository, awaId, '2026-07-16')

      const outcomeOnBobsDay = await getStandupOfDay(repository, awaId, '2026-07-15')

      expect(outcomeOnEmptyDay).toEqual({
        success: false,
        error: { code: 'STANDUP_NOT_FOUND', message: expect.any(String) },
      })
      expect(outcomeOnBobsDay).toEqual(outcomeOnEmptyDay)
    })
  })
})

describe('KOM-21 · 3. Erreurs', () => {
  const databaseError = new Error('connect ECONNREFUSED 127.0.0.1:5432')
  const window: GetCalendrierQuery = { from: '2026-07-01', to: '2026-07-31' }

  describe('CA43, CA46 · une erreur de lecture reste distincte de « aucun standup »', () => {
    it('propage l’erreur de lecture du calendrier au lieu de renvoyer un calendrier vide', async () => {
      const repository = failingStandupRepository(databaseError)

      const calendrierReading = getCalendrier(repository, userId, window)

      await expect(calendrierReading).rejects.toBe(databaseError)
    })

    it('propage l’erreur de lecture d’un jour au lieu de répondre STANDUP_NOT_FOUND', async () => {
      const repository = failingStandupRepository(databaseError)

      const standupReading = getStandupOfDay(repository, userId, '2026-07-15')

      await expect(standupReading).rejects.toBe(databaseError)
    })
  })
})
