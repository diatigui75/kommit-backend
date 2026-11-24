import type { IncomingHttpHeaders } from 'node:http'
import type { ApiError, Session } from '@/types/apiContract.js'
import type { SignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import type { SigninBody } from '@/services/auth/signinValidation.js'
import { toAuthApiError } from '@/services/auth/authErrorMapping/authErrorMapping.js'

// Ce que renvoie le fournisseur d'auth : la donnée, plus les cookies de session à poser.
export type AuthResult<T> = { data: T; cookies: string[] }

// Port : ce dont le service a besoin pour authentifier. Implémenté par repositories/authRepository.ts.
export type AuthRepository = {
  signUp: (body: SignupBody, headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
  signIn: (body: SigninBody, headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
  signOut: (headers: IncomingHttpHeaders) => Promise<AuthResult<null>>
  getSession: (headers: IncomingHttpHeaders) => Promise<AuthResult<Session>>
}

export type AuthOutcome<T> =
  | { success: true; data: T; cookies: string[] }
  | { success: false; error: ApiError }

const attempt = async <T>(call: () => Promise<AuthResult<T>>): Promise<AuthOutcome<T>> => {
  try {
    const { data, cookies } = await call()
    return { success: true, data, cookies }
  } catch (error) {
    const apiError = toAuthApiError(error)
    // Une panne n'est pas renvoyée brute au client : on la garde dans les logs.
    if (apiError.code === 'INTERNAL_ERROR') console.error(error)
    return { success: false, error: apiError }
  }
}

export const signUp = (repository: AuthRepository, body: SignupBody, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signUp(body, headers))

export const signIn = (repository: AuthRepository, body: SigninBody, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signIn(body, headers))

export const signOut = (repository: AuthRepository, headers: IncomingHttpHeaders) =>
  attempt(() => repository.signOut(headers))

export const readSession = (repository: AuthRepository, headers: IncomingHttpHeaders) =>
  attempt(() => repository.getSession(headers))
