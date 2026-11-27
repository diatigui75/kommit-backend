import type { ApiError, Message, StandupSummary } from '@/types/apiContract.js'
import type { LlmClient } from '@/services/standup/llmClient.js'

export type SummaryOutcome = { success: true; summary: StandupSummary } | { success: false; error: ApiError }

export const generateSummaryWithRetry = async (_llm: LlmClient, _messages: Message[]): Promise<SummaryOutcome> => ({
  success: false,
  error: { code: 'INTERNAL_ERROR', message: '' },
})
