# Login compartilhado — vendas.liganer.com.br

Auth na **raiz** do domínio. Fonte oficial no monorepo: **`apps/root-index/`**
(publicado pelo workflow da raiz `.github/workflows/deploy-root-index.yml`).

## Endpoints

| URL | Uso |
| --- | --- |
| `/login.html` | Tela de login (pública) |
| `/auth/login.php` | `POST` `{email,password}` → sessão |
| `/auth/logout.php` | `POST` encerra sessão |
| `/auth/me.php` | `GET` usuário logado (`admin: true/false`) |
| `/auth/users.php` | CRUD de usuários (**só admin**) |
| `/auth/require.php` | `require` em PHP de outros apps |
| `/auth/guard.js` | Guard JS: exige login; chip fixo à direita (nome + e-mail + Voltar + Sair) em prospecção, ACE, blanks, chapas, comparador e usuários; esconde `.session-chip` nativo duplicado |
| `/usuarios.html` | UI de editar usuários (só admin) |

Cookie de sessão: `LIGANER_VENDAS_SESS`, `path=/` (vale em `/orcamento/*`, `/prospeccao/`, etc.).

## Login obrigatório

Em `vendas.liganer.com.br`, as páginas dos apps exigem sessão:

1. **Chapas e bobinas** — `requireVendasLogin()` no boot (`src/main.tsx`) + `<script src="/auth/guard.js">` (chip fixo com Voltar + Sair; o `.session-chip` nativo fica oculto em produção)
2. **Prospecção / blanks / ACE / comparador / usuários** — `/auth/guard.js` injeta o mesmo chip fixo à direita (fora da seção) com Voltar → `/` e Sair. Deploy num **único** FTP (workflow da raiz do monorepo).
3. **Portal** (`/`) — sessão nativa com Voltar + Sair.

Público: `/login.html` e `/auth/*`.

## Usuários

- Persistidos em `/data/users.json` na raiz do domínio (criado no primeiro acesso/save).
- O deploy **não** sobrescreve `data/*.json`.
- Admin fixo: `igor.roberto@liganer.com.br` — único que vê a seção **Usuário** → **Editar usuários**.
- Esse admin não pode ser excluído nem ter o e-mail alterado.

## Deploy

Workflow: **Deploy root index to vendas.liganer.com.br** (`.github/workflows/deploy-root-index.yml`).

- Paths: `apps/root-index/**`, `scripts/inject-vendas-auth-guard.mjs`, o próprio workflow
- Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- Destino: `/vendas.liganer.com.br/`
- Um único FTP-Deploy: monta `root-dist` a partir de `apps/root-index/`, roda o inject dos SPAs irmãos e mescla `inject-dist` no mesmo `root-dist` antes de publicar

## Nos outros apps (JS)

```ts
const res = await fetch('/auth/me.php', { credentials: 'same-origin', cache: 'no-store' })
if (!res.ok) location.assign('/login.html?next=' + encodeURIComponent(location.pathname))
const { user, admin } = await res.json()
```

Ou inclua no `index.html`:

```html
<script src="/auth/guard.js"></script>
```

Referência nos apps: `src/lib/vendasAuth.ts` + coluna **Dono** em orçamentos salvos.
