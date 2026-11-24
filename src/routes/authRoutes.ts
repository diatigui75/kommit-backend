import { Router } from 'express'
import { getSession, postSignIn, postSignOut, postSignUp } from '@/controllers/authController.js'
import { validateBody } from '@/middlewares/validateBody.js'
import { validateSignupBody } from '@/services/auth/signupValidation/signupValidation.js'
import { validateSigninBody } from '@/services/auth/signinValidation.js'

// Les chemins de Better Auth, sans nouvelle route d'auth.
export const authRoutes = Router()

authRoutes.post('/sign-up/email', validateBody(validateSignupBody), postSignUp)
authRoutes.post('/sign-in/email', validateBody(validateSigninBody), postSignIn)
authRoutes.post('/sign-out', postSignOut)
authRoutes.get('/get-session', getSession)
