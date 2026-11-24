import cors from 'cors'
import { appConfig } from '@/config/appConfig.js'

export const corsMiddleware = cors({
  origin: appConfig.frontendOrigins,
  credentials: true,
})
