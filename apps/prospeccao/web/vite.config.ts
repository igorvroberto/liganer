import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Publicado em https://vendas.liganer.com.br/prospeccao/
export default defineConfig({
  plugins: [react()],
  base: '/prospeccao/',
})
