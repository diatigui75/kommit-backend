import type { ApiError } from '@/types/apiContract.js'

export const toLlmApiError = (_error: unknown): ApiError => ({ code: 'INTERNAL_ERROR', message: '' })
