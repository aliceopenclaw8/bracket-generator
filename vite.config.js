import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const isPlugin = mode === 'plugin';

  return {
    base: isPlugin ? './' : '/bracket-generator/',
    plugins: [react(), tailwindcss()],
    build: isPlugin
      ? {
          outDir: 'wp-plugin/bracket-generator/dist',
          emptyOutDir: true,
          rollupOptions: {
            input: 'src/main.jsx',
            output: {
              inlineDynamicImports: true,
              entryFileNames: 'bracket-generator.js',
              assetFileNames: 'bracket-generator.[ext]',
            },
          },
        }
      : undefined,
  };
});
