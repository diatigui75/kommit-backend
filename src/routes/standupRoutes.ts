import { Router } from 'express'
import { getStandup, getStandups, getToday, postConversation, postStandup } from '@/controllers/standupController.js'
import { requireSession } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { validateStandupBody } from '@/services/standup/standupValidation/standupValidation.js'
import { validateConversationBody } from '@/services/standup/conversationValidation/conversationValidation.js'

export const standupRoutes = Router()

standupRoutes.use(requireSession)
standupRoutes.get('/', getStandups)
// /today doit rester déclaré avant /:jour, sinon /:jour le capterait.
standupRoutes.get('/today', getToday)
standupRoutes.get('/:jour', getStandup)
standupRoutes.post('/', validateBody(validateStandupBody), postStandup)
standupRoutes.post('/conversation', validateBody(validateConversationBody), postConversation)
