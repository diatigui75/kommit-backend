import { z } from 'zod'
import type { ApiError, PostConversationBody } from '@/types/apiContract.js'

const messageSchema = z.object({
  role: z.enum(['user', 'assistant'], { error: 'Le fil de la conversation est invalide.' }),
  content: z.string({ error: 'Le fil de la conversation est invalide.' }),
})

// Le dernier message du fil est celui que l'utilisateur vient d'envoyer : c'est lui qui ne doit pas être blanc (CA39).
const conversationBodySchema = z.object(
  {
    messages: z
      .array(messageSchema, { error: 'Le fil de la conversation est invalide.' })
      .min(1, { error: 'Le message est requis.' })
      .refine((messages) => messages.at(-1)!.content.trim().length > 0, { error: 'Le message est requis.' }),
  },
  { error: 'Le corps de la requête est invalide.' },
)

export type ConversationValidation =
  | { success: true; data: PostConversationBody }
  | { success: false; error: ApiError }

export const validateConversationBody = (body: unknown): ConversationValidation => {
  const parsed = conversationBodySchema.safeParse(body)

  if (!parsed.success) {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } }
  }

  return { success: true, data: parsed.data }
}
