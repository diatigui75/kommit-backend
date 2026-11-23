import cors from 'cors'

// Les ports de développement de Vite : il prend le port suivant quand le précédent est déjà occupé.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
]

// Une origine absente de la liste ne reçoit pas d'en-tête CORS,
// et c'est le navigateur qui bloque la réponse.
export const corsMiddleware = cors({
  origin: allowedOrigins,
})
