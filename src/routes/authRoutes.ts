import { Router } from 'express'
import { getSession, postSignIn, postSignOut, postSignUp } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { signInRateLimit, signUpRateLimit } from '@/middlewares/authRateLimit.js'
import { validateSignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import { validateSigninBody } from '@/services/auth/signinValidation.js'

// Mêmes chemins que le handler de Better Auth : le contrat exclut les routes d'auth maison.
export const authRoutes = Router()

authRoutes.post('/sign-up/email', signUpRateLimit, validateBody(validateSignupBody), postSignUp)
authRoutes.post('/sign-in/email', signInRateLimit, validateBody(validateSigninBody), postSignIn)
authRoutes.post('/sign-out', postSignOut)
authRoutes.get('/get-session', getSession)
