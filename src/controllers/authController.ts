import type { Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'
import type { SignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import type { SigninBody } from '@/services/auth/signinValidation.js'
import { type AuthOutcome, readSession, signIn, signOut, signUp } from '@/services/auth/authService/authService.js'
import { authRepository, getSessionFromHeaders } from '@/repositories/authRepository.js'
import { createRequireSession } from '@/middlewares/requireSession/requireSession.js'

const httpStatusOf: Partial<Record<ApiError['code'], number>> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  EMAIL_ALREADY_EXISTS: 409,
}

const reply = <T>(res: Response, outcome: AuthOutcome<T>) => {
  if (!outcome.success) {
    res.status(httpStatusOf[outcome.error.code] ?? 500).json(outcome.error)
    return
  }

  if (outcome.cookies.length > 0) res.append('Set-Cookie', outcome.cookies)
  res.json(outcome.data)
}

export const postSignUp = async (req: Request, res: Response) => {
  reply(res, await signUp(authRepository, res.locals.body as SignupBody, req.headers))
}

export const postSignIn = async (req: Request, res: Response) => {
  reply(res, await signIn(authRepository, res.locals.body as SigninBody, req.headers))
}

export const postSignOut = async (req: Request, res: Response) => {
  const outcome = await signOut(authRepository, req.headers)
  reply(res, outcome.success ? { ...outcome, data: { success: true } } : outcome)
}

export const getSession = async (req: Request, res: Response) => {
  reply(res, await readSession(authRepository, req.headers))
}

export const requireSession = createRequireSession(getSessionFromHeaders)
