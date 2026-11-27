import type { ApiError, Message, StandupSummary } from '@/types/apiContract.js'
import type { LlmClient, LlmMessage } from '@/services/standup/llmClient.js'
import { SUMMARY_INSTRUCTION } from '@/services/standup/standupPrompts.js'
import { summarySchema } from '@/services/standup/standupValidation/standupValidation.js'

export type SummaryOutcome = { success: true; summary: StandupSummary } | { success: false; error: ApiError }

const SUMMARY_MALFORMED: ApiError = {
  code: 'SUMMARY_MALFORMED',
  message: "Le récap n'a pas pu être généré. Réessaie.",
}

const FORMAT_REMINDER =
  'Ta réponse précédente ne respectait pas la forme attendue. Réponds uniquement avec le JSON {"fait": string[], "blocages": string[], "prevu": string[]}.'

const parseSummary = (content: string | null): StandupSummary | null => {
  if (!content) return null
  try {
    const parsed = summarySchema.safeParse(JSON.parse(content))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

// Un seul retry, avec un rappel de la forme : une 2e sortie non conforme ne devient jamais un summary (CA29).
// Une erreur du provider n'est pas attrapée ici : l'appelant la traduit en événement error.
export const generateSummaryWithRetry = async (llm: LlmClient, messages: Message[]): Promise<SummaryOutcome> => {
  const request: LlmMessage[] = [{ role: 'system', content: SUMMARY_INSTRUCTION }, ...messages]

  const firstOutput = (await llm.complete(request)).choices[0]?.message.content ?? null
  const firstSummary = parseSummary(firstOutput)
  if (firstSummary) return { success: true, summary: firstSummary }

  const retryRequest: LlmMessage[] = [
    ...request,
    { role: 'assistant', content: firstOutput ?? '' },
    { role: 'user', content: FORMAT_REMINDER },
  ]
  const retrySummary = parseSummary((await llm.complete(retryRequest)).choices[0]?.message.content ?? null)
  if (retrySummary) return { success: true, summary: retrySummary }

  return { success: false, error: { ...SUMMARY_MALFORMED } }
}
