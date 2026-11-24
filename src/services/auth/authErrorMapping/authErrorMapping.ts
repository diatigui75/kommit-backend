import type { ApiError } from '@/types/apiContract.js'

// Le service n'importe ni Better Auth ni Prisma : il reconnaît leurs erreurs à leur forme.

const EMAIL_ALREADY_EXISTS: ApiError = {
  code: 'EMAIL_ALREADY_EXISTS',
  message: 'Un compte avec cet email existe déjà',
}

const INVALID_CREDENTIALS: ApiError = {
  code: 'INVALID_CREDENTIALS',
  message: 'Email ou mot de passe incorrect.',
}

const INTERNAL_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue. Réessaie dans un instant.',
}

const betterAuthErrors = new Map<string, ApiError>([
  ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', EMAIL_ALREADY_EXISTS],
  ['INVALID_EMAIL_OR_PASSWORD', INVALID_CREDENTIALS],
])

const prismaErrors = new Map<string, ApiError>([['P2002', EMAIL_ALREADY_EXISTS]])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Forme d'un APIError de Better Auth : { name: 'APIError', body: { code, message } }.
const betterAuthCodeOf = (error: unknown): string | undefined => {
  if (!isObject(error) || error.name !== 'APIError' || !isObject(error.body)) return undefined
  return typeof error.body.code === 'string' ? error.body.code : undefined
}

// Forme d'une PrismaClientKnownRequestError : { name, code: 'P2002' }.
const prismaCodeOf = (error: unknown): string | undefined => {
  if (!isObject(error) || error.name !== 'PrismaClientKnownRequestError') return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

export const toAuthApiError = (error: unknown): ApiError => {
  const betterAuthCode = betterAuthCodeOf(error)
  const prismaCode = prismaCodeOf(error)

  const apiError =
    (betterAuthCode && betterAuthErrors.get(betterAuthCode)) ||
    (prismaCode && prismaErrors.get(prismaCode)) ||
    INTERNAL_ERROR

  return { ...apiError }
}
