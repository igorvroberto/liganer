# AGENTS.md

## Cursor Cloud specific instructions

### Product

SPA **Comparador de preço** (Vite + React + TypeScript) for Liganer sales. Target path: `/comparador-preco/` on `vendas.liganer.com.br`. Visual/CSS patterns mirror `liganer-orcamento-chapas-bobinas`.

### Commands

See `package.json` / `README.md` for standard scripts (`dev`, `lint`, `test`, `build`, `preview`). Dev URL includes the base path: `http://localhost:5173/comparador-preco/`.

### Non-obvious notes

- Business formulas live in `src/lib/calc.ts` and must match the Excel sheet **Diferença preço e ICMS** (unit tests in `src/lib/calc.test.ts`).
- ICMS inputs in the UI are entered as **percent points** (e.g. `18` for 18%) and stored as fractions (`0.18`).
- Sample rows in `src/data/sample-rows.json` come from the reference workbook; draft state persists in `localStorage` key `liganer-comparador-preco-draft-v1`.
- No backend is required for core use. Deploy is static FTP to HostGator (see `deploy/README.md`). For GitHub Actions deploy, only `FTP_PASSWORD` is required as a secret (server/user/dir are hardcoded in the workflow).
- `vite.config.ts` sets `base: '/comparador-preco/'` — do not change without updating HostGator path and `index.html` favicon links.
