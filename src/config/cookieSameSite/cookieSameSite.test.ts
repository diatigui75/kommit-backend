import { describe, expect, test } from 'vitest'
import { parseCookieSameSite } from '@/config/cookieSameSite/cookieSameSite.js'

describe('lecture de COOKIE_SAME_SITE', () => {
  test.each([
    ['absente', undefined],
    ['vide', ''],
    ['faite d’espaces', '   '],
  ])('vaut none quand la variable est %s', (_case, rawCookieSameSite) => {
    expect(parseCookieSameSite(rawCookieSameSite)).toBe('none')
  })

  test.each([
    ['none', 'none'],
    ['lax', 'lax'],
    ['strict', 'strict'],
    [' Lax ', 'lax'],
    ['NONE', 'none'],
  ])('lit « %s » comme %s', (rawCookieSameSite, expectedCookieSameSite) => {
    expect(parseCookieSameSite(rawCookieSameSite)).toBe(expectedCookieSameSite)
  })

  test('refuse une valeur inconnue', () => {
    const unknownCookieSameSite = 'laxx'

    expect(() => parseCookieSameSite(unknownCookieSameSite)).toThrow('COOKIE_SAME_SITE invalide')
  })
})
