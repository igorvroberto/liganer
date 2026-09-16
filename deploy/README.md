# Deploy — Comparador de preço

Publicar em `https://vendas.liganer.com.br/comparador-preco/`.

## Deploy automático (GitHub → HostGator)

1. Usuário FTP no cPanel / HostGator.
2. Guardar host, usuário, senha e pasta remota como **GitHub Secrets**.
3. Em cada push na `main`, o Action faz `npm run build` e envia `dist/` para `/comparador-preco/`.

### Caminho FTP deste projeto

```
ftp://acesso@liganer.com.br@ftp.liganer.com.br/vendas.liganer.com.br/comparador-preco
```

| Secret | Valor |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |
| `FTP_SERVER_DIR` | `/vendas.liganer.com.br/comparador-preco/` |

`FTP_SERVER_DIR` deve terminar com `/`.

### Primeira publicação

1. Crie a pasta `comparador-preco` no File Manager do HostGator.
2. Merge do PR / push na `main`, ou **Actions → Deploy… → Run workflow**.
3. Confirme `https://vendas.liganer.com.br/comparador-preco/` com o título `Liganer · Comparador de preço`.

### O que o Action envia

- Conteúdo de `dist/` (HTML/JS/CSS do Vite)
- **Não** apaga o servidor inteiro (`dangerous-clean-slate: false`)

## Build local

```bash
npm ci
npm run build
```

A pasta `dist/` sai com `base: /comparador-preco/`.
