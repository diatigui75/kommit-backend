import type { NextFunction, Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'

const internalError: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue. Réessaie dans un instant.',
}

export const errorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err)
    return
  }

  console.error(err)
  res.status(500).json(internalError)
}
