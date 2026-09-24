# Deploy — Orçamento Chapas/Bobinas

Publicar em `https://vendas.liganer.com.br/orcamento/ace/`.

## Deploy automático (GitHub → HostGator)

1. Usuário FTP no cPanel / HostGator.
2. Guardar host, usuário, senha e pasta remota como **GitHub Secrets**.
3. Em cada push na `main`, o Action faz `npm run build` e envia `dist/` para `/orcamento/ace/`.

### Caminho FTP deste projeto

```
ftp://acesso@liganer.com.br@ftp.liganer.com.br/vendas.liganer.com.br/orcamento/ace
```

| Secret | Valor |
| --- | --- |
| `FTP_SERVER` | `ftp.liganer.com.br` |
| `FTP_USERNAME` | `acesso@liganer.com.br` |
| `FTP_PASSWORD` | *(senha FTP — só no GitHub Secrets)* |

Destino FTP está fixo no workflow (`.github/workflows/deploy-ace.yml`): `/vendas.liganer.com.br/orcamento/ace/`.

### Secrets no GitHub

No repositório:

**Settings → Secrets and variables → Actions → New repository secret**

Prefira **FTPS**. Se o HostGator só aceitar FTP puro, edite `.github/workflows/deploy.yml` e troque `protocol: ftps` por `protocol: ftp`.

**Não cole a senha no chat nem no código.** Só nos Secrets.

### Home / login / auth em `vendas.liganer.com.br/`

A raiz do domínio é publicada pelo **monorepo** (não por este app):

- Fonte oficial: `apps/root-index/`
- Workflow: `.github/workflows/deploy-root-index.yml` (raiz do monorepo)
- Destino FTP: `/vendas.liganer.com.br/`
- Docs: [`apps/root-index/AUTH.md`](../../root-index/AUTH.md)
- Auth/list/sync compartilhados: `@liganer/shared` + `packages/shared/php/budgets.php`

### Login compartilhado e dono do orçamento

Auth na **raiz** do domínio (`/login.html`, `/auth/me.php`, cookie `LIGANER_VENDAS_SESS`). Docs: [`apps/root-index/AUTH.md`](../../root-index/AUTH.md).

Neste app: `src/lib/vendasAuth.ts`. Ao **Salvar** na equipe, o JSON inclui `owner: { id, email, name }`; a lista mostra a coluna **Dono**. Em edição, o dono original é preservado.

### Atualizar preços (planilha Excel)

Fonte compartilhada (fora deste app):

Fonte ACE:

`/vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx`

URL pública: `https://vendas.liganer.com.br/orcamento/tabelas/precos-ace.xlsx`

- Substitua só esse arquivo no FTP e dê hard-refresh no app — sem rebuild.
- O build deste repo só regenera o JSON de fallback embutido (`npm run sync:prices`).
- O material é pesquisável a partir da descrição da planilha (mapeamento de colunas sujeito a orientação posterior).

### Primeira publicação

1. Confirme que a pasta `orcamento/ace` existe no servidor (File Manager).
2. Crie **uma vez** no host a pasta `orcamento/ace/data/` (gravável pelo PHP). O Action **não** cria nem sobrescreve `data/`.
3. Merge do PR / push na `main`, ou **Actions → Deploy… → Run workflow**.
4. No servidor, crie/edite **apenas no host** o `config.json` (o deploy **não sobrescreve** esse arquivo):

```json
{
  "saveUrl": "/orcamento/ace/api/budgets.php",
  "syncSecret": "SEU_SEGREDO_FORTE"
}
```

### O que o Action envia

- Conteúdo de `dist/` (HTML/JS/CSS do Vite)
- `api/budgets.php`
- **Não** apaga o servidor inteiro (`dangerous-clean-slate: false`)
- **Não** sobrescreve `config.json` nem arquivos em `data/`

## Build local

```bash
npm ci
npm run build
```

A pasta `dist/` sai com `base: /orcamento/ace/`.

## Checklist

- [ ] Secrets FTP preenchidos no GitHub (`FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`)
- [ ] Pasta `orcamento/ace/` existe no host
- [ ] Workflow verde em Actions após push na `main`
- [ ] `https://vendas.liganer.com.br/orcamento/ace/` abre com título `Liganer · Orçamento`
- [ ] `config.json` no servidor (opcional) não foi commitado no Git
