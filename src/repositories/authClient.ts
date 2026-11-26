import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { appConfig } from '@/config/appConfig.js'
import { prisma } from '@/repositories/prismaClient.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/services/auth/signupValidation/signupValidation.js'

// Son handler n'est pas monté : les controllers appellent auth.api.* pour valider le corps avant lui et ré-emballer ses erreurs.
export const auth = betterAuth({
  appName: 'Kommit',
  baseURL: appConfig.betterAuthUrl,
  secret: appConfig.betterAuthSecret,
  trustedOrigins: appConfig.frontendOrigins,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    // RM8
    autoSignIn: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  // Vérifié dans better-auth 1.7.27 : Secure suit le https de baseURL, mais SameSite reste Lax, et un cookie Lax
  // n'est pas renvoyé par un front sur un autre domaine (KOM-11 RM4). En http local, None serait refusé sans Secure.
  advanced: appConfig.betterAuthUrl.startsWith('https://')
    ? { defaultCookieAttributes: { sameSite: 'none', secure: true } }
    : {},
})
