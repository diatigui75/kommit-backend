import { describe, expect, it, test } from 'vitest'
import { APIError } from 'better-auth/api'
import { Prisma } from '@/repositories/generated/prisma/client.js'
import { toAuthApiError } from '@/services/auth/authErrorMapping/authErrorMapping.js'

// Formes d'erreur relevées sur better-auth 1.7.27 et Prisma 7.10.1 (sonde réelle, 2026-11-24) :
// - Better Auth lève un APIError { status, statusCode, body: { code, message } } ;
// - Prisma lève un PrismaClientKnownRequestError { code, meta }.

const nonBlankMessage = expect.stringMatching(/\S/)

const createPrismaKnownError = (code: string, message: string) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: Prisma.prismaVersion.client,
    meta: { modelName: 'User' },
  })

describe('KOM-06 · ré-emballage des erreurs Better Auth et Prisma en ApiError', () => {
  describe('3. Unicité de l’email', () => {
    describe('RM9 · email déjà utilisé', () => {
      it('ré-emballe l’erreur Better Auth « utilisateur déjà existant » en EMAIL_ALREADY_EXISTS', () => {
        const userAlreadyExistsError = new APIError('UNPROCESSABLE_ENTITY', {
          code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
          message: 'User already exists. Use another email.',
        })

        expect(toAuthApiError(userAlreadyExistsError)).toEqual({
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Un compte avec cet email existe déjà',
        })
      })
    })
  })

  describe('4. Gestion des erreurs et pannes', () => {
    describe('RM13 · identifiants incorrects', () => {
      const betterAuthInvalidCredentialsMessage = 'Invalid email or password'

      it('ré-emballe l’erreur Better Auth « email ou mot de passe invalide » en INVALID_CREDENTIALS', () => {
        const invalidCredentialsError = new APIError('UNAUTHORIZED', {
          code: 'INVALID_EMAIL_OR_PASSWORD',
          message: betterAuthInvalidCredentialsMessage,
        })

        expect(toAuthApiError(invalidCredentialsError)).toEqual({
          code: 'INVALID_CREDENTIALS',
          message: nonBlankMessage,
        })
      })

      it('ne renvoie pas le message anglais brut de Better Auth', () => {
        const invalidCredentialsError = new APIError('UNAUTHORIZED', {
          code: 'INVALID_EMAIL_OR_PASSWORD',
          message: betterAuthInvalidCredentialsMessage,
        })

        const invalidCredentialsApiError = toAuthApiError(invalidCredentialsError)

        expect(invalidCredentialsApiError).toEqual({
          code: 'INVALID_CREDENTIALS',
          message: expect.not.stringContaining(betterAuthInvalidCredentialsMessage),
        })
      })
    })

    describe('RM18, RM19 · panne → INTERNAL_ERROR, distinct des erreurs métier', () => {
      const rawErrorMessage = 'connect ECONNREFUSED 127.0.0.1:5432'

      test.each([
        ['une erreur JavaScript quelconque', new Error(rawErrorMessage)],
        [
          'une erreur Better Auth 500',
          new APIError('INTERNAL_SERVER_ERROR', { code: 'INTERNAL_SERVER_ERROR', message: rawErrorMessage }),
        ],
        [
          'une erreur Better Auth au code non reconnu',
          new APIError('BAD_REQUEST', { code: 'FAILED_TO_CREATE_SESSION', message: rawErrorMessage }),
        ],
        ['une erreur Prisma connue (P2002)', createPrismaKnownError('P2002', rawErrorMessage)],
        [
          'une base injoignable (erreur d’initialisation Prisma)',
          new Prisma.PrismaClientInitializationError(rawErrorMessage, Prisma.prismaVersion.client, 'P1001'),
        ],
        ['une chaîne levée telle quelle', rawErrorMessage],
        ['une valeur undefined', undefined],
      ])('ré-emballe %s en INTERNAL_ERROR', (_case, unknownError) => {
        expect(toAuthApiError(unknownError)).toEqual({
          code: 'INTERNAL_ERROR',
          message: nonBlankMessage,
        })
      })

      it('ne laisse pas passer le message brut de l’erreur d’origine', () => {
        const rawError = new Error(rawErrorMessage)

        const internalApiError = toAuthApiError(rawError)

        expect(internalApiError).toEqual({
          code: 'INTERNAL_ERROR',
          message: expect.not.stringContaining(rawErrorMessage),
        })
      })
    })
  })
})
