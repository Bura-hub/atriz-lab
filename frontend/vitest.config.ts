import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // El nucleo de rosbridge se prueba en Node, sin navegador y sin robot.
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
})
