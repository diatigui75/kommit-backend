import type { NextFunction, Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'

type Validation<T> = { success: true; data: T } | { success: false; error: ApiError }
type Validate<T> = (input: unknown) => Validation<T>

// Même contrat que validateBody, pour la query et les paramètres d'URL : 400 avant le handler,
// sinon les données validées dans res.locals.query ou res.locals.params.
const validateInput =
  (source: 'query' | 'params') =>
  <T>(validate: Validate<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const validation = validate(req[source])

    if (!validation.success) {
      res.status(400).json(validation.error)
      return
    }

    res.locals[source] = validation.data
    next()
  }

export const validateQuery = validateInput('query')
export const validateParams = validateInput('params')
