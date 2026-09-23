import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { isVendasHost, requireVendasLogin } from './lib/vendasAuth'

async function boot() {
  const session = await requireVendasLogin()
  if (isVendasHost() && !session) return

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
