import type { Request, Response } from 'express'
import { getDbHealthStatus } from '@/services/dbHealth/dbHealthService.js'
import { dbHealthRepository } from '@/repositories/dbHealthRepository.js'

export const getDbHealth = async (_req: Request, res: Response) => {
  const dbHealth = await getDbHealthStatus(dbHealthRepository)

  res.status(dbHealth.status === 'ok' ? 200 : 503).json(dbHealth)
}
