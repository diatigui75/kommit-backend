import type { IncomingHttpHeaders } from 'node:http'
import type { NextFunction, Request, Response } from 'express'
import type { Session } from '@/types/apiContract.js'

// Stub KOM-06 : la logique (pas de session → 401) reste à écrire.

// Port : lit la session à partir des en-têtes de la requête (le cookie). Branché sur Better Auth en prod.
export type GetSession = (headers: IncomingHttpHeaders) => Promise<Session>

export const createRequireSession =
  (_getSession: GetSession) =>
  async (_req: Request, _res: Response, _next: NextFunction): Promise<void> => {}
