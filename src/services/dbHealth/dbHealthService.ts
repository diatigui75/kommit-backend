export type DbHealthRepository = {
  ping: () => Promise<void>
}

export type DbHealthStatus =
  | { status: 'ok'; latencyMs: number }
  | { status: 'unavailable' }

export const getDbHealthStatus = async (repository: DbHealthRepository): Promise<DbHealthStatus> => {
  const start = performance.now()

  try {
    await repository.ping()
  } catch {
    return { status: 'unavailable' }
  }

  return { status: 'ok', latencyMs: Math.round(performance.now() - start) }
}
