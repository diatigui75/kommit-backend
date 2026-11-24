import { describe, expect, it, test } from 'vitest'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateSignupBody,
} from '@/services/auth/signupValidation/signupValidation.js'

const validName = 'Marc'
const validEmail = 'marc@x.com'
const validPassword = 'motdepasse'

const refusedForValidation = {
  success: false,
  error: { code: 'VALIDATION_ERROR', message: expect.stringMatching(/\S/) },
}

describe('KOM-06 · validation du signup', () => {
  it('accepte un signup avec un prénom, un email et un mot de passe valides', () => {
    const validBody = { name: validName, email: validEmail, password: validPassword }

    const validation = validateSignupBody(validBody)

    expect(validation).toMatchObject({
      success: true,
      data: { email: validEmail, password: validPassword },
    })
  })

  describe('2. Valeurs refusées', () => {
    describe('RM10 · email mal formé', () => {
      test.each([
        ['sans @', 'marc.x.com'],
        ['sans domaine', 'marc@'],
        ['sans partie locale', '@x.com'],
        ['avec une espace au milieu', 'marc dupont@x.com'],
        ['vide', ''],
        ['composé uniquement d’espaces', '   '],
      ])('refuse un email %s', (_case, malformedEmail) => {
        const bodyWithMalformedEmail = { name: validName, email: malformedEmail, password: validPassword }

        expect(validateSignupBody(bodyWithMalformedEmail)).toEqual(refusedForValidation)
      })

      it('refuse un signup sans email', () => {
        const bodyWithoutEmail = { name: validName, password: validPassword }

        expect(validateSignupBody(bodyWithoutEmail)).toEqual(refusedForValidation)
      })
    })

    describe('RM10 · longueur du mot de passe (min 8, max 128, défaut Better Auth)', () => {
      it('fixe le minimum à 8 caractères', () => {
        const expectedPasswordMinLength = 8

        expect(PASSWORD_MIN_LENGTH).toBe(expectedPasswordMinLength)
      })

      it('fixe le maximum à 128 caractères', () => {
        const expectedPasswordMaxLength = 128

        expect(PASSWORD_MAX_LENGTH).toBe(expectedPasswordMaxLength)
      })

      it('refuse un mot de passe de 7 caractères', () => {
        const bodyWith7CharPassword = { name: validName, email: validEmail, password: 'a'.repeat(7) }

        expect(validateSignupBody(bodyWith7CharPassword)).toEqual(refusedForValidation)
      })

      it('accepte un mot de passe de 8 caractères', () => {
        const passwordOf8Chars = 'a'.repeat(8)
        const bodyWith8CharPassword = { name: validName, email: validEmail, password: passwordOf8Chars }

        expect(validateSignupBody(bodyWith8CharPassword)).toMatchObject({
          success: true,
          data: { email: validEmail, password: passwordOf8Chars },
        })
      })

      it('accepte un mot de passe de 128 caractères', () => {
        const passwordOf128Chars = 'a'.repeat(128)
        const bodyWith128CharPassword = { name: validName, email: validEmail, password: passwordOf128Chars }

        expect(validateSignupBody(bodyWith128CharPassword)).toMatchObject({
          success: true,
          data: { email: validEmail, password: passwordOf128Chars },
        })
      })

      it('refuse un mot de passe de 129 caractères', () => {
        const bodyWith129CharPassword = { name: validName, email: validEmail, password: 'a'.repeat(129) }

        expect(validateSignupBody(bodyWith129CharPassword)).toEqual(refusedForValidation)
      })

      it('refuse un signup sans mot de passe', () => {
        const bodyWithoutPassword = { name: validName, email: validEmail }

        expect(validateSignupBody(bodyWithoutPassword)).toEqual(refusedForValidation)
      })

      it('donne le minimum de 8 caractères dans le message d’un mot de passe trop court', () => {
        const bodyWithTooShortPassword = { name: validName, email: validEmail, password: 'a'.repeat(7) }

        expect(validateSignupBody(bodyWithTooShortPassword)).toEqual({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: expect.stringContaining('8') },
        })
      })
    })

    describe('RM11 · signup sans prénom', () => {
      it('refuse un signup sans prénom', () => {
        const bodyWithoutName = { email: validEmail, password: validPassword }

        expect(validateSignupBody(bodyWithoutName)).toEqual(refusedForValidation)
      })

      it('refuse un prénom vide', () => {
        const bodyWithEmptyName = { name: '', email: validEmail, password: validPassword }

        expect(validateSignupBody(bodyWithEmptyName)).toEqual(refusedForValidation)
      })
    })

    describe('RM20 · prénom composé uniquement d’espaces, refusé comme RM11', () => {
      test.each([
        ['des espaces', '   '],
        ['une tabulation et un retour à la ligne', '\t\n'],
      ])('refuse un prénom fait de %s', (_case, blankName) => {
        const bodyWithBlankName = { name: blankName, email: validEmail, password: validPassword }

        expect(validateSignupBody(bodyWithBlankName)).toEqual(refusedForValidation)
      })
    })

    describe('corps de requête absent ou mal typé', () => {
      test.each([
        ['absent', undefined],
        ['null', null],
        ['une chaîne', 'marc@x.com'],
        ['un objet vide', {}],
      ])('refuse un corps %s', (_case, malformedBody) => {
        expect(validateSignupBody(malformedBody)).toEqual(refusedForValidation)
      })
    })
  })

  describe('3. Unicité de l’email', () => {
    describe('RM21 · email normalisé avant stockage (minuscules, sans espaces autour)', () => {
      test.each([
        ['espaces autour et majuscules', ' MARC@x.com '],
        ['majuscules', 'Marc@X.COM'],
        ['espaces autour', '  marc@x.com  '],
      ])('normalise un email avec %s en "marc@x.com"', (_case, rawEmail) => {
        const bodyWithRawEmail = { name: validName, email: rawEmail, password: validPassword }

        expect(validateSignupBody(bodyWithRawEmail)).toMatchObject({
          success: true,
          data: { email: 'marc@x.com', password: validPassword },
        })
      })
    })
  })
})
