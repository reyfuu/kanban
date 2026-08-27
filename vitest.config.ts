import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['{apps,packages,test}/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
})
