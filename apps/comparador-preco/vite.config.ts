import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sharedSrc = path.resolve(__dirname, '../../packages/shared/src')

/** Mock do login compartilhado só no `vite`/`preview` local (produção usa /auth/me.php real). */
function mockVendasAuth(): Plugin {
  const mockUser = {
    ok: true,
    user: {
      id: 'dev-local',
      email: 'dev@liganer.local',
      name: 'Dev Local',
    },
  }
  const handle = (
    req: { url?: string; method?: string },
    res: { setHeader: (k: string, v: string) => void; end: (b: string) => void },
    next: () => void,
  ) => {
    const reqPath = req.url?.split('?')[0]
    if (reqPath === '/auth/me.php' && (req.method === 'GET' || req.method === 'HEAD')) {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(mockUser))
      return
    }
    next()
  }
  return {
    name: 'mock-vendas-auth',
    configureServer(server) {
      server.middlewares.use(handle)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handle)
    },
  }
}

// Deploy em vendas.liganer.com.br/comparador-preco/
export default defineConfig({
  plugins: [react(), mockVendasAuth()],
  base: '/comparador-preco/',
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
})
