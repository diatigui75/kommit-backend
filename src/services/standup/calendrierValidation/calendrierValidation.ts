import { z } from 'zod'
import type { ApiError, GetCalendrierQuery, Jour } from '@/types/apiContract.js'

// Un jour impossible comme 2026-02-30 passe le format, puis new Date le fait déborder sur le 2 mars :
// on vérifie donc que la date relue est bien celle qui a été écrite.
const isRealDay = (jour: string) => {
  const date = new Date(`${jour}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === jour
}

const jourSchema = z
  .string({ error: 'La date est requise.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'La date doit être au format AAAA-MM-JJ.' })
  .refine(isRealDay, { error: "La date n'existe pas." })

const calendrierQuerySchema = z.object({ from: jourSchema, to: jourSchema })
const jourParamsSchema = z.object({ jour: jourSchema })

type Validation<T> = { success: true; data: T } | { success: false; error: ApiError }

const validateWith =
  <T>(schema: z.ZodType<T>) =>
  (input: unknown): Validation<T> => {
    const parsed = schema.safeParse(input)

    if (!parsed.success) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
    }

    return { success: true, data: parsed.data }
  }

export const validateCalendrierQuery = validateWith<GetCalendrierQuery>(calendrierQuerySchema)
export const validateJourParams = validateWith<{ jour: Jour }>(jourParamsSchema)
