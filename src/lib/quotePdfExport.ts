import { blankUnitKg } from "./blankSync";
import {
  fmtCurrency,
  fmtDecimal2,
  fmtDim,
  fmtInt,
  fmtKg,
  fmtMeters,
  fmtMm,
  fmtNumber,
  fmtPct,
  fmtThickness,
} from "./format";
import { blankSpecCitation, blankSpecCitationLine } from "./materialGroups";
import { groupIdenticalStrips, lossBreakdown, programLoss } from "./optimize";
import {
  itemCommercial,
  parseFretePercent,
  QUOTE_CONDITION_FIELDS,
  type ItemLongitudinalLoss,
  type QuoteConditions,
  type QuoteSummary,
} from "./quoteSummary";
import { localPrintNumber } from "./storage";
import {
  COMMISSION_OPTIONS,
  isSlitterItem,
  itemKindOf,
  MTO_FIELDS,
  pvcLabel,
  type BlankInput,
  type CoilInput,
  type RankedPlan,
} from "./types";

export type PdfKind = "cliente" | "liganer";

export type QuotePdfExportInput = {
  kind: PdfKind;
  items: BlankInput[];
  conditions: QuoteConditions;
  summary: QuoteSummary;
  lossByItemId?: Record<string, ItemLongitudinalLoss>;
  plan?: RankedPlan | null;
  coil?: CoilInput;
  /** Opcional — layout chapas (cards Cliente / CNPJ). */
  client?: { name?: string; cnpj?: string };
};

/** Colunas do PDF cliente — ordem fixa pedida (Item é a 1ª coluna à parte). */
const CLIENT_PDF_COLUMN_KEYS = [
  "tipo",
  "acabamento",
  "pvc",
  "thickness",
  "width",
  "length",
  "minQty",
  "unitKg",
  "icms",
  "priceWithoutIpi",
  "subtotal",
  "observation",
] as const;

type PdfColumn = {
  key: string;
  label: string;
  value: (ctx: {
    item: BlankInput;
    index: number;
    commercial: ReturnType<typeof itemCommercial>;
    unitKg: number;
  }) => string;
};

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemHeaderLabel(label: string): string {
  return label;
}

function logoUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${window.location.origin}${base}liganer-favicon.webp`;
}

function allColumns(): PdfColumn[] {
  return [
    {
      key: "coilWidth",
      label: "LARGURA\nORIGINAL\nBOBINA",
      value: ({ item }) => (item.coilWidth && item.coilWidth > 0 ? fmtInt(item.coilWidth) : "—"),
    },
    {
      key: "material",
      label: "Material",
      value: ({ item }) => {
        const kind = itemKindOf(item);
        return kind === "slitter" ? "SLITTER" : kind === "blank" ? "BLANK" : "—";
      },
    },
    { key: "tipo", label: "Tipo", value: ({ item }) => dash(item.tipo) },
    { key: "acabamento", label: "Acabamento", value: ({ item }) => dash(item.acabamento) },
    {
      key: "pvc",
      label: "PVC",
      value: ({ item }) => (item.pvc ? pvcLabel(item.pvc) : "—"),
    },
    {
      key: "thickness",
      label: "Espessura",
      value: ({ item }) => (item.thickness != null ? fmtThickness(item.thickness) : "—"),
    },
    {
      key: "width",
      label: "Largura",
      value: ({ item }) => (item.width > 0 ? fmtInt(item.width) : "—"),
    },
    {
      key: "length",
      label: "Comprimento",
      value: ({ item }) => (item.length > 0 ? fmtInt(item.length) : "—"),
    },
    {
      key: "minQty",
      label: "Quantidade",
      value: ({ item }) => (item.minQty > 0 ? fmtInt(item.minQty) : "—"),
    },
    {
      key: "unitKg",
      label: "Peso\nunitário",
      value: ({ unitKg }) => (unitKg > 0 ? fmtNumber(unitKg, 3) : "—"),
    },
    {
      key: "minKg",
      label: "Peso\ntotal",
      value: ({ item }) => (item.minKg > 0 ? fmtNumber(item.minKg, 1) : "—"),
    },
    {
      key: "priceWithoutIpi",
      label: "Preço\nsem\nIPI",
      value: ({ commercial }) =>
        commercial.priceWithoutIpi != null ? fmtCurrency(commercial.priceWithoutIpi) : "—",
    },
    {
      key: "icms",
      label: "ICMS",
      value: ({ commercial }) =>
        commercial.icms != null ? `${fmtNumber(commercial.icms, 0)}%` : "—",
    },
    {
      key: "subtotal",
      label: "Subtotal",
      value: ({ commercial }) =>
        commercial.subtotal != null ? fmtCurrency(commercial.subtotal) : "—",
    },
    {
      key: "observation",
      label: "Observação",
      value: ({ item }) => dash(item.observation),
    },
    {
      key: "priceFactor100",
      label: "Preço\nfator\n100",
      value: ({ item }) =>
        item.priceFactor100 != null ? fmtCurrency(item.priceFactor100) : "—",
    },
    {
      key: "maxFactor",
      label: "Fator\nmáximo",
      value: ({ item }) => (item.maxFactor != null ? fmtNumber(item.maxFactor, 2) : "—"),
    },
    {
      key: "usedFactor",
      label: "Fator\nutilizado",
      value: ({ item }) => (item.usedFactor != null ? fmtNumber(item.usedFactor, 2) : "—"),
    },
    {
      key: "usedPrice",
      label: "Preço\nfator\nutilizado",
      value: ({ commercial }) =>
        commercial.usedPrice != null ? fmtCurrency(commercial.usedPrice) : "—",
    },
    {
      key: "commission",
      label: "Comissão",
      value: ({ item }) =>
        COMMISSION_OPTIONS.find((o) => o.value === item.commission)?.label ?? "—",
    },
    {
      key: "servicePrice",
      label: "Preço\nserviço",
      value: ({ item }) =>
        item.servicePrice != null ? fmtCurrency(item.servicePrice) : "—",
    },
    {
      key: "serviceDescription",
      label: "Descrição\nserviço",
      value: ({ item }) => dash(item.serviceDescription),
    },
    {
      key: "perdaMm",
      label: "Sobra\nmm",
      value: ({ commercial }) =>
        commercial.perdaMm != null ? fmtInt(commercial.perdaMm) : "—",
    },
    {
      key: "perdaPct",
      label: "Sobra\n%",
      value: ({ commercial }) =>
        commercial.perdaPct != null ? fmtPct(commercial.perdaPct) : "—",
    },
    {
      key: "acrescimoPerda",
      label: "Acréscimo\nsobra",
      value: ({ commercial }) =>
        commercial.acrescimoPerda != null ? fmtPct(commercial.acrescimoPerda) : "—",
    },
    {
      key: "totalPrice",
      label: "Preço\ntotal",
      value: ({ commercial }) =>
        commercial.totalPrice != null ? fmtCurrency(commercial.totalPrice) : "—",
    },
    ...MTO_FIELDS.map(
      (field): PdfColumn => ({
        key: field.key,
        label: field.label,
        value: ({ item }) => (item[field.key] ? "X" : ""),
      }),
    ),
  ];
}

function exportableColumns(kind: PdfKind): PdfColumn[] {
  const cols = allColumns();
  if (kind === "liganer") return cols;
  const byKey = new Map(cols.map((c) => [c.key, c]));
  return CLIENT_PDF_COLUMN_KEYS.map((key) => {
    const col = byKey.get(key);
    if (!col) throw new Error(`Coluna PDF cliente ausente: ${key}`);
    if (key === "unitKg") {
      return {
        ...col,
        value: ({ unitKg }) => (unitKg > 0 ? fmtDecimal2(unitKg) : "—"),
      };
    }
    return col;
  });
}

function coilForItem(item: BlankInput, coil?: CoilInput): CoilInput {
  const base: CoilInput = coil ?? {
    width: 1250,
    thickness: 0.4,
    density: 8,
    kerf: 0,
    edgeTrim: 5,
  };
  return {
    ...base,
    thickness: item.thickness && item.thickness > 0 ? item.thickness : base.thickness,
    width: item.coilWidth && item.coilWidth > 0 ? item.coilWidth : base.width,
  };
}

function cuttingHtml(plan: RankedPlan, coil: CoilInput): string {
  const programsHtml = plan.programs
    .map((program, idx) => {
      const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
      const breakdown = lossBreakdown([program], usefulKg, coil);
      const loss = programLoss(program, coil);
      const seen = new Set<number>();
      const specs: string[] = [];
      for (const strip of program.pattern.strips) {
        if (seen.has(strip.productIndex)) continue;
        seen.add(strip.productIndex);
        const blank = plan.products[strip.productIndex]?.blank;
        if (blank) specs.push(blankSpecCitationLine(blank));
      }
      const titleExtra = specs.length
        ? specs.join(" + ")
        : program.pattern.strips.map((s) => `${fmtInt(s.stripWidth)} mm`).join(" + ");

      const stripRows = groupIdenticalStrips(program.pattern.strips)
        .map((strip) => {
          const blank = plan.products[strip.productIndex]?.blank;
          const continuous = blank && isSlitterItem(blank) && strip.cutLength <= 1 + 1e-9;
          const n = continuous ? 1 : Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
          const displayLen = continuous ? program.coilLengthMm : strip.cutLength;
          const spec = blank ? blankSpecCitation(blank) : null;
          return `<tr>
            <td>${escapeHtml(spec?.tipo ?? "—")}</td>
            <td>${escapeHtml(spec?.acabamento ?? "—")}</td>
            <td>${escapeHtml(spec?.pvc ?? "—")}</td>
            <td>${escapeHtml(spec?.espessura ?? "—")}</td>
            <td>${escapeHtml(fmtMm(strip.stripWidth))}</td>
            <td>${escapeHtml(`${fmtMm(displayLen)}${strip.rotated ? " (girado)" : ""}`)}</td>
            <td>${escapeHtml(fmtInt(n))}</td>
            <td>${escapeHtml(fmtInt(strip.stripCount))}</td>
          </tr>`;
        })
        .join("");

      return `
        <section class="panel cut-program" style="margin-top:10px">
          <h2>Programa ${idx + 1} · Comprimento total: ${escapeHtml(fmtMeters(program.coilLengthMm))} · ${escapeHtml(titleExtra)}</h2>
          <table class="items" style="margin:0">
            <thead>
              <tr>
                <th>Tipo</th><th>Acabamento</th><th>PVC</th><th>Espessura</th>
                <th>Largura</th><th>Comprimento</th><th>Peças</th><th>Cortes</th>
              </tr>
            </thead>
            <tbody>${stripRows}</tbody>
          </table>
          <div class="kv">
            <div><strong>Sobra longitudinal</strong><span>${escapeHtml(fmtPct(loss.lossPercent))}</span></div>
            <div><strong>Sucata</strong><span>${escapeHtml(fmtKg(loss.scrapKg))}</span></div>
            <div><strong>Sobra</strong><span>${escapeHtml(`${fmtMm(loss.widthWasteMm)} (${fmtPct(loss.widthLossPercent)})`)}</span></div>
            <div><strong>Aproveitamento</strong><span>${escapeHtml(fmtPct(breakdown.yieldPercent))}</span></div>
          </div>
        </section>`;
    })
    .join("");

  const productionRows = plan.products
    .map((product) => {
      const itemLabel = isSlitterItem(product.blank)
        ? `${fmtInt(product.blank.width)} mm slitter`
        : fmtDim(product.blank.width, product.blank.length);
      const pedido = isSlitterItem(product.blank)
        ? `${product.blank.minQty > 0 ? `${fmtInt(product.blank.minQty)} un · ` : ""}${fmtKg(product.blank.minKg)}`
        : `${fmtInt(product.blank.minQty)} un · ${fmtKg(product.blank.minKg)}`;
      const unit = isSlitterItem(product.blank)
        ? `${fmtNumber(product.unitWeightKg, 4)} Kg/mm`
        : fmtKg(product.unitWeightKg);
      const produced = isSlitterItem(product.blank)
        ? fmtMeters(product.pieces)
        : `${fmtInt(product.pieces)} un`;
      return `<tr>
        <td>${escapeHtml(itemLabel)}</td>
        <td>${escapeHtml(pedido)}</td>
        <td>${escapeHtml(unit)}</td>
        <td>${escapeHtml(produced)}</td>
        <td>${escapeHtml(fmtKg(product.weightKg))}</td>
      </tr>`;
    })
    .join("");

  return `
    <section class="panel" style="margin-top:14px">
      <h2>Resultado do corte</h2>
      <div class="kv">
        <div><strong>Programas</strong><span>${escapeHtml(String(plan.setupCount))}</span></div>
        <div><strong>Aproveitamento</strong><span>${escapeHtml(fmtPct(plan.yieldPercent))}</span></div>
        <div><strong>Peso da bobina</strong><span>${escapeHtml(fmtKg(plan.coilWeightKg))}</span></div>
        <div><strong>Peso útil</strong><span>${escapeHtml(fmtKg(plan.usefulWeightKg))}</span></div>
        <div><strong>Sucata (longitudinal)</strong><span>${escapeHtml(fmtKg(plan.scrapKg))}</span></div>
        <div><strong>Largura bobina</strong><span>${escapeHtml(fmtMm(coil.width))}</span></div>
        <div><strong>Espessura</strong><span>${escapeHtml(`${fmtThickness(coil.thickness)} mm`)}</span></div>
        <div><strong>Refile (cada lado)</strong><span>${escapeHtml(fmtMm(coil.edgeTrim))}</span></div>
      </div>
    </section>
    ${programsHtml}
    <section class="panel" style="margin-top:10px">
      <h2>Produção por item</h2>
      <table class="items" style="margin:0">
        <thead>
          <tr>
            <th>Item</th><th>Pedido</th><th>Peso un.</th><th>Produzido</th><th>Peso produzido</th>
          </tr>
        </thead>
        <tbody>${productionRows}</tbody>
      </table>
    </section>`;
}

/** Gera o HTML do PDF no layout chapas-bobinas (para testes / inspeção). */
export function buildQuotePdfHtml(input: QuotePdfExportInput): string {
  const {
    kind,
    items,
    conditions,
    summary,
    lossByItemId = {},
    plan = null,
    coil,
    client = {},
  } = input;
  if (!items.length) return "";

  const fields = exportableColumns(kind);
  const freteFraction = parseFretePercent(conditions.frete);
  const footer = QUOTE_CONDITION_FIELDS.filter((f) => {
    if (!String(conditions[f.key] ?? "").trim()) return false;
    // Frete (%) interno — oculto no PDF cliente (como chapas).
    if (kind === "cliente" && f.key === "frete") return false;
    return true;
  });
  const number = localPrintNumber();
  const now = new Date().toLocaleString("pt-BR");
  const pdfClass = kind === "liganer" ? "pdf-liganer" : "pdf-cliente";
  const logo =
    typeof window !== "undefined" ? logoUrl() : "liganer-favicon.webp";

  const itemRows = items
    .map((item, index) => {
      const commercial = itemCommercial(item, lossByItemId[item.id] ?? null, freteFraction);
      const unitKg = blankUnitKg(item, coilForItem(item, coil));
      const cells = fields
        .map((field) => {
          const text = field.value({ item, index, commercial, unitKg });
          return `<td>${escapeHtml(text)}</td>`;
        })
        .join("");
      return `<tr><td class="item-no">${index + 1}</td>${cells}</tr>`;
    })
    .join("");

  const summaryRows: [string, string][] = [
    ["Total (Kg)", `${fmtInt(summary.totalKg)} Kg`],
    ["Subtotal", fmtCurrency(summary.subtotal)],
    ["IPI 3,25%", fmtCurrency(summary.ipi)],
    ["Total", fmtCurrency(summary.total)],
  ];

  const summaryHtml = `
    <section class="panel">
      <h2>Totais</h2>
      <div class="kv">
        ${summaryRows
          .map(
            ([label, value]) => `
          <div>
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
          </div>`,
          )
          .join("")}
      </div>
    </section>`;

  const conditionsHtml = `
    <section class="panel">
      <h2>Condições</h2>
      <div class="kv">
        ${
          footer.length
            ? footer
                .map(
                  (field) => `
          <div>
            <strong>${escapeHtml(field.label)}</strong>
            <span>${escapeHtml(String(conditions[field.key]))}</span>
          </div>`,
                )
                .join("")
            : '<div><strong>—</strong><span>Sem condições preenchidas</span></div>'
        }
      </div>
    </section>`;

  const cutting =
    kind === "liganer" && plan && coil ? cuttingHtml(plan, coil) : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(number)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      background: #fff;
    }
    body.pdf-liganer { font-size: 7px; }

    .print-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 10px;
    }
    .print-actions button {
      border: 0;
      border-radius: 6px;
      background: #c60000;
      color: #fff;
      padding: 8px 14px;
      font-weight: 700;
      cursor: pointer;
    }
    @media print { .print-actions { display: none; } }

    .banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      background: #c60000;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand img {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #fff;
      object-fit: contain;
      flex: none;
    }
    .brand h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.1;
      font-weight: 800;
    }
    body.pdf-liganer .brand h1 { font-size: 14px; }
    .banner-meta {
      text-align: right;
      font-size: 11px;
      line-height: 1.45;
      white-space: nowrap;
    }
    body.pdf-liganer .banner-meta { font-size: 8px; }

    .client-card {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    .client-card article {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      padding: 8px 10px;
      background: #f2f2f2;
    }
    .client-card span {
      display: block;
      color: #56635d;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 3px;
    }
    .client-card strong {
      font-size: 12px;
      font-weight: 700;
    }
    body.pdf-liganer .client-card strong { font-size: 9px; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.items th,
    table.items td {
      border: 1px solid #d8dfd9;
      padding: 5px 4px;
      vertical-align: middle;
      text-align: center;
      overflow: hidden;
    }
    table.items th {
      background: #c60000;
      color: #fff;
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      line-height: 1.15;
      white-space: pre-line;
      letter-spacing: 0.01em;
    }
    table.items td {
      white-space: nowrap;
      text-overflow: clip;
    }
    table.items td.item-no {
      width: 28px;
      font-weight: 700;
      color: #56635d;
    }
    table.items th.item-no {
      width: 28px;
    }
    body.pdf-liganer table.items th {
      font-size: 5px;
      padding: 3px 2px;
    }
    body.pdf-liganer table.items td {
      font-size: 5.4px;
      padding: 2px 1px;
      line-height: 1.12;
    }

    .bottom {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
      break-inside: avoid;
    }
    .panel {
      border: 1px solid #d8dfd9;
      border-radius: 8px;
      overflow: hidden;
      height: fit-content;
      align-self: start;
    }
    .panel h2 {
      margin: 0;
      padding: 8px 10px;
      background: #fce8e8;
      color: #c60000;
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      border-bottom: 1px solid #d8dfd9;
    }
    body.pdf-liganer .panel h2 { font-size: 9px; padding: 5px 8px; }
    .kv div {
      display: grid;
      grid-template-columns: 1fr 1.1fr;
      border-bottom: 1px solid #d8dfd9;
      min-height: 28px;
    }
    .kv div:last-child { border-bottom: 0; }
    .kv strong,
    .kv span {
      display: grid;
      place-items: center;
      padding: 6px 8px;
      text-align: center;
    }
    .kv strong {
      color: #56635d;
      font-size: 8px;
      text-transform: uppercase;
      border-right: 1px solid #d8dfd9;
      background: #fafafa;
    }
    .kv span {
      font-size: 11px;
      font-weight: 700;
    }
    body.pdf-liganer .kv strong { font-size: 6px; }
    body.pdf-liganer .kv span { font-size: 8px; }
    .cut-program { break-inside: avoid; }
  </style>
</head>
<body class="${pdfClass}">
  <div class="print-actions">
    <button type="button" onclick="window.print()">Salvar em PDF</button>
  </div>

  <header class="banner">
    <div class="brand">
      <img src="${escapeHtml(logo)}" alt="Liganer" width="40" height="40" />
      <div>
        <h1>Liganer</h1>
      </div>
    </div>
    <div class="banner-meta">
      <div><strong>Nº ${escapeHtml(number)}</strong></div>
      <div>${escapeHtml(now)}</div>
      <div>${items.length} item(ns)</div>
    </div>
  </header>

  <section class="client-card">
    <article>
      <span>Cliente</span>
      <strong>${escapeHtml(client.name || "—")}</strong>
    </article>
    <article>
      <span>CNPJ</span>
      <strong>${escapeHtml(client.cnpj || "—")}</strong>
    </article>
  </section>

  <table class="items">
    <thead>
      <tr>
        <th class="item-no">Item</th>
        ${fields
          .map((field) => `<th>${escapeHtml(itemHeaderLabel(field.label))}</th>`)
          .join("")}
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="bottom">
    ${summaryHtml}
    ${conditionsHtml}
  </div>

  ${cutting}

  <script>window.addEventListener('load', () => setTimeout(() => window.print(), 350))</script>
</body>
</html>`;
}

/** Abre o PDF no layout chapas-bobinas (HTML + print). */
export function exportQuotePdf(input: QuotePdfExportInput): void {
  if (!input.items.length) return;
  const html = buildQuotePdfHtml(input);
  const win = window.open("", "_blank");
  if (!win) {
    alert("O navegador bloqueou a janela de PDF. Permita pop-ups para exportar.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
