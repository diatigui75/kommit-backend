import type { Message, SseEvent } from '@/types/apiContract.js'
import type { LlmClient } from '@/services/standup/llmClient.js'

export const streamConversation = (_llm: LlmClient, _messages: Message[]): AsyncIterable<SseEvent> => ({
  [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }),
})
