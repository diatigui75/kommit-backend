import { z } from 'zod'
import type { ApiError, PostStandupBody } from '@/types/apiContract.js'

const categorySchema = z.array(z.string(), { error: 'Chaque catégorie du récap doit être une liste de textes.' })

export const summarySchema = z.object(
  { fait: categorySchema, blocages: categorySchema, prevu: categorySchema },
  { error: 'Le récap est invalide.' },
)

// z.object retire les champs inconnus : un `jour` envoyé par le client disparaît du corps validé (CA35).
const standupBodySchema = z.object({ summary: summarySchema }, { error: 'Le corps de la requête est invalide.' })

export type StandupValidation = { success: true; data: PostStandupBody } | { success: false; error: ApiError }

export const validateStandupBody = (body: unknown): StandupValidation => {
  const parsed = standupBodySchema.safeParse(body)

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
  }

  return { success: true, data: parsed.data }
}
