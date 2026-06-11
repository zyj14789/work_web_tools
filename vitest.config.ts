import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@app': resolve(__dirname, 'app'),
      '@interface': resolve(__dirname, 'interface'),
      '@gui': resolve(__dirname, 'gui'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
