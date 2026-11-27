import type { IncomingHttpHeaders } from 'node:http'
import type { ApiError, Session } from '@/types/apiContract.js'
import type { SignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import type { SigninBody } from '@/services/auth/signinValidation.js'
import {
  EMAIL_ALREADY_EXISTS,
  isUserCreationFailure,
  toAuthApiError,
} from '@/services/auth/authErrorMapping/authErrorMapping.js'

export type AuthResult<T> = { data: T; cookies: string[] }

export type AuthRepository = {
  signUp: (body: SignupBody, headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
  signIn: (body: SigninBody, headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
  signOut: (headers: IncomingHttpHeaders) => Promise<AuthResult<null>>
  getSession: (headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
  emailExists: (email: string) => Promise<boolean>
}

export type AuthOutcome<T> =
  | { success: true; data: T; cookies: string[] }
  | { success: false; error: ApiError }

const attempt = async <T>(
  call: () => Promise<AuthResult<T>>,
  toApiError: (error: unknown) => Promise<ApiError> = async (error) => toAuthApiError(error),
): Promise<AuthOutcome<T>> => {
  try {
    const { data, cookies } = await call()
    return { success: true, data, cookies }
  } catch (error) {
    const apiError = await toApiError(error)
    if (apiError.code === 'INTERNAL_ERROR') console.error(error)
    return { success: false, error: apiError }
  }
}

// Double soumission : les 2 requêtes passent le contrôle d'unicité de Better Auth, la 2e échoue à l'insertion.
// Si le compte existe maintenant, c'est l'email qui était pris ; sinon, c'est une vraie panne.
const toSignUpApiError =
  (repository: AuthRepository, email: string) =>
  async (error: unknown): Promise<ApiError> => {
    if (!isUserCreationFailure(error)) return toAuthApiError(error)
    const emailTaken = await repository.emailExists(email).catch(() => false)
    return emailTaken ? { ...EMAIL_ALREADY_EXISTS } : toAuthApiError(error)
  }

export const signUp = (repository: AuthRepository, body: SignupBody, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signUp(body, headers), toSignUpApiError(repository, body.email))

export const signIn = (repository: AuthRepository, body: SigninBody, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signIn(body, headers))

export const signOut = (repository: AuthRepository, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signOut(headers))

export const readSession = (repository: AuthRepository, headers: IncomingHttpHeaders) =>
  attempt(() => repository.getSession(headers))
