import type {
  ApiError,
  GetCalendrierQuery,
  GetCalendrierResponse,
  GetTodayResponse,
  Jour,
  Standup,
  StandupSummary,
} from '@/types/apiContract.js'
import { parisDay } from '@/services/standup/standupDay/standupDay.js'

export type StandupRepository = {
  findByUserAndDay: (userId: string, jour: Jour) => Promise<Standup | null>
  upsertForDay: (userId: string, jour: Jour, summary: StandupSummary) => Promise<Standup>
  findInWindow: (userId: string, from: Jour, to: Jour) => Promise<Standup[]>
}

export type StandupOfDayOutcome = { success: true; data: Standup } | { success: false; error: ApiError }

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

export const getCalendrier = async (
  _repository: StandupRepository,
  _userId: string,
  _query: GetCalendrierQuery,
): Promise<GetCalendrierResponse> => null as unknown as GetCalendrierResponse

export const getStandupOfDay = async (
  _repository: StandupRepository,
  _userId: string,
  _jour: Jour,
): Promise<StandupOfDayOutcome> => null as unknown as StandupOfDayOutcome
