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

const STANDUP_NOT_FOUND: ApiError = {
  code: 'STANDUP_NOT_FOUND',
  message: "Aucun standup n'a été renseigné ce jour-là.",
}

// Le calendrier ne transporte que les jours, et count porte sur la fenêtre demandée (CA11, CA12).
export const getCalendrier = async (
  repository: StandupRepository,
  userId: string,
  { from, to }: GetCalendrierQuery,
): Promise<GetCalendrierResponse> => {
  const jours = (await repository.findInWindow(userId, from, to)).map((standup) => standup.jour)
  return { count: jours.length, jours }
}

// Le jour d'un autre utilisateur répond exactement comme un jour vide : rien ne trahit son existence (CA38, CA45).
export const getStandupOfDay = async (
  repository: StandupRepository,
  userId: string,
  jour: Jour,
): Promise<StandupOfDayOutcome> => {
  const standup = await repository.findByUserAndDay(userId, jour)
  return standup ? { success: true, data: standup } : { success: false, error: { ...STANDUP_NOT_FOUND } }
}
