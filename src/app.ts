import express from 'express'
import { corsMiddleware } from '@/middlewares/corsMiddleware.js'
import { routes } from '@/routes/index.js'
import { notFound } from '@/middlewares/notFound.js'
import { errorHandler } from '@/middlewares/errorHandler.js'

export const app = express()

// Render place un proxy devant l'app : sans ça, toutes les requêtes ont son IP et partagent un seul compteur d'essais.
app.set('trust proxy', 1)
app.use(corsMiddleware)
app.use(express.json())
app.use(routes)
app.use(notFound)
app.use(errorHandler)
