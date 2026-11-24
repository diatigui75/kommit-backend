import { Router } from 'express'
import { getSession, postSignIn, postSignOut, postSignUp } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { validateSignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import { validateSigninBody } from '@/services/auth/signinValidation.js'

// Mêmes chemins que le handler de Better Auth : le contrat exclut les routes d'auth maison.
export const authRoutes = Router()

authRoutes.post('/sign-up/email', validateBody(validateSignupBody), postSignUp)
authRoutes.post('/sign-in/email', validateBody(validateSigninBody), postSignIn)
authRoutes.post('/sign-out', postSignOut)
authRoutes.get('/get-session', getSession)
