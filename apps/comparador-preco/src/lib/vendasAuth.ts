/** Re-export do auth canônico em @liganer/shared (sem lógica local). */
export {
  isVendasHost,
  normalizeVendasUser,
  fetchVendasSession,
  fetchVendasUser,
  fetchVendasUsers,
  vendasLoginUrl,
  requireVendasLogin,
  type VendasUser,
  type VendasSession,
} from '@liganer/shared'
