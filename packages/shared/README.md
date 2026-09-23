# @liganer/shared

Núcleo compartilhado das listas de orçamentos/comparações salvos:

- situação (`perdido` / `analise` / `ganho`)
- ordenação por cabeçalho (só na tela)
- paginação (10)
- relatório PDF por mês/ano (Perdidos / Em análise / Ganhos)

## Uso

```ts
import { normalizeBudgetSituacao, exportSituacaoReportPdf } from '@liganer/shared'
import { SavedListSection } from '@liganer/shared/react'
import '@liganer/shared/saved-list.css'
```

Cada app adapta o próprio DTO para `SavedListItem` (ver `toSavedListItem` nos apps).
