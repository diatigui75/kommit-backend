import { z } from 'zod'
import type { ApiError } from '@/types/apiContract.js'
import { PASSWORD_MAX_LENGTH } from '@/services/auth/signupValidation/signupValidation.js'

// Better Auth ne retire pas les espaces de l'email au signin : sans cette normalisation,
// ' MARC@x.com ' serait refusé au lieu de connecter marc@x.com (RM21).
// Pas de contrôle de format ici : un email mal formé doit répondre INVALID_CREDENTIALS comme un mauvais
// mot de passe (RM13). Better Auth le refuse lui-même en INVALID_EMAIL, que le mapping traduit.
const signinSchema = z.object(
  {
    email: z
      .string({ error: "L'email est requis." })
      .trim()
      .toLowerCase()
      .min(1, { error: "L'email est requis." }),
    password: z
      .string({ error: 'Le mot de passe est requis.' })
      .min(1, { error: 'Le mot de passe est requis.' })
      .max(PASSWORD_MAX_LENGTH, {
        error: `Le mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères.`,
      }),
  },
  { error: 'Le corps de la requête est invalide.' },
)

export type SigninBody = z.infer<typeof signinSchema>

export type SigninValidation =
  | { success: true; data: SigninBody }
  | { success: false; error: ApiError }

export const validateSigninBody = (body: unknown): SigninValidation => {
  const parsed = signinSchema.safeParse(body)

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
  }

  return { success: true, data: parsed.data }
}
