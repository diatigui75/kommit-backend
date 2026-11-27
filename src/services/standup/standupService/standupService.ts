import type { GetTodayResponse, Jour, Standup, StandupSummary } from '@/types/apiContract.js'

export type StandupRepository = {
  findByUserAndDay: (userId: string, jour: Jour) => Promise<Standup | null>
  upsertForDay: (userId: string, jour: Jour, summary: StandupSummary) => Promise<Standup>
}

export const getTodayStandup = async (
  _repository: StandupRepository,
  _userId: string,
  _now: Date,
): Promise<GetTodayResponse> => ({ done: false, standup: null })

export const saveStandup = async (
  _repository: StandupRepository,
  _userId: string,
  _summary: StandupSummary,
  _now: Date,
): Promise<Standup> => ({ id: '', jour: '', summary: { fait: [], blocages: [], prevu: [] } })
