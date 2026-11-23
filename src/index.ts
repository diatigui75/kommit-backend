import { app } from '@/app.js'
import { appConfig } from '@/config/appConfig.js'

// Par défaut : http://localhost:3000 (le port est défini dans config/appConfig.ts)
app.listen(appConfig.port, () => {
  console.log(`kommit-backend écoute sur http://localhost:${appConfig.port}`)
})
