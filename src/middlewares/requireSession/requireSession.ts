import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, Response } from 'express'
import type { Session } from '@/types/apiContract.js'

export type GetSession = (headers: IncomingHttpHeaders) => Promise<Session>

// Pas encore monté sur une route : il sera branché sur GET /standups en F2 (RM2).
export const createRequireSession =
  (getSession: GetSession) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await getSession(req.headers)

    if (!session) {
      res.status(401).send()
      return
    }

    next()
  }
