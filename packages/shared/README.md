# @liganer/shared

Núcleo compartilhado dos apps de orçamento / comparador em `vendas.liganer.com.br`:

- lista salva: situação, ordenação, paginação, relatório PDF (`SavedListSection`)
- auth: `fetchVendasSession` / `requireVendasLogin` / `normalizeVendasUser`
- sync remoto: cliente HTTP de `api/budgets.php` + PHP canônico em `php/budgets.php`

**Não inclui** cálculos de chapas, ACE ou blanks/slitters — esses ficam em cada app.

## Uso

```ts
import {
  normalizeBudgetSituacao,
  fetchVendasUser,
  saveBudgetRemote,
  loadSyncConfig,
} from '@liganer/shared'
import { SavedListSection } from '@liganer/shared/react'
import '@liganer/shared/saved-list.css'
```

Cada app adapta o próprio DTO para `SavedListItem` (ver `toSavedListItem` nos apps).

## PHP

No deploy, copie `packages/shared/php/budgets.php` → `dist/api/budgets.php`.
