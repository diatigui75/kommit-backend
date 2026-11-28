import { Router } from 'express'
import { getStandup, getStandups, getToday, postConversation, postStandup } from '@/controllers/standupController.js'
import { requireSession } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { validateParams, validateQuery } from '@/middlewares/validateInput.js'
import { validateStandupBody } from '@/services/standup/standupValidation/standupValidation.js'
import { validateConversationBody } from '@/services/standup/conversationValidation/conversationValidation.js'
import {
  validateCalendrierQuery,
  validateJourParams,
} from '@/services/standup/calendrierValidation/calendrierValidation.js'

export const standupRoutes = Router()

standupRoutes.use(requireSession)
standupRoutes.get('/', validateQuery(validateCalendrierQuery), getStandups)
// /today doit rester déclaré avant /:jour, sinon /:jour le capterait.
standupRoutes.get('/today', getToday)
standupRoutes.get('/:jour', validateParams(validateJourParams), getStandup)
standupRoutes.post('/', validateBody(validateStandupBody), postStandup)
standupRoutes.post('/conversation', validateBody(validateConversationBody), postConversation)
