import { appConfig } from '@/config/appConfig.js'

type Endpoint = {
  method: string
  path: string
  description: string
}

export type ServiceInfo = {
  name: string
  version: string
  endpoints: Endpoint[]
}

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/',
    description: "Documentation d'entrée de l'API : nom du service, version et endpoints exposés.",
  },
  {
    method: 'GET',
    path: '/health',
    description: "État du process : statut, uptime en secondes et horodatage.",
  },
  {
    method: 'GET',
    path: '/db-health',
    description: 'État de la base de données : statut et latence en ms, 503 si elle est injoignable.',
  },
  {
    method: 'POST',
    path: '/api/auth/sign-up/email',
    description: 'Crée un compte (prénom, email, mot de passe) et connecte l’utilisateur.',
  },
  {
    method: 'POST',
    path: '/api/auth/sign-in/email',
    description: 'Connecte un utilisateur avec son email et son mot de passe.',
  },
  {
    method: 'POST',
    path: '/api/auth/sign-out',
    description: 'Ferme la session courante.',
  },
  {
    method: 'GET',
    path: '/api/auth/get-session',
    description: "L'utilisateur de la session courante, ou null.",
  },
]

export const getServiceInfo = (): ServiceInfo => ({
  name: appConfig.name,
  version: appConfig.version,
  endpoints,
})
