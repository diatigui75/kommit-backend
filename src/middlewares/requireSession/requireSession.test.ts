import { describe, expect, it, vi } from 'vitest'
import type { IncomingHttpHeaders } from 'node:http'
import type { Request, Response } from 'express'
import type { Session } from '@/types/apiContract.js'
import { createRequireSession } from '@/middlewares/requireSession/requireSession.js'

const sessionCookie = 'better-auth.session_token=abc123'

const marcSession: Session = {
  user: { id: 'user-1', name: 'Marc', email: 'marc@x.com' },
}

// Faux lecteur de session : ne reconnaît une session que si la requête porte le bon cookie.
const getSessionFromCookie = async (headers: IncomingHttpHeaders): Promise<Session> =>
  headers.cookie === sessionCookie ? marcSession : null

const createRequest = (headers: IncomingHttpHeaders) => ({ headers }) as Request

const createResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      response.statusCode = code
      return response
    },
    json(body: unknown) {
      response.body = body
      return response
    },
    send(body: unknown) {
      response.body = body
      return response
    },
  }
  return response
}

describe('KOM-06 · protection des routes', () => {
  describe('RM2 · route protégée sans session → 401', () => {
    it('répond 401 et bloque la route quand la requête n’a pas de cookie de session', async () => {
      const requireSession = createRequireSession(getSessionFromCookie)
      const requestWithoutCookie = createRequest({})
      const response = createResponse()
      const next = vi.fn()

      await requireSession(requestWithoutCookie, response as unknown as Response, next)

      expect({ statusCode: response.statusCode, routeReached: next.mock.calls.length > 0 }).toEqual({
        statusCode: 401,
        routeReached: false,
      })
    })

    it('répond 401 et bloque la route quand le cookie ne correspond à aucune session', async () => {
      const requireSession = createRequireSession(getSessionFromCookie)
      const requestWithUnknownCookie = createRequest({ cookie: 'better-auth.session_token=inconnu' })
      const response = createResponse()
      const next = vi.fn()

      await requireSession(requestWithUnknownCookie, response as unknown as Response, next)

      expect({ statusCode: response.statusCode, routeReached: next.mock.calls.length > 0 }).toEqual({
        statusCode: 401,
        routeReached: false,
      })
    })

    it('laisse passer vers la route quand la requête porte un cookie de session valide', async () => {
      const requireSession = createRequireSession(getSessionFromCookie)
      const requestWithSessionCookie = createRequest({ cookie: sessionCookie })
      const response = createResponse()
      const next = vi.fn()

      await requireSession(requestWithSessionCookie, response as unknown as Response, next)

      expect(next.mock.calls).toEqual([[]])
    })
  })
})
