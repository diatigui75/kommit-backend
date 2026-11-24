import { app } from '@/app.js'
import { appConfig } from '@/config/appConfig.js'

app.listen(appConfig.port, () => {
  console.log(`kommit-backend écoute sur http://localhost:${appConfig.port}`)
})
