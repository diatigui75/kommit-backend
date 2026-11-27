import type { ApiError, PostStandupBody } from '@/types/apiContract.js'

export type StandupValidation = { success: true; data: PostStandupBody } | { success: false; error: ApiError }

export const validateStandupBody = (_body: unknown): StandupValidation => ({
  success: false,
  error: { code: 'INTERNAL_ERROR', message: '' },
})
