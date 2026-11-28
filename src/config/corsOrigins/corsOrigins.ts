// Les ports de développement de Vite : il prend le port suivant quand le précédent est déjà occupé.
const devFrontendOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
]

export function parseCorsOrigins(rawCorsOrigins: string | undefined): string[] {
  if (!rawCorsOrigins) return devFrontendOrigins

  return rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}
