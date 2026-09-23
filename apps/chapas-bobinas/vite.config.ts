import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedSrc = path.resolve(__dirname, '../../packages/shared/src')

// Deploy em vendas.liganer.com.br/orcamento/chapas-bobinas/
export default defineConfig({
  plugins: [react()],
  base: '/orcamento/chapas-bobinas/',
  resolve: {
    // Evita duas cópias de React (app + packages/shared/node_modules) — hooks quebram (página em branco).
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@liganer/shared/react': path.join(sharedSrc, 'react'),
      '@liganer/shared/saved-list.css': path.join(sharedSrc, 'react/saved-list.css'),
      '@liganer/shared': sharedSrc,
    },
  },
  server: {
    // Em dev, a planilha compartilhada vive no host de produção.
    proxy: {
      '/orcamento/tabelas': {
        target: 'https://vendas.liganer.com.br',
        changeOrigin: true,
      },
    },
  },
})
