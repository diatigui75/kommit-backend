import type { ApiError, PostConversationBody } from '@/types/apiContract.js'

export type ConversationValidation =
  | { success: true; data: PostConversationBody }
  | { success: false; error: ApiError }

export const validateConversationBody = (_body: unknown): ConversationValidation => ({
  success: false,
  error: { code: 'INTERNAL_ERROR', message: '' },
})
