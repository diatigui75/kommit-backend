import type { ApiError } from '@/types/apiContract.js'

// Stub KOM-06 : la logique (ré-emballage des erreurs Better Auth et Prisma) reste à écrire.

export const toAuthApiError = (_error: unknown): ApiError => ({ code: 'VALIDATION_ERROR', message: '' })
