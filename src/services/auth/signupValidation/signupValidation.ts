import type { ApiError } from '@/types/apiContract.js'

// Stub KOM-06 : la logique (schéma Zod, trim + lowercase) reste à écrire.

export const PASSWORD_MIN_LENGTH = 0
export const PASSWORD_MAX_LENGTH = 0

export type SignupBody = {
  name: string
  email: string
  password: string
}

export type SignupValidation =
  | { success: true; data: SignupBody }
  | { success: false; error: ApiError }

export const validateSignupBody = (_body: unknown): SignupValidation => ({
  success: false,
  error: { code: 'INTERNAL_ERROR', message: '' },
})
