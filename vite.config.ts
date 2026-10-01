import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the same build works at a project URL like
  // joestrain.github.io/laptap/ and at the root of a custom domain. The game
  // has no client-side routes — only query params — so a relative base is safe.
  base: './',
  server: { port: 5188 },
  build: { target: 'es2022' },
});
