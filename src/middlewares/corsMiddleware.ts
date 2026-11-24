import cors from 'cors'
import { appConfig } from '@/config/appConfig.js'

// Une origine absente de la liste ne reçoit pas d'en-tête CORS,
// et c'est le navigateur qui bloque la réponse.
// credentials: true laisse le navigateur joindre le cookie de session aux requêtes du front.
export const corsMiddleware = cors({
  origin: appConfig.frontendOrigins,
  credentials: true,
})
