import { defineConfig } from 'vitest/config';

// Configuración separada de vite.config.ts para que los tests no carguen el plugin de la extensión.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
