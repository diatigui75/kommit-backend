import { Router } from 'express'
import { rootRoutes } from '@/routes/rootRoutes.js'
import { healthRoutes } from '@/routes/healthRoutes.js'
import { dbHealthRoutes } from '@/routes/dbHealthRoutes.js'
import { authRoutes } from '@/routes/authRoutes.js'
import { standupRoutes } from '@/routes/standupRoutes.js'

export const routes = Router()

routes.use('/', rootRoutes)
routes.use('/health', healthRoutes)
routes.use('/db-health', dbHealthRoutes)
routes.use('/api/auth', authRoutes)
routes.use('/standups', standupRoutes)
