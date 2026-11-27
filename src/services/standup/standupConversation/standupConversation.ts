import type { Message, SseEvent } from '@/types/apiContract.js'
import type { LlmClient } from '@/services/standup/llmClient.js'
import { DONE_MARKER, SYSTEM_PROMPT } from '@/services/standup/standupPrompts.js'
import { generateSummaryWithRetry } from '@/services/standup/summaryGeneration/summaryGeneration.js'
import { toLlmApiError } from '@/services/standup/llmErrorMapping/llmErrorMapping.js'

// Longueur de la fin du texte qui pourrait être le début du marqueur : elle est retenue jusqu'au fragment suivant,
// car le marqueur peut arriver coupé sur plusieurs fragments.
const pendingMarkerPrefixLength = (text: string): number => {
  for (let length = Math.min(text.length, DONE_MARKER.length - 1); length > 0; length--) {
    if (DONE_MARKER.startsWith(text.slice(-length))) return length
  }
  return 0
}

export async function* streamConversation(llm: LlmClient, messages: Message[]): AsyncGenerator<SseEvent> {
  let pending = ''
  let reply = ''
  let markerReceived = false

  try {
    const stream = await llm.streamChat([{ role: 'system', content: SYSTEM_PROMPT }, ...messages])

    for await (const chunk of stream) {
      const fragment = chunk.choices[0]?.delta.content
      if (!fragment || markerReceived) continue

      pending += fragment
      const markerIndex = pending.indexOf(DONE_MARKER)
      if (markerIndex !== -1) markerReceived = true

      const releasable = markerReceived
        ? pending.slice(0, markerIndex)
        : pending.slice(0, pending.length - pendingMarkerPrefixLength(pending))
      pending = markerReceived ? '' : pending.slice(releasable.length)

      if (releasable) {
        reply += releasable
        yield { type: 'token', text: releasable }
      }
    }

    if (pending) {
      reply += pending
      yield { type: 'token', text: pending }
    }

    if (!markerReceived) return

    const summaryOutcome = await generateSummaryWithRetry(llm, [...messages, { role: 'assistant', content: reply }])
    yield summaryOutcome.success
      ? { type: 'summary', summary: summaryOutcome.summary }
      : { type: 'error', error: summaryOutcome.error }
  } catch (error) {
    const apiError = toLlmApiError(error)
    if (apiError.code === 'INTERNAL_ERROR') console.error(error)
    yield { type: 'error', error: apiError }
  }
}
