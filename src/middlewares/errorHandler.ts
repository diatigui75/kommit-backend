import type { NextFunction, Request, Response } from 'express'

// Express reconnaît un middleware d'erreur à ses 4 paramètres, d'où le _next inutilisé.
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Erreur interne du serveur' })
}
