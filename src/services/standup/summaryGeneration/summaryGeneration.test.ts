import { describe, expect, it, test, vi } from 'vitest'
import type { ChatCompletion } from 'groq-sdk/resources/chat/completions'
import type { Message } from '@/types/apiContract.js'
import type { LlmClient } from '@/services/standup/llmClient.js'
import { SUMMARY_INSTRUCTION } from '@/services/standup/standupPrompts.js'
import { generateSummaryWithRetry } from '@/services/standup/summaryGeneration/summaryGeneration.js'

const conversation: Message[] = [
  { role: 'user', content: 'Hier j’ai fini la page de connexion' },
  { role: 'assistant', content: 'Bien. As-tu des blocages ?' },
  { role: 'user', content: 'Aucun' },
  { role: 'assistant', content: 'Et aujourd’hui ?' },
  { role: 'user', content: 'Je branche le daily standup' },
]

const summary = { fait: ['Fini la page de connexion'], blocages: [], prevu: ['Brancher le daily standup'] }
const validSummaryJson = JSON.stringify(summary)
const brokenJson = '{"fait": ["Fini la page de connexion"], "blocages": ['
const summaryJsonWithoutPrevu = JSON.stringify({ fait: summary.fait, blocages: summary.blocages })

// Forme d'une réponse non streamée de groq-sdk 1.6.0 : `message.content` peut être null.
const completionOf = (content: string | null): ChatCompletion => ({
  id: 'chatcmpl-summary',
  object: 'chat.completion',
  created: 1784102400,
  model: 'llama-3.3-70b-versatile',
  choices: [{ index: 0, finish_reason: 'stop', logprobs: null, message: { role: 'assistant', content } }],
})

const llmAnswering = (...contents: Array<string | null>) => {
  const complete = vi.fn<LlmClient['complete']>()
  contents.forEach((content) => complete.mockResolvedValueOnce(completionOf(content)))
  const llm: LlmClient = { streamChat: vi.fn<LlmClient['streamChat']>(), complete }
  return { llm, complete }
}

const malformedSummaryOutcome = {
  success: false,
  error: { code: 'SUMMARY_MALFORMED', message: expect.stringMatching(/\S/) },
}

describe('KOM-18 · 1. CA5 · production du récap en fin de conversation', () => {
  it('rend le récap en 3 catégories quand la sortie du LLM est conforme', async () => {
    const { llm } = llmAnswering(validSummaryJson)

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual({ success: true, summary })
  })

  it('garde une catégorie vide en liste vide', async () => {
    const summaryWithEmptyCategories = { fait: ['Revue de PR'], blocages: [], prevu: [] }
    const { llm } = llmAnswering(JSON.stringify(summaryWithEmptyCategories))

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual({ success: true, summary: { fait: ['Revue de PR'], blocages: [], prevu: [] } })
  })

  it('demande le récap avec SUMMARY_INSTRUCTION et tout le fil de la conversation', async () => {
    const { llm, complete } = llmAnswering(validSummaryJson)

    await generateSummaryWithRetry(llm, conversation)

    expect(complete).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ content: SUMMARY_INSTRUCTION }), ...conversation]),
    )
  })
})

describe('KOM-18 · 4. CA29 · récap non conforme : un seul retry, puis SUMMARY_MALFORMED', () => {
  it('n’appelle le LLM qu’une fois quand la première sortie est conforme', async () => {
    const { llm, complete } = llmAnswering(validSummaryJson)

    await generateSummaryWithRetry(llm, conversation)

    expect(complete).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['un JSON cassé', brokenJson],
    ['une catégorie manquante', summaryJsonWithoutPrevu],
  ])('rend le récap du retry quand la première sortie a %s', async (_case, malformedOutput) => {
    const { llm } = llmAnswering(malformedOutput, validSummaryJson)

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual({ success: true, summary })
  })

  it('répond SUMMARY_MALFORMED quand les 2 sorties sont des JSON cassés', async () => {
    const { llm } = llmAnswering(brokenJson, brokenJson)

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual(malformedSummaryOutcome)
  })

  it('répond SUMMARY_MALFORMED quand les 2 sorties ont une catégorie manquante', async () => {
    const { llm } = llmAnswering(summaryJsonWithoutPrevu, summaryJsonWithoutPrevu)

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual(malformedSummaryOutcome)
  })

  it('n’appelle le LLM que 2 fois, pas plus, quand les 2 sorties sont non conformes', async () => {
    const { llm, complete } = llmAnswering(brokenJson, brokenJson, validSummaryJson)

    await generateSummaryWithRetry(llm, conversation)

    expect(complete).toHaveBeenCalledTimes(2)
  })

  test.each([
    ['une catégorie en chaîne au lieu d’une liste', JSON.stringify({ ...summary, fait: 'Fini la page de connexion' })],
    ['un item qui n’est pas une chaîne', JSON.stringify({ ...summary, prevu: [42] })],
    ['une liste JSON au lieu d’un objet', JSON.stringify([summary])],
    ['du texte sans JSON', 'Voici ton récap : tu as fini la page de connexion.'],
    ['une chaîne vide', ''],
    ['un contenu null', null],
  ])('traite %s comme non conforme', async (_case, malformedOutput) => {
    const { llm } = llmAnswering(malformedOutput, malformedOutput)

    const summaryOutcome = await generateSummaryWithRetry(llm, conversation)

    expect(summaryOutcome).toEqual(malformedSummaryOutcome)
  })
})
