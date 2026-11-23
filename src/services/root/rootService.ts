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
]

export const getServiceInfo = (): ServiceInfo => ({
  name: appConfig.name,
  version: appConfig.version,
  endpoints,
})
