import { describe, expect, it, test } from 'vitest'
import { APIConnectionError, APIConnectionTimeoutError, InternalServerError, RateLimitError } from 'groq-sdk'
import { toLlmApiError } from '@/services/standup/llmErrorMapping/llmErrorMapping.js'

// Formes relevées dans groq-sdk 1.6.0 (core/error.ts) : une réponse HTTP en erreur devient
// RateLimitError (429) ou InternalServerError (>= 500), avec un `status` ; un timeout devient
// APIConnectionTimeoutError et un provider injoignable APIConnectionError, sans `status`.
const groqErrorBody = (message: string) => ({ error: { message, type: 'error' } })

describe('KOM-18 · 4. CA31, CA32 · erreurs du provider LLM → ApiError', () => {
  it('traduit un quota Groq dépassé (429) en LLM_QUOTA_EXCEEDED', () => {
    const rateLimitError = new RateLimitError(429, groqErrorBody('Rate limit reached'), undefined, new Headers())

    expect(toLlmApiError(rateLimitError)).toEqual({
      code: 'LLM_QUOTA_EXCEEDED',
      message: expect.stringMatching(/\S/),
    })
  })

  test.each([500, 502, 503])('traduit une erreur %i du provider en LLM_UNAVAILABLE', (status) => {
    const serverError = new InternalServerError(status, groqErrorBody('Service unavailable'), undefined, new Headers())

    expect(toLlmApiError(serverError)).toEqual({ code: 'LLM_UNAVAILABLE', message: expect.stringMatching(/\S/) })
  })

  it('traduit un timeout en LLM_UNAVAILABLE', () => {
    const timeoutError = new APIConnectionTimeoutError()

    expect(toLlmApiError(timeoutError)).toEqual({ code: 'LLM_UNAVAILABLE', message: expect.stringMatching(/\S/) })
  })

  it('traduit un provider injoignable en LLM_UNAVAILABLE', () => {
    const connectionError = new APIConnectionError({ message: 'Connection error.' })

    expect(toLlmApiError(connectionError)).toEqual({ code: 'LLM_UNAVAILABLE', message: expect.stringMatching(/\S/) })
  })
})
