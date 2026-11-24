import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { appConfig } from '@/config/appConfig.js'
import { prisma } from '@/repositories/prismaClient.js'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/services/auth/signupValidation/signupValidation.js'

// Instance unique de Better Auth. On ne monte pas son handler : les controllers appellent auth.api.*
// (voir repositories/authRepository.ts), pour valider le corps avant lui et ré-emballer ses erreurs.
// Le cookie de session garde le SameSite=Lax par défaut.
export const auth = betterAuth({
  appName: 'Kommit',
  baseURL: appConfig.betterAuthUrl,
  secret: appConfig.betterAuthSecret,
  trustedOrigins: appConfig.frontendOrigins,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    // Connecte l'utilisateur dès le signup (RM8).
    autoSignIn: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
})
