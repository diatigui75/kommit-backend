import type { NextFunction, Request, Response } from 'express'
import type { ApiError } from '@/types/apiContract.js'

type Validation<T> = { success: true; data: T } | { success: false; error: ApiError }

export const validateBody =
  <T>(validate: (body: unknown) => Validation<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    const validation = validate(req.body)

    if (!validation.success) {
      res.status(400).json(validation.error)
      return
    }

    res.locals.body = validation.data
    next()
  }
