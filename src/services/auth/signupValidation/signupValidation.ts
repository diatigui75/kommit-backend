import { z } from 'zod'
import type { ApiError } from '@/types/apiContract.js'

// Les mêmes valeurs servent à la config Better Auth (repositories/authClient.ts) et aux messages d'erreur.
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

// Le pipe fait passer trim et minuscules avant le contrôle du format (RM21).
export const emailSchema = z
  .string({ error: "L'email est requis." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "L'email n'est pas valide." }))

const signupSchema = z.object(
  {
    name: z.string({ error: 'Le prénom est requis.' }).trim().min(1, { error: 'Le prénom est requis.' }),
    email: emailSchema,
    password: z
      .string({ error: 'Le mot de passe est requis.' })
      .min(PASSWORD_MIN_LENGTH, {
        error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
      })
      .max(PASSWORD_MAX_LENGTH, {
        error: `Le mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères.`,
      }),
  },
  { error: 'Le corps de la requête est invalide.' },
)

export type SignupBody = z.infer<typeof signupSchema>

export type SignupValidation =
  | { success: true; data: SignupBody }
  | { success: false; error: ApiError }

export const validateSignupBody = (body: unknown): SignupValidation => {
  const parsed = signupSchema.safeParse(body)

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
  }

  return { success: true, data: parsed.data }
}
