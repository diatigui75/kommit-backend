import { describe, expect, test } from 'vitest'
import { parisDay } from '@/services/standup/standupDay/standupDay.js'

describe('KOM-18 · 2. Le jour du standup, calculé en Europe/Paris', () => {
  describe('CA1, CA8, CA35 · jour civil de Paris, quel que soit le fuseau du serveur', () => {
    test.each([
      ['00h30 à Paris en été, encore la veille en UTC', '2026-07-14T22:30:00Z', '2026-07-15'],
      ['23h59 à Paris en été', '2026-07-15T21:59:00Z', '2026-07-15'],
      ['00h30 à Paris en hiver, encore la veille en UTC', '2026-01-14T23:30:00Z', '2026-01-15'],
      ['23h59 à Paris en hiver', '2026-01-15T22:59:00Z', '2026-01-15'],
      ['00h30 le jour du passage à l’heure d’été', '2026-03-28T23:30:00Z', '2026-03-29'],
      ['23h59 le jour du passage à l’heure d’été', '2026-03-29T21:59:00Z', '2026-03-29'],
      ['00h30 le jour du passage à l’heure d’hiver', '2026-10-24T22:30:00Z', '2026-10-25'],
      ['23h59 le jour du passage à l’heure d’hiver', '2026-10-25T22:59:00Z', '2026-10-25'],
      ['00h30 le 1er janvier, encore l’année précédente en UTC', '2026-12-31T23:30:00Z', '2027-01-01'],
      ['midi à Paris', '2026-07-15T10:00:00Z', '2026-07-15'],
    ])('à %s, rend le jour de Paris', (_case, instant, expectedParisDay) => {
      const now = new Date(instant)

      expect(parisDay(now)).toBe(expectedParisDay)
    })
  })

  test('rend le jour au format YYYY-MM-DD, mois et jour sur 2 chiffres', () => {
    const earlyMarchInParis = new Date('2026-03-05T08:00:00Z')

    expect(parisDay(earlyMarchInParis)).toBe('2026-03-05')
  })
})
