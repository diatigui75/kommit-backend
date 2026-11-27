import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, Response } from 'express'
import type { Session } from '@/types/apiContract.js'

export type GetSession = (headers: IncomingHttpHeaders) => Promise<Session>

// Pose l'utilisateur dans res.locals.sessionUser, comme validateBody pose res.locals.body.
export const createRequireSession =
  (getSession: GetSession) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await getSession(req.headers)

    if (!session) {
      res.status(401).send()
      return
    }

    res.locals.sessionUser = session.user
    next()
  }
