import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// vite-tsconfig-paths résout l'alias @/ de tsconfig.json pour Vitest.
export default defineConfig({
  plugins: [tsconfigPaths()],
})
