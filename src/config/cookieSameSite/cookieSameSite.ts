export type CookieSameSite = 'none' | 'lax' | 'strict'

const allowedSameSites: CookieSameSite[] = ['none', 'lax', 'strict']

export function parseCookieSameSite(rawCookieSameSite: string | undefined): CookieSameSite {
  const cookieSameSite = (rawCookieSameSite ?? '').trim().toLowerCase()

  if (!cookieSameSite) return 'none'

  const allowedSameSite = allowedSameSites.find((sameSite) => sameSite === cookieSameSite)

  if (!allowedSameSite) {
    throw new Error(`COOKIE_SAME_SITE invalide : « ${rawCookieSameSite} ». Valeurs possibles : none, lax, strict.`)
  }

  return allowedSameSite
}
