import type { Request, Response } from 'express'
import { getHealthStatus } from '@/services/health/healthService.js'

export const getHealth = (_req: Request, res: Response) => {
  res.json(getHealthStatus())
}
