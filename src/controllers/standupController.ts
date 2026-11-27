import type { Request, Response } from 'express'
import type { PostConversationBody, PostStandupBody } from '@/types/apiContract.js'
import { getTodayStandup, saveStandup } from '@/services/standup/standupService/standupService.js'
import { streamConversation } from '@/services/standup/standupConversation/standupConversation.js'
import { standupRepository } from '@/repositories/standupRepository.js'
import { groqLlmClient } from '@/repositories/groqClient.js'
import { sessionUserOf } from '@/middlewares/requireSession/requireSession.js'

export const getToday = async (req: Request, res: Response) => {
  res.json(await getTodayStandup(standupRepository, sessionUserOf(req).id, new Date()))
}

export const postStandup = async (req: Request, res: Response) => {
  const { summary } = res.locals.body as PostStandupBody
  res.json(await saveStandup(standupRepository, sessionUserOf(req).id, summary, new Date()))
}

export const postConversation = async (_req: Request, res: Response) => {
  const { messages } = res.locals.body as PostConversationBody
  let clientGone = false
  res.on('close', () => {
    clientGone = true
  })

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()

  for await (const event of streamConversation(groqLlmClient, messages)) {
    if (clientGone) break
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  res.end()
}
