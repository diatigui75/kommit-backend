import type { GetTodayResponse, Jour, Standup, StandupSummary } from '@/types/apiContract.js'
import { parisDay } from '@/services/standup/standupDay/standupDay.js'

export type StandupRepository = {
  findByUserAndDay: (userId: string, jour: Jour) => Promise<Standup | null>
  upsertForDay: (userId: string, jour: Jour, summary: StandupSummary) => Promise<Standup>
}

export const getTodayStandup = async (
  repository: StandupRepository,
  userId: string,
  now: Date,
): Promise<GetTodayResponse> => {
  const standup = await repository.findByUserAndDay(userId, parisDay(now))
  return { done: standup !== null, standup }
}

export const saveStandup = (
  repository: StandupRepository,
  userId: string,
  summary: StandupSummary,
  now: Date,
): Promise<Standup> => repository.upsertForDay(userId, parisDay(now), summary)
