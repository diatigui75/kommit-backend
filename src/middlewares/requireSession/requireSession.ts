import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, Response } from 'express'
import type { Session, SessionUser } from '@/types/apiContract.js'

export type GetSession = (headers: IncomingHttpHeaders) => Promise<Session>

const sessionUsers = new WeakMap<Request, SessionUser>()

// Pour un handler monté derrière requireSession : l'utilisateur de la session est toujours là.
export const sessionUserOf = (req: Request): SessionUser => sessionUsers.get(req)!

export const createRequireSession =
  (getSession: GetSession) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = await getSession(req.headers)

    if (!session) {
      res.status(401).send()
      return
    }

    sessionUsers.set(req, session.user)
    next()
  }
