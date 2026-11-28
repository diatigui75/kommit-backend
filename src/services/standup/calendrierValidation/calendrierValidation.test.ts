import { describe, expect, it, test } from 'vitest'
import {
  validateCalendrierQuery,
  validateJourParams,
} from '@/services/standup/calendrierValidation/calendrierValidation.js'

const refusedForValidation = {
  success: false,
  error: { code: 'VALIDATION_ERROR', message: expect.stringMatching(/\S/) },
}

describe('KOM-21 · validation des dates du calendrier', () => {
  describe('GET /standups?from&to', () => {
    it('accepte une fenêtre aux 2 bornes valides', () => {
      const julyWindow = { from: '2026-07-01', to: '2026-07-31' }

      expect(validateCalendrierQuery(julyWindow)).toEqual({ success: true, data: julyWindow })
    })

    it('accepte le 29 février d’une année bissextile', () => {
      const leapDayWindow = { from: '2028-02-29', to: '2028-02-29' }

      expect(validateCalendrierQuery(leapDayWindow)).toEqual({ success: true, data: leapDayWindow })
    })

    test.each([
      ['sans from', { to: '2026-07-31' }],
      ['sans to', { from: '2026-07-01' }],
      ['avec un from qui n’est pas une date', { from: 'pas-une-date', to: '2026-07-31' }],
      ['avec un to au mauvais format', { from: '2026-07-01', to: '31/07/2026' }],
      ['avec un from impossible (30 février)', { from: '2026-02-30', to: '2026-03-31' }],
      ['avec un to impossible (mois 13)', { from: '2026-07-01', to: '2026-13-01' }],
      ['avec un 29 février hors année bissextile', { from: '2026-02-29', to: '2026-03-31' }],
    ])('refuse une fenêtre %s', (_case, invalidQuery) => {
      expect(validateCalendrierQuery(invalidQuery)).toEqual(refusedForValidation)
    })
  })

  describe('GET /standups/:jour', () => {
    it('accepte un jour valide', () => {
      const july15 = { jour: '2026-07-15' }

      expect(validateJourParams(july15)).toEqual({ success: true, data: july15 })
    })

    test.each([
      ['qui n’est pas une date', 'pas-une-date'],
      ['impossible (30 février), qui déborderait sur le 2 mars', '2026-02-30'],
      ['impossible (jour 45)', '2026-07-45'],
      ['sans zéro devant le mois', '2026-7-15'],
    ])('refuse un jour %s', (_case, invalidJour) => {
      expect(validateJourParams({ jour: invalidJour })).toEqual(refusedForValidation)
    })
  })
})
