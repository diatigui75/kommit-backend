// Les ports de développement de Vite : il prend le port suivant quand le précédent est déjà occupé.
const devFrontendOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
]

export function parseFrontendOrigins(rawFrontendOrigins: string | undefined): string[] {
  const frontendOrigins = (rawFrontendOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return frontendOrigins.length > 0 ? frontendOrigins : devFrontendOrigins
}
