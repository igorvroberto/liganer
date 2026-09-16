# Deploy — Comparador de preço

Publicar em `https://vendas.liganer.com.br/comparador-preco/`.

## Deploy automático (GitHub → HostGator)

Em cada push na `main` (ou **Actions → Run workflow**), o Action faz `npm run build`
e envia `dist/` via FTPS para `/comparador-preco/`.

### Secret necessário

Só a senha FTP precisa ser secret:

| Secret | Valor |
| --- | --- |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |

Host, usuário e pasta remota estão fixos no workflow (iguais ao orçamento chapas/bobinas):

```
ftp://acesso@liganer.com.br@ftp.liganer.com.br/vendas.liganer.com.br/comparador-preco
```

### Primeira publicação

1. Crie a pasta `comparador-preco` no File Manager do HostGator.
2. Configure `FTP_PASSWORD` em **Settings → Secrets and variables → Actions**.
3. Merge do PR / push na `main`, ou **Actions → Deploy… → Run workflow**.
4. Confirme `https://vendas.liganer.com.br/comparador-preco/` com o título `Liganer · Comparador de preço`.

### O que o Action envia

- Conteúdo de `dist/` (HTML/JS/CSS do Vite)
- **Não** apaga o servidor inteiro (`dangerous-clean-slate: false`)

## Build local

```bash
npm ci
npm run build
```

A pasta `dist/` sai com `base: /comparador-preco/`.
