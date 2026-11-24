import { fromNodeHeaders } from 'better-auth/node'
import type { SessionUser } from '@/types/apiContract.js'
import type { AuthRepository } from '@/services/auth/authService.js'
import type { GetSession } from '@/middlewares/requireSession/requireSession.js'
import { auth } from '@/repositories/authClient.js'

// Ne garde que les champs du contrat : ni token, ni session, ni champs internes de Better Auth.
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
}

// Implémentation réelle du port de requireSession, à brancher en F2.
export const getSessionFromHeaders: GetSession = async (headers) => (await authRepository.getSession(headers)).data
