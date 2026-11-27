// Port du LLM, déclaré par le service. Les formes reprennent le sous-ensemble utile des types de
// groq-sdk 1.6.0 (ChatCompletionChunk, ChatCompletion) : le client Groq réel s'y branche sans conversion.
// Vérifié à la source : `delta.content` est optionnel et nullable (le dernier chunk porte `delta: {}`),
// `message.content` est nullable.

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LlmChunk = {
  choices: Array<{ delta: { content?: string | null } }>
}

export type LlmCompletion = {
  choices: Array<{ message: { content: string | null } }>
}

export type LlmClient = {
  streamChat: (messages: LlmMessage[]) => Promise<AsyncIterable<LlmChunk>>
  complete: (messages: LlmMessage[]) => Promise<LlmCompletion>
}
