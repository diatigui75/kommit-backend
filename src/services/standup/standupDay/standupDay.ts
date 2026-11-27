import type { Jour } from '@/types/apiContract.js'

// Le format en-CA rend directement YYYY-MM-DD ; le fuseau est fixé pour ne pas dépendre de celui du serveur (CI en UTC).
const parisDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const parisDay = (now: Date): Jour => parisDateFormat.format(now)
