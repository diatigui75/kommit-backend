import type { ApiError } from '@/types/apiContract.js'

// Le service n'importe pas groq-sdk : il reconnaît ses erreurs à leur `status` HTTP.
// Vérifié dans groq-sdk 1.6.0 : un timeout ou un provider injoignable n'a pas de `status`,
// et une coupure en plein flux remonte une erreur brute du fetch, sans `status` non plus.

const LLM_QUOTA_EXCEEDED: ApiError = {
  code: 'LLM_QUOTA_EXCEEDED',
  message: "Le quota de l'assistant est atteint pour le moment. Réessaie plus tard.",
}

const LLM_UNAVAILABLE: ApiError = {
  code: 'LLM_UNAVAILABLE',
  message: "L'assistant est indisponible pour le moment. Réessaie dans un instant.",
}

const INTERNAL_ERROR: ApiError = {
  code: 'INTERNAL_ERROR',
  message: 'Une erreur interne est survenue. Réessaie dans un instant.',
}

const statusOf = (error: unknown): number | undefined =>
  typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
    ? error.status
    : undefined

export const toLlmApiError = (error: unknown): ApiError => {
  const status = statusOf(error)

  if (status === 429) return { ...LLM_QUOTA_EXCEEDED }
  // Un autre 4xx (clé refusée, requête mal formée) vient de notre configuration, pas du provider.
  if (status !== undefined && status < 500) return { ...INTERNAL_ERROR }
  return { ...LLM_UNAVAILABLE }
}
