import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        playground: resolve(import.meta.dirname, 'playground.html'),
        levelEditor: resolve(import.meta.dirname, 'level-editor.html'),
        sandbox: resolve(import.meta.dirname, 'sandbox.html')
      }
    }
  }
});
