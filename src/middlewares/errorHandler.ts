import type { NextFunction, Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'

const invalidJson: ApiError = {
  code: 'VALIDATION_ERROR',
  message: "Le corps de la requête n'est pas un JSON valide.",
}

const internalError: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue. Réessaie dans un instant.',
}

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err)
    return
  }

  // express.json() signale un JSON mal formé par une erreur de type 'entity.parse.failed'.
  if ((err as { type?: unknown } | null)?.type === 'entity.parse.failed') {
    res.status(400).json(invalidJson)
    return
  }

  console.error(err)
  res.status(500).json(internalError)
}
