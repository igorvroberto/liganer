# Login compartilhado — vendas.liganer.com.br

Auth na **raiz** do domínio (publicado por este repo via `deploy/root-index/` + workflow **Deploy root index**).

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
2. **Prospecção / blanks / ACE / comparador / usuários** — `/auth/guard.js` injeta o mesmo chip fixo à direita (fora da seção) com Voltar → `/` e Sair. Deploy num **único** FTP.
3. **Portal** (`/`) — sessão nativa com Voltar + Sair.

Público: `/login.html` e `/auth/*`.

## Usuários

- Persistidos em `/data/users.json` na raiz do domínio (criado no primeiro acesso/save).
- O deploy **não** sobrescreve `data/`.
- Admin fixo: `igor.roberto@liganer.com.br` — único que vê a seção **Usuário** → **Editar usuários**.
- Esse admin não pode ser excluído nem ter o e-mail alterado.

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

Referência neste repo: `src/lib/vendasAuth.ts` + coluna **Dono** em orçamentos salvos.
