import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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
    const path = req.url?.split('?')[0]
    if (path === '/auth/me.php' && (req.method === 'GET' || req.method === 'HEAD')) {
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
})
