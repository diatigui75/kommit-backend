import { rateLimit } from 'express-rate-limit'
import type { ApiError } from '@/types/apiContract.js'

const tooManyAttempts: ApiError = {
  code: 'TOO_MANY_ATTEMPTS',
  message: 'Trop de tentatives. Réessaie dans une minute.',
}

// Better Auth ne limite que les requêtes qui passent par son handler, pas les appels auth.api.* de nos controllers.
const createAuthRateLimit = () =>
  rateLimit({
    windowMs: 60_000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json(tooManyAttempts)
    },
  })

export const signInRateLimit = createAuthRateLimit()
export const signUpRateLimit = createAuthRateLimit()
