import { blankUnitKg } from "./blankSync";
import {
  fmtCurrency,
  fmtDecimal2,
  fmtInt,
  fmtPlainInt,
  fmtPlainMm,
  fmtKg,
  fmtMeters,
  fmtNumber,
  fmtPct,
  fmtThickness,
} from "./format";
import { blankSpecCitation, blankSpecCitationLine } from "./materialGroups";
import { groupIdenticalStrips, lossBreakdown, productIndicesInProgram } from "./optimize";
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
  BLANK_COLORS,
  COMMISSION_OPTIONS,
  isSlitterItem,
  itemKindOf,
  MTO_FIELDS,
  pvcLabel,
  type BlankInput,
  type CoilInput,
  type ProgramResult,
  type RankedPlan,
} from "./types";

export type PdfKind = "cliente" | "liganer" | "gestao";

/** Liganer e Gestão: layout interno + resultado do corte. */
function isInternalPdf(kind: PdfKind): boolean {
  return kind === "liganer" || kind === "gestao";
}

const GESTAO_EXCLUDED_COLUMNS = new Set([
  "observation",
  "priceFactor100",
  "maxFactor",
  "commission",
  ...MTO_FIELDS.map((f) => f.key),
]);

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
      value: ({ item }) => (item.coilWidth && item.coilWidth > 0 ? fmtPlainInt(item.coilWidth) : "—"),
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
      value: ({ item }) => (item.width > 0 ? fmtPlainInt(item.width) : "—"),
    },
    {
      key: "length",
      label: "Comprimento",
      value: ({ item }) => (item.length > 0 ? fmtPlainInt(item.length) : "—"),
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
  if (kind === "gestao") {
    return cols.filter((col) => !GESTAO_EXCLUDED_COLUMNS.has(col.key));
  }
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

function stripBarHtml(program: ProgramResult, coilWidth: number, edgeTrim: number): string {
  const pct = (mm: number) => `${(mm / coilWidth) * 100}%`;
  const stripColor = (idx: number) => BLANK_COLORS[idx % BLANK_COLORS.length];

  const topSegs: string[] = [];
  if (edgeTrim > 0) {
    topSegs.push(
      `<div class="pattern-seg refile" style="width:${pct(edgeTrim)}">${
        edgeTrim >= 8 ? escapeHtml(fmtInt(edgeTrim)) : ""
      }</div>`,
    );
  }
  program.pattern.strips.forEach((strip, idx) => {
    topSegs.push(
      `<div class="pattern-seg" style="width:${pct(strip.stripWidth)};background:${stripColor(idx)}">${escapeHtml(
        fmtInt(strip.stripWidth),
      )}</div>`,
    );
  });
  if (program.pattern.waste > 0.5) {
    topSegs.push(
      `<div class="pattern-seg waste" style="width:${pct(program.pattern.waste)}">sobra ${escapeHtml(
        fmtInt(program.pattern.waste),
      )}</div>`,
    );
  }
  if (edgeTrim > 0) {
    topSegs.push(
      `<div class="pattern-seg refile" style="width:${pct(edgeTrim)}">${
        edgeTrim >= 8 ? escapeHtml(fmtInt(edgeTrim)) : ""
      }</div>`,
    );
  }

  const usableWidth = coilWidth - 2 * edgeTrim;
  const usedWidth = program.pattern.strips.reduce((s, strip) => s + strip.stripWidth, 0);
  const blankScale = usedWidth > 0 ? usableWidth / usedWidth : 1;
  const laneSegs = program.pattern.strips
    .map((strip, idx) => {
      const displayLen = strip.cutLength <= 1 + 1e-9 ? program.coilLengthMm : strip.cutLength;
      const w = strip.stripWidth * blankScale;
      return `<div class="lane" style="flex:${w} 1 0">
        <div class="blank-rect" style="background:${stripColor(idx)}">${escapeHtml(
          `${fmtPlainInt(strip.stripWidth)} × ${fmtPlainInt(displayLen)}`,
        )}</div>
      </div>`;
    })
    .join("");

  return `<div class="cut-preview">
    <div class="pattern-bar">${topSegs.join("")}</div>
    <div class="cut-preview-gap"></div>
    <div class="lanes">${laneSegs}</div>
  </div>`;
}

function productionRowsHtml(plan: RankedPlan, program: ProgramResult): string {
  return productIndicesInProgram(program)
    .map((index) => {
      const product = plan.products[index];
      if (!product) return "";
      const pieces = program.piecesPerProduct[index] ?? 0;
      const weightKg = program.weightPerProductKg[index] ?? 0;
      const itemLabel = isSlitterItem(product.blank)
        ? `${fmtPlainInt(product.blank.width)} mm slitter`
        : `${fmtPlainInt(product.blank.width)} × ${fmtPlainInt(product.blank.length)} mm`;
      const pedido = isSlitterItem(product.blank)
        ? `${product.blank.minQty > 0 ? `${fmtInt(product.blank.minQty)} un · ` : ""}${fmtKg(product.blank.minKg)}`
        : `${fmtInt(product.blank.minQty)} un · ${fmtKg(product.blank.minKg)}`;
      const unit = isSlitterItem(product.blank)
        ? `${fmtNumber(product.unitWeightKg, 4)} Kg/mm`
        : fmtKg(product.unitWeightKg);
      const produced = isSlitterItem(product.blank)
        ? fmtMeters(pieces)
        : `${fmtInt(pieces)} un`;
      return `<tr>
        <td>${escapeHtml(itemLabel)}</td>
        <td>${escapeHtml(pedido)}</td>
        <td>${escapeHtml(unit)}</td>
        <td>${escapeHtml(produced)}</td>
        <td>${escapeHtml(fmtKg(weightKg))}</td>
      </tr>`;
    })
    .join("");
}

/** Resultado do corte no layout antigo (barras coloridas), na mesma ordem da UI. */
function cuttingHtml(plan: RankedPlan, coil: CoilInput): string {
  const programsHtml = plan.programs
    .map((program, idx) => {
      const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
      const breakdown = lossBreakdown([program], usefulKg, coil);
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
            <td>${escapeHtml(fmtPlainMm(strip.stripWidth))}</td>
            <td>${escapeHtml(`${fmtPlainMm(displayLen)}${strip.rotated ? " (girado)" : ""}`)}</td>
            <td>${escapeHtml(fmtInt(n))}</td>
            <td>${escapeHtml(fmtInt(strip.stripCount))}</td>
          </tr>`;
        })
        .join("");

      return `
        <section class="cut-legacy-program">
          <h3>Programa ${idx + 1} · ${escapeHtml(titleExtra)}</h3>
          <p class="cut-legacy-note">Comprimento total: <strong>${escapeHtml(fmtMeters(program.coilLengthMm))}</strong></p>
          ${stripBarHtml(program, coil.width, coil.edgeTrim)}
          <table class="cut-legacy-table">
            <thead>
              <tr>
                <th>Tipo</th><th>Acabamento</th><th>PVC</th><th>Espessura</th>
                <th>Largura</th><th>Comprimento</th><th>Peças nesta tira</th><th>Cortes</th>
              </tr>
            </thead>
            <tbody>${stripRows}</tbody>
          </table>
          <h3>Melhor aproveitamento</h3>
          <p class="cut-legacy-loss-note">
            Sobra longitudinal: <strong>${escapeHtml(fmtPct(breakdown.longitudinalPct))}</strong>
            (${escapeHtml(fmtPlainInt(breakdown.widthWasteMm))}mm)
            · Sobra transversal: <strong>${escapeHtml(fmtPct(breakdown.transversalPct))}</strong>
            (${escapeHtml(fmtKg(breakdown.transversalKg))})
            · Refile: <strong>${escapeHtml(fmtPlainMm(coil.edgeTrim * 2))}</strong>:
            <strong>${escapeHtml(fmtPct(breakdown.refilePct))}</strong>
            (${escapeHtml(fmtKg(breakdown.refileKg))})
            — refile e transversal não entram no %; o refile só reduz a largura útil dos planos de corte.
          </p>
          <div class="cut-legacy-kpis">
            <div class="cut-legacy-kpi good">
              <span>Aproveitamento</span>
              <b>${escapeHtml(fmtPct(breakdown.yieldPercent))}</b>
            </div>
            <div class="cut-legacy-kpi">
              <span>Peso necessário</span>
              <b>${escapeHtml(fmtKg(breakdown.physicalCoilKg))}</b>
            </div>
          </div>
          <table class="cut-legacy-table">
            <thead>
              <tr>
                <th>Item</th><th>Pedido</th><th>Peso un.</th><th>Produzido</th><th>Peso produzido</th>
              </tr>
            </thead>
            <tbody>${productionRowsHtml(plan, program)}</tbody>
          </table>
        </section>`;
    })
    .join("");

  return `
    <section class="cut-legacy">
      <h2>Resultado do corte</h2>
      <p class="cut-legacy-lead"><strong>${escapeHtml(String(plan.setupCount))}</strong> programa${plan.setupCount > 1 ? "s" : ""} de corte</p>
      ${programsHtml}
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
    if (!isInternalPdf(kind) && f.key === "frete") return false;
    return true;
  });
  const number = localPrintNumber();
  const now = new Date().toLocaleString("pt-BR");
  const pdfClass = isInternalPdf(kind) ? "pdf-liganer" : "pdf-cliente";
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

  const conditionsHtml = footer.length
    ? `
    <section class="panel">
      <h2>Condições</h2>
      <div class="kv">
        ${footer
          .map(
            (field) => `
          <div>
            <strong>${escapeHtml(field.label)}</strong>
            <span>${escapeHtml(String(conditions[field.key]))}</span>
          </div>`,
          )
          .join("")}
      </div>
    </section>`
    : "";

  const cutting =
    isInternalPdf(kind) && plan && coil ? cuttingHtml(plan, coil) : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(number)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      color: #17211d;
      font-family: Inter, Arial, Helvetica, sans-serif;
      font-size: 10px;
      background: #fff;
      /* Mantém fundos/cores dos gráficos na impressão/PDF do navegador. */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
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
    @media print {
      .print-actions { display: none; }
      html, body, body * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }

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

    /* Layout legado do corte com barras coloridas */
    .cut-legacy {
      margin-top: 14px;
      break-inside: avoid;
      color: #1b242c;
    }
    .cut-legacy h2 {
      margin: 0 0 6px;
      color: #c60000;
      font-size: 12px;
      font-weight: 800;
    }
    body.pdf-liganer .cut-legacy h2 { font-size: 10px; }
    .cut-legacy h3 {
      margin: 10px 0 4px;
      color: #1b242c;
      font-size: 10px;
      font-weight: 800;
    }
    body.pdf-liganer .cut-legacy h3 { font-size: 8px; }
    .cut-legacy-lead {
      margin: 0 0 8px;
      font-size: 9px;
    }
    .cut-legacy-program {
      margin-top: 10px;
      break-inside: avoid;
    }
    .cut-legacy-meta,
    .cut-legacy-summary,
    .cut-legacy-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 6px;
    }
    .cut-legacy-meta th,
    .cut-legacy-meta td {
      padding: 2px 6px;
      text-align: left;
      font-size: 8px;
      border: 0;
    }
    .cut-legacy-meta th {
      width: 140px;
      font-weight: 800;
      color: #1b242c;
    }
    .cut-legacy-summary th,
    .cut-legacy-summary td,
    .cut-legacy-table th,
    .cut-legacy-table td {
      border: 1px solid #d5dde4;
      padding: 4px 6px;
      text-align: center;
      font-size: 8px;
    }
    .cut-legacy-summary th,
    .cut-legacy-table th {
      background: #c60000;
      color: #fff;
      font-weight: 800;
    }
    .cut-legacy-summary td {
      font-weight: 800;
      font-size: 10px;
    }
    .cut-legacy-note {
      margin: 2px 0 6px;
      color: #5b6773;
      font-size: 8px;
    }
    .cut-legacy-loss-note {
      margin: 2px 0 8px;
      padding: 6px 8px;
      border-left: 3px solid #1d4ed8;
      background: #eff6ff;
      color: #1e3a5f;
      font-size: 8px;
      line-height: 1.35;
    }
    .cut-legacy-kpis {
      display: flex;
      gap: 8px;
      margin: 0 0 8px;
    }
    .cut-legacy-kpi {
      flex: 1;
      border: 1px solid #d5dde4;
      background: #f3f5f7;
      padding: 6px 8px;
      text-align: center;
    }
    .cut-legacy-kpi span {
      display: block;
      color: #5b6773;
      font-size: 7px;
      margin-bottom: 2px;
    }
    .cut-legacy-kpi b {
      font-size: 11px;
      font-weight: 800;
      color: #1b242c;
    }
    .cut-legacy-kpi.good b {
      color: #15803d;
    }
    .cut-preview { margin: 4px 0 8px; }
    .pattern-bar {
      display: flex;
      width: 100%;
      height: 22px;
      border: 1px solid #d5dde4;
      overflow: hidden;
      background: #f3f5f7;
    }
    .pattern-seg {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
    }
    .pattern-seg.refile {
      background: #b4bcc4;
      color: #465058;
      font-size: 7px;
    }
    .pattern-seg.waste {
      background: #d2d6da;
      color: #465058;
      font-size: 8px;
    }
    .cut-preview-gap { height: 4px; }
    .lanes {
      display: flex;
      width: 100%;
      gap: 0;
      min-height: 22px;
    }
    .lane {
      min-width: 0;
    }
    .blank-rect {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 22px;
      color: #fff;
      font-size: 8px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
    }
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
