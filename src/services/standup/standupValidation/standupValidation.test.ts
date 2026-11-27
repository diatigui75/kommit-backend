import { describe, expect, it, test } from 'vitest'
import { validateStandupBody } from '@/services/standup/standupValidation/standupValidation.js'

const validSummary = {
  fait: ['Fini la page de connexion'],
  blocages: [],
  prevu: ['Brancher le daily standup'],
}

const refusedForValidation = {
  success: false,
  error: { code: 'VALIDATION_ERROR', message: expect.stringMatching(/\S/) },
}

describe('KOM-18 · 2. Validation du corps de POST /standups', () => {
  describe('CA26 · le récap est validé sur sa forme (Zod)', () => {
    it('accepte un récap aux 3 catégories en listes de chaînes', () => {
      const validBody = { summary: validSummary }

      expect(validateStandupBody(validBody)).toEqual({ success: true, data: { summary: validSummary } })
    })

    it('accepte un récap dont les 3 catégories sont vides', () => {
      const bodyWithEmptySummary = { summary: { fait: [], blocages: [], prevu: [] } }

      expect(validateStandupBody(bodyWithEmptySummary)).toEqual({
        success: true,
        data: { summary: { fait: [], blocages: [], prevu: [] } },
      })
    })

    test.each(['fait', 'blocages', 'prevu'])('refuse un récap sans la catégorie %s', (missingCategory) => {
      const summaryWithMissingCategory = Object.fromEntries(
        Object.entries(validSummary).filter(([category]) => category !== missingCategory),
      )

      expect(validateStandupBody({ summary: summaryWithMissingCategory })).toEqual(refusedForValidation)
    })

    test.each([
      ['une chaîne au lieu d’une liste', { ...validSummary, fait: 'Fini la page de connexion' }],
      ['null au lieu d’une liste', { ...validSummary, blocages: null }],
      ['un item qui n’est pas une chaîne', { ...validSummary, prevu: [42] }],
    ])('refuse un récap avec %s', (_case, malformedSummary) => {
      expect(validateStandupBody({ summary: malformedSummary })).toEqual(refusedForValidation)
    })

    test.each([
      ['absent', undefined],
      ['null', null],
      ['un objet vide', {}],
      ['avec un récap en chaîne', { summary: '{"fait":[],"blocages":[],"prevu":[]}' }],
    ])('refuse un corps %s', (_case, malformedBody) => {
      expect(validateStandupBody(malformedBody)).toEqual(refusedForValidation)
    })
  })

  describe('CA35 · le corps ne porte pas de date : une date envoyée par le client est ignorée', () => {
    it('retire le champ jour du corps validé', () => {
      const bodyWithForcedDay = { summary: validSummary, jour: '2020-01-01' }

      expect(validateStandupBody(bodyWithForcedDay)).toEqual({ success: true, data: { summary: validSummary } })
    })
  })
})
