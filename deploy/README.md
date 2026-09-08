# Deploy FTP — vendas.liganer.com.br/prospeccao

## Ideia

- **Fonte da verdade:** `radar-comercial/LEADS.csv` no GitHub (repo privado).
- **Hospedagem FTP:** só recebe o site estático + um **espelho** do CSV.
- O navegador **não** lê o GitHub privado (não daria sem expor token, e o CSV tem telefone/e-mail).

```
editar LEADS.csv no GitHub
        ↓
   Actions (sync-leads-ftp)
        ↓
   FTP → /prospeccao/data/leads.csv
        ↓
   app clica "Atualizar" / recarrega a página
```

## 1) Subir o app uma vez (FileZilla)

```bash
bash scripts/sync-leads.sh
cd web && npm ci && npm run build
```

Envie o **conteúdo** de `web/dist/` para:

```text
/public_html/prospeccao/   (ajuste ao caminho da sua hospedagem)
```

Inclui: `index.html`, `assets/`, `data/leads.csv`, `config.json`, `.htaccess`.

URL: `https://vendas.liganer.com.br/prospeccao/`

## 2) Secrets GitHub (atualizar leads sem reenviar o site)

Settings → Secrets → Actions:

| Secret | Exemplo |
| ------ | ------- |
| `FTP_HOST` | `ftp.seudominio.com.br` |
| `FTP_USER` | usuário FTP |
| `FTP_PASSWORD` | senha FTP |
| `FTP_SERVER_DIR` | `/public_html/prospeccao/data/` |
| `FTP_PROTOCOL` | `ftp` ou `ftps` (opcional) |

Workflow: `.github/workflows/sync-leads-ftp.yml`  
Dispara em todo push de `radar-comercial/LEADS.csv` em `main`.

## 3) Dia a dia

1. Edite leads no GitHub (`LEADS.csv` ou `gerar_base.py` → gerar CSV).
2. Merge em `main`.
3. O Action envia só `leads.csv` via FTP.
4. No sistema, clique **Atualizar** (ou F5).

## 4) Puxar direto do GitHub raw? (não recomendado aqui)

Só faria sentido se o CSV fosse **público**. Este repo é **privado** e contém contatos comerciais.

Se no futuro houver uma URL pública segura, coloque em `config.json` na hospedagem:

```json
{
  "leadsUrl": "https://exemplo.com/leads.csv",
  "leadsLabel": "GitHub mirror"
}
```

Sem rebuild. Hoje o padrão seguro é: **GitHub privado → FTP espelho → app**.
