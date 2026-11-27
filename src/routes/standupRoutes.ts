import { Router } from 'express'
import { getToday, postConversation, postStandup } from '@/controllers/standupController.js'
import { requireSession } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { validateStandupBody } from '@/services/standup/standupValidation/standupValidation.js'
import { validateConversationBody } from '@/services/standup/conversationValidation/conversationValidation.js'

export const standupRoutes = Router()

standupRoutes.use(requireSession)
standupRoutes.get('/today', getToday)
standupRoutes.post('/', validateBody(validateStandupBody), postStandup)
standupRoutes.post('/conversation', validateBody(validateConversationBody), postConversation)
