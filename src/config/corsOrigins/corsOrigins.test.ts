import { describe, expect, test } from 'vitest'
import { parseCorsOrigins } from '@/config/corsOrigins/corsOrigins.js'

const localhostOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
]

describe('KOM-27 · 2. Accès et authentification depuis un autre domaine', () => {
  describe('CA3 · lecture de la whitelist CORS_ORIGINS', () => {
    test('découpe la variable aux virgules', () => {
      const rawCorsOrigins = 'http://localhost:5173,https://kommit-frontend-diatigui-dev.vercel.app'

      expect(parseCorsOrigins(rawCorsOrigins)).toEqual([
        'http://localhost:5173',
        'https://kommit-frontend-diatigui-dev.vercel.app',
      ])
    })

    test('rend une seule origine quand la variable n’en contient qu’une', () => {
      const singleOrigin = 'https://kommit-frontend-diatigui-dev.vercel.app'

      expect(parseCorsOrigins(singleOrigin)).toEqual(['https://kommit-frontend-diatigui-dev.vercel.app'])
    })

    test('retire les espaces autour de chaque origine', () => {
      const originsWithSpaces = '  http://localhost:5173 ,   https://kommit-frontend-diatigui-dev.vercel.app  '

      expect(parseCorsOrigins(originsWithSpaces)).toEqual([
        'http://localhost:5173',
        'https://kommit-frontend-diatigui-dev.vercel.app',
      ])
    })

    test.each([
      ['une virgule finale', 'a, b,', ['a', 'b']],
      ['une virgule au début', ',a,b', ['a', 'b']],
      ['2 virgules consécutives', 'a,,b', ['a', 'b']],
      ['une entrée faite d’espaces seuls', 'a,   ,b', ['a', 'b']],
    ])('ignore les entrées vides : %s', (_case, rawCorsOrigins, expectedOrigins) => {
      expect(parseCorsOrigins(rawCorsOrigins)).toEqual(expectedOrigins)
    })

    test('garde l’ordre des origines de la variable', () => {
      const originsInOrder = 'https://c.example,https://a.example,https://b.example'

      expect(parseCorsOrigins(originsInOrder)).toEqual([
        'https://c.example',
        'https://a.example',
        'https://b.example',
      ])
    })

    test('retombe sur les origines localhost de Vite quand la variable est absente', () => {
      const missingCorsOrigins = undefined

      expect(parseCorsOrigins(missingCorsOrigins)).toEqual(localhostOrigins)
    })

    test('retombe sur les origines localhost de Vite quand la variable est vide', () => {
      const emptyCorsOrigins = ''

      expect(parseCorsOrigins(emptyCorsOrigins)).toEqual(localhostOrigins)
    })
  })
})
