import type { IncomingHttpHeaders } from 'node:http'
import { fromNodeHeaders } from 'better-auth/node'
import type { Session, SessionUser } from '@/types/apiContract.js'
import type { AuthRepository } from '@/services/auth/authService/authService.js'
import { auth } from '@/repositories/authClient.js'
import { prisma } from '@/repositories/prismaClient.js'

// Le token de session ne doit pas sortir dans le corps de la réponse.
const toSessionUser = ({ id, name, email }: SessionUser): SessionUser => ({ id, name, email })

export const authRepository: AuthRepository = {
  signUp: async ({ name, email, password }, headers) => {
    const { headers: responseHeaders, response } = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: fromNodeHeaders(headers),
      returnHeaders: true,
    })
    return { data: { user: toSessionUser(response.user) }, cookies: responseHeaders.getSetCookie() }
  },

  signIn: async ({ email, password }, headers) => {
    const { headers: responseHeaders, response } = await auth.api.signInEmail({
      body: { email, password },
      headers: fromNodeHeaders(headers),
      returnHeaders: true,
    })
    return { data: { user: toSessionUser(response.user) }, cookies: responseHeaders.getSetCookie() }
  },

  signOut: async (headers) => {
    const { headers: responseHeaders } = await auth.api.signOut({
      headers: fromNodeHeaders(headers),
      returnHeaders: true,
    })
    return { data: null, cookies: responseHeaders.getSetCookie() }
  },

  // Better Auth peut prolonger la session ou effacer un cookie expiré : on garde ses Set-Cookie.
  getSession: async (headers) => {
    const { headers: responseHeaders, response } = await auth.api.getSession({
      headers: fromNodeHeaders(headers),
      returnHeaders: true,
    })
    return {
      data: response ? { user: toSessionUser(response.user) } : null,
      cookies: responseHeaders.getSetCookie(),
    }
  },

  emailExists: async (email) => (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null,
}

// À brancher sur requireSession en F2.
export const getSessionFromHeaders = async (headers: IncomingHttpHeaders): Promise<Session> => (await authRepository.getSession(headers)).data
