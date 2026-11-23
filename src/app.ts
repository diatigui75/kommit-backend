import express from 'express'
import { routes } from '@/routes/index.js'
import { notFound } from '@/middlewares/notFound.js'
import { errorHandler } from '@/middlewares/errorHandler.js'

export const app = express()

app.use(express.json())
app.use(routes)
app.use(notFound)
app.use(errorHandler)
