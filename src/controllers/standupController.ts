import type { Request, Response } from 'express'
import type { PostConversationBody, PostStandupBody, SessionUser } from '@/types/apiContract.js'
import { getTodayStandup, saveStandup } from '@/services/standup/standupService/standupService.js'
import { streamConversation } from '@/services/standup/standupConversation/standupConversation.js'
import { standupRepository } from '@/repositories/standupRepository.js'
import { groqLlmClient } from '@/repositories/groqClient.js'

const sessionUserIdOf = (res: Response) => (res.locals.sessionUser as SessionUser).id

export const getToday = async (_req: Request, res: Response) => {
  res.json(await getTodayStandup(standupRepository, sessionUserIdOf(res), new Date()))
}

export const postStandup = async (_req: Request, res: Response) => {
  const { summary } = res.locals.body as PostStandupBody
  res.json(await saveStandup(standupRepository, sessionUserIdOf(res), summary, new Date()))
}

export const postConversation = async (_req: Request, res: Response) => {
  const { messages } = res.locals.body as PostConversationBody
  let clientGone = false
  res.on('close', () => {
    clientGone = true
  })

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()

  // Le client est vérifié AVANT de demander l'événement suivant : s'il est parti, le générateur est arrêté
  // et l'appel du récap à Groq n'est jamais lancé, ce qui épargne le quota de la clé (CA32).
  const events = streamConversation(groqLlmClient, messages)
  while (!clientGone) {
    const { done, value } = await events.next()
    if (done) break
    res.write(`data: ${JSON.stringify(value)}\n\n`)
  }
  await events.return(undefined)
  res.end()
}
