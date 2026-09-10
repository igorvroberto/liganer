# Index da raiz de vendas.liganer.com.br

**Onde fica no repo:** pasta `vendas-root/` na raiz deste repositório (não dentro de `src/` nem de `dist/`).

**Onde publica no FTP/HostGator:** raiz do subdomínio

```text
/vendas.liganer.com.br/index.html
/vendas.liganer.com.br/liganer_favicon.webp
```

URL pública: `https://vendas.liganer.com.br/`

**Não** publicar em `/orcamento/blanks-slitters/` — esse caminho é só a calculadora (`deploy-blanks.yml`).

Deploy automático: workflow `Deploy vendas root index` (`.github/workflows/deploy-vendas-root.yml`), no push em `main` que altere `vendas-root/**`, ou via *Run workflow*.
