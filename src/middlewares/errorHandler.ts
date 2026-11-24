import type { NextFunction, Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'

const internalError: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue. Réessaie dans un instant.',
}

// Express reconnaît un middleware d'erreur à ses 4 paramètres.
export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  // La réponse est déjà partie : seul le handler par défaut d'Express peut encore couper la connexion.
  if (res.headersSent) {
    next(err)
    return
  }

  console.error(err)
  res.status(500).json(internalError)
}
