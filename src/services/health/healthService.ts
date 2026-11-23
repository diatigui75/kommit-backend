export type HealthStatus = {
  status: 'ok'
  uptime: number
  timestamp: string
}

// Ne teste que le process Node. L'état de la base de données relève de /db-health.
export const getHealthStatus = (): HealthStatus => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
})
