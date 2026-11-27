import type { ApiError } from '@/types/apiContract.js'

// Le service n'importe pas Better Auth : il reconnaît ses erreurs à leur forme.

export const EMAIL_ALREADY_EXISTS: ApiError = {
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
  // Levé par le signin de Better Auth sur un email mal formé : même réponse qu'un mauvais mot de passe (RM13).
  ['INVALID_EMAIL', INVALID_CREDENTIALS],
])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

// Forme d'un APIError de Better Auth : { name: 'APIError', body: { code, message } }.
const betterAuthCodeOf = (error: unknown): string | undefined => {
  if (!isObject(error) || error.name !== 'APIError' || !isObject(error.body)) return undefined
  return typeof error.body.code === 'string' ? error.body.code : undefined
}

// Vérifié dans better-auth 1.7.27 (api/routes/sign-up.mjs) : quand la création du compte échoue en base,
// y compris sur la contrainte d'unicité de l'email (P2002), Better Auth jette l'erreur Prisma et lève
// FAILED_TO_CREATE_USER à la place. Ce code seul ne dit donc pas si l'email était déjà pris.
export const isUserCreationFailure = (error: unknown): boolean => betterAuthCodeOf(error) === 'FAILED_TO_CREATE_USER'

export const toAuthApiError = (error: unknown): ApiError => {
  const betterAuthCode = betterAuthCodeOf(error)
  const apiError = (betterAuthCode && betterAuthErrors.get(betterAuthCode)) || INTERNAL_ERROR

  return { ...apiError }
}
