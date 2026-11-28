import { configDefaults, defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // `pnpm build` compile aussi les *.test.ts dans dist/ : sans cette exclusion, la CI (build puis test) jouerait chaque test 2 fois.
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
})
