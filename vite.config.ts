import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deploy em vendas.liganer.com.br/comparador-preco/
export default defineConfig({
  plugins: [react()],
  base: '/comparador-preco/',
})
