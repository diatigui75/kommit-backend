import { describe, expect, it, test, vi } from 'vitest'
import { APIConnectionTimeoutError, InternalServerError, RateLimitError } from 'groq-sdk'
import type { ChatCompletion, ChatCompletionChunk } from 'groq-sdk/resources/chat/completions'
import type { Message, SseEvent } from '@/types/apiContract.js'
import type { LlmClient } from '@/services/standup/llmClient.js'
import { DONE_MARKER, SYSTEM_PROMPT } from '@/services/standup/standupPrompts.js'
import { streamConversation } from '@/services/standup/standupConversation/standupConversation.js'

const history: Message[] = [
  { role: 'user', content: 'Hier j’ai fini la page de connexion' },
  { role: 'assistant', content: 'Bien. As-tu des blocages ?' },
  { role: 'user', content: 'Aucun, et aujourd’hui je branche le daily standup' },
]

const summary = { fait: ['Fini la page de connexion'], blocages: [], prevu: ['Brancher le daily standup'] }
const validSummaryJson = JSON.stringify(summary)
const brokenJson = '{"fait": ["Fini la page de connexion"], "blocages": ['

// Chunks typés sur groq-sdk 1.6.0 : `delta.content` est optionnel et nullable. La séquence (un chunk
// d'ouverture avec le rôle, puis un chunk final `delta: {}` avec finish_reason) suit ces types ;
// la séquence réelle du provider reste à confirmer au smoke.
const chunkOf = (
  delta: ChatCompletionChunk.Choice.Delta,
  finishReason: ChatCompletionChunk.Choice['finish_reason'] = null,
): ChatCompletionChunk => ({
  id: 'chatcmpl-stream',
  object: 'chat.completion.chunk',
  created: 1784102400,
  model: 'llama-3.3-70b-versatile',
  choices: [{ index: 0, delta, finish_reason: finishReason, logprobs: null }],
})

async function* groqStreamOf(fragments: string[]): AsyncGenerator<ChatCompletionChunk> {
  yield chunkOf({ role: 'assistant', content: '' })
  for (const fragment of fragments) yield chunkOf({ content: fragment })
  yield chunkOf({}, 'stop')
}

const completionOf = (content: string | null): ChatCompletion => ({
  id: 'chatcmpl-summary',
  object: 'chat.completion',
  created: 1784102400,
  model: 'llama-3.3-70b-versatile',
  choices: [{ index: 0, finish_reason: 'stop', logprobs: null, message: { role: 'assistant', content } }],
})

const llmWith = (stream: () => Promise<AsyncIterable<ChatCompletionChunk>>, ...summaryOutputs: string[]) => {
  const streamChat = vi.fn<LlmClient['streamChat']>(stream)
  const complete = vi.fn<LlmClient['complete']>()
  summaryOutputs.forEach((output) => complete.mockResolvedValueOnce(completionOf(output)))
  const llm: LlmClient = { streamChat, complete }
  return { llm, streamChat, complete }
}

const llmStreaming = (fragments: string[], ...summaryOutputs: string[]) =>
  llmWith(async () => groqStreamOf(fragments), ...summaryOutputs)

const collectEvents = async (events: AsyncIterable<SseEvent>): Promise<SseEvent[]> => {
  const collected: SseEvent[] = []
  for await (const event of events) collected.push(event)
  return collected
}

const tokenTexts = (events: SseEvent[]) => events.flatMap((event) => (event.type === 'token' ? [event.text] : []))

const summaryEvents = (events: SseEvent[]) => events.filter((event) => event.type === 'summary')

describe('KOM-18 · 1. La conversation avec l’IA, en streaming', () => {
  describe('CA2, CA4 · réponse de Groq relayée au fil de l’eau en événements token', () => {
    it('relaie chaque fragment en un événement token, dans l’ordre, sans token vide', async () => {
      const { llm } = llmStreaming(['Bonjour Awa,', ' qu’as-tu', ' fait hier ?'])

      const events = await collectEvents(streamConversation(llm, history))

      expect(events).toEqual([
        { type: 'token', text: 'Bonjour Awa,' },
        { type: 'token', text: ' qu’as-tu' },
        { type: 'token', text: ' fait hier ?' },
      ])
    })

    it('émet le premier token avant que le LLM ait fini de répondre', async () => {
      const restOfAnswerNeverComes = new Promise<void>(() => {})
      const { llm } = llmWith(async () =>
        (async function* () {
          yield chunkOf({ content: 'Bonjour' })
          await restOfAnswerNeverComes
          yield chunkOf({ content: ' Awa' })
        })(),
      )
      const events = streamConversation(llm, history)[Symbol.asyncIterator]()

      const firstEvent = await events.next()

      expect(firstEvent).toEqual({ done: false, value: { type: 'token', text: 'Bonjour' } })
    })

    it('envoie au LLM le prompt système puis tout l’historique reçu', async () => {
      const { llm, streamChat } = llmStreaming(['Et tes blocages ?'])

      await collectEvents(streamConversation(llm, history))

      expect(streamChat).toHaveBeenCalledWith([{ role: 'system', content: SYSTEM_PROMPT }, ...history])
    })

    describe('le marqueur de fin n’apparaît jamais dans les tokens', () => {
      test.each([
        ['dans un fragment à part', ['Merci, ', 'bonne journée !', ` ${DONE_MARKER}`]],
        ['collé à la fin du texte', ['Merci, ', `bonne journée !${DONE_MARKER}`]],
        ['coupé sur 2 fragments', ['Merci, bonne journée ! [[STANDUP_', 'COMPLETE]]']],
        ['coupé sur 3 fragments', ['Merci, bonne journée ! [', '[STANDUP_COMP', 'LETE]]']],
      ])('retire le marqueur %s', async (_case, fragments) => {
        const { llm } = llmStreaming(fragments, validSummaryJson)

        const events = await collectEvents(streamConversation(llm, history))

        expect(tokenTexts(events).join('').trimEnd()).toBe('Merci, bonne journée !')
      })

      test.each([
        ['des crochets simples', ['Note [1] : ', 'as-tu des blocages ?']],
        ['un crochet en fin de fragment qui n’ouvre pas le marqueur', ['Ta tâche [', 'KOM-18] avance ?']],
      ])('laisse intact un texte avec %s', async (_case, fragments) => {
        const { llm } = llmStreaming(fragments)

        const events = await collectEvents(streamConversation(llm, history))

        expect(tokenTexts(events).join('')).toBe(fragments.join(''))
      })
    })
  })

  describe('CA5 · fin de conversation, événement summary', () => {
    it('émet un seul événement summary, en dernier, quand le marqueur arrive', async () => {
      const { llm } = llmStreaming(['Merci, bonne journée !', ` ${DONE_MARKER}`], validSummaryJson)

      const events = await collectEvents(streamConversation(llm, history))

      expect(summaryEvents(events)).toHaveLength(1)
      expect(events.at(-1)).toEqual({ type: 'summary', summary })
    })

    it('émet les tokens de la réponse avant le summary', async () => {
      const { llm } = llmStreaming(['Merci, bonne journée !', ` ${DONE_MARKER}`], validSummaryJson)

      const events = await collectEvents(streamConversation(llm, history))

      expect(events[0]).toEqual({ type: 'token', text: 'Merci, bonne journée !' })
    })

    it('n’émet pas de summary tant que le marqueur n’est pas arrivé', async () => {
      const { llm } = llmStreaming(['Qu’as-tu prévu aujourd’hui ?'], validSummaryJson)

      const events = await collectEvents(streamConversation(llm, history))

      expect(summaryEvents(events)).toEqual([])
    })
  })
})

describe('KOM-18 · 4. Les erreurs du flux', () => {
  describe('CA29 · récap non conforme après le retry', () => {
    it('émet SUMMARY_MALFORMED et jamais de summary quand les 2 sorties sont non conformes', async () => {
      const { llm } = llmStreaming(['Merci, bonne journée !', ` ${DONE_MARKER}`], brokenJson, brokenJson)

      const events = await collectEvents(streamConversation(llm, history))

      expect(summaryEvents(events)).toEqual([])
      expect(events.at(-1)).toEqual({
        type: 'error',
        error: { code: 'SUMMARY_MALFORMED', message: expect.stringMatching(/\S/) },
      })
    })

    it('émet le summary du retry quand seule la première sortie est non conforme', async () => {
      const { llm } = llmStreaming(['Merci, bonne journée !', ` ${DONE_MARKER}`], brokenJson, validSummaryJson)

      const events = await collectEvents(streamConversation(llm, history))

      expect(events.at(-1)).toEqual({ type: 'summary', summary })
    })
  })

  describe('CA31, CA32 · erreur du provider, émise en événement error au lieu d’un code HTTP', () => {
    it('émet LLM_QUOTA_EXCEEDED quand Groq refuse la requête pour quota dépassé (429)', async () => {
      const rateLimitError = new RateLimitError(429, { error: { message: 'Rate limit reached' } }, undefined, new Headers())
      const { llm } = llmWith(async () => {
        throw rateLimitError
      })

      const events = await collectEvents(streamConversation(llm, history))

      expect(events).toEqual([
        { type: 'error', error: { code: 'LLM_QUOTA_EXCEEDED', message: expect.stringMatching(/\S/) } },
      ])
    })

    it('émet LLM_UNAVAILABLE quand Groq est indisponible (503)', async () => {
      const unavailableError = new InternalServerError(503, { error: { message: 'Service unavailable' } }, undefined, new Headers())
      const { llm } = llmWith(async () => {
        throw unavailableError
      })

      const events = await collectEvents(streamConversation(llm, history))

      expect(events).toEqual([
        { type: 'error', error: { code: 'LLM_UNAVAILABLE', message: expect.stringMatching(/\S/) } },
      ])
    })

    it('garde les tokens déjà émis puis émet LLM_UNAVAILABLE quand le flux tombe en timeout', async () => {
      const { llm } = llmWith(async () =>
        (async function* () {
          yield chunkOf({ content: 'Bonjour' })
          throw new APIConnectionTimeoutError()
        })(),
      )

      const events = await collectEvents(streamConversation(llm, history))

      expect(events).toEqual([
        { type: 'token', text: 'Bonjour' },
        { type: 'error', error: { code: 'LLM_UNAVAILABLE', message: expect.stringMatching(/\S/) } },
      ])
    })

    it('émet LLM_QUOTA_EXCEEDED et pas de summary quand l’appel de récap dépasse le quota', async () => {
      const rateLimitError = new RateLimitError(429, { error: { message: 'Rate limit reached' } }, undefined, new Headers())
      const { llm, complete } = llmStreaming(['Merci, bonne journée !', ` ${DONE_MARKER}`])
      complete.mockRejectedValue(rateLimitError)

      const events = await collectEvents(streamConversation(llm, history))

      expect(summaryEvents(events)).toEqual([])
      expect(events.at(-1)).toEqual({
        type: 'error',
        error: { code: 'LLM_QUOTA_EXCEEDED', message: expect.stringMatching(/\S/) },
      })
    })
  })
})
