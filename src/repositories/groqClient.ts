import Groq from 'groq-sdk'
import type { LlmClient } from '@/services/standup/llmClient.js'
import { appConfig } from '@/config/appConfig.js'

// Créé au premier appel : le constructeur de groq-sdk lève une erreur sans clé, et le serveur doit démarrer quand même.
let client: Groq | undefined
const groq = () => (client ??= new Groq({ apiKey: appConfig.groqApiKey, maxRetries: 1, timeout: 20_000 }))

export const groqLlmClient: LlmClient = {
  streamChat: (messages) => groq().chat.completions.create({ model: appConfig.groqModel, messages, stream: true }),
  // Le mode JSON de Groq évite les sorties entourées de texte ; il exige le mot « JSON » dans le prompt, que SUMMARY_INSTRUCTION contient.
  complete: (messages) =>
    groq().chat.completions.create({
      model: appConfig.groqModel,
      messages,
      response_format: { type: 'json_object' },
    }),
}
