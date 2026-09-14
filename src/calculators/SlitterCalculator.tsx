import { useEffect, useMemo, useState } from "react";
import QuoteClientFields from "../components/QuoteClientFields";
import QuoteConditions from "../components/QuoteConditions";
import QuoteTotals from "../components/QuoteTotals";
import SlitterItemsTable from "../components/SlitterItemsTable";
import { fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct, fmtPlainInt, fmtPlainMm } from "../lib/format";
import { blankSpecCitation, blankSpecCitationLine } from "../lib/materialGroups";
import {
  groupIdenticalStrips,
  lossBreakdown,
  optimizeCutting,
  productIndicesInProgram,
} from "../lib/optimize";
import { EMPTY_QUOTE_CLIENT, type QuoteClientInfo } from "../lib/quoteClient";
import { exportQuotePdf } from "../lib/quotePdfExport";
import { loadPriceTable } from "../lib/priceTable";
import {
  EMPTY_QUOTE_CONDITIONS,
  itemLossFromPlan,
  quoteSummary,
  type QuoteConditions as QuoteConditionsState,
} from "../lib/quoteSummary";
import { loadDraft, saveDraft } from "../lib/storage";
import { coilForProgram, coilFromSlitterItems } from "../lib/slitterCoil";
import {
  BLANK_COLORS,
  isSlitterItem,
  type BlankInput,
  type ProgramResult,
  type RankedPlan,
} from "../lib/types";

const EMPTY_ITEMS: BlankInput[] = [
  {
    id: "item-1",
    name: "",
    width: 0,
    length: 0,
    minKg: 0,
    minQty: 0,
  },
];

const EMPTY_MODES: Record<string, "qty" | "weight"> = {
  "item-1": "weight",
};

function LanePreview({ program, coilWidth, edgeTrim }: { program: ProgramResult; coilWidth: number; edgeTrim: number }) {
  const pct = (mm: number) => `${(mm / coilWidth) * 100}%`;
  const stripColor = (idx: number) => BLANK_COLORS[idx % BLANK_COLORS.length];

  return (
    <div className="cut-preview">
      <div className="pattern-bar" title={`Largura da bobina ${fmtMm(coilWidth)}`}>
        {edgeTrim > 0 && (
          <div className="pattern-seg refile" style={{ width: pct(edgeTrim) }}>
            {edgeTrim >= 8 ? `${fmtInt(edgeTrim)}` : ""}
          </div>
        )}
        {program.pattern.strips.map((strip, idx) => (
          <div
            key={`bar-${strip.productIndex}-${idx}`}
            className="pattern-seg"
            style={{
              width: pct(strip.stripWidth),
              background: stripColor(idx),
            }}
          >
            {fmtInt(strip.stripWidth)}
          </div>
        ))}
        {program.pattern.waste > 0.5 && (
          <div className="pattern-seg waste" style={{ width: pct(program.pattern.waste) }}>
            sobra {fmtInt(program.pattern.waste)}
          </div>
        )}
        {edgeTrim > 0 && (
          <div className="pattern-seg refile" style={{ width: pct(edgeTrim) }}>
            {edgeTrim >= 8 ? `${fmtInt(edgeTrim)}` : ""}
          </div>
        )}
      </div>
      <div className="cut-preview-gap" aria-hidden="true" />
      <div className="lanes" aria-hidden="true">
        {edgeTrim > 0 && (
          <div className="lane lane-spacer" style={{ flex: `${edgeTrim} 0 0` }} />
        )}
        {program.pattern.strips.map((strip, idx) => {
          const color = stripColor(idx);
          const displayLen = strip.cutLength <= 1 + 1e-9 ? program.coilLengthMm : strip.cutLength;
          return (
            <div
              key={`${strip.productIndex}-${idx}`}
              className="lane"
              style={{ flex: `${strip.stripWidth} 1 0` }}
            >
              <div className="blank-rect" style={{ background: color }}>
                {fmtDim(strip.stripWidth, displayLen)}
              </div>
            </div>
          );
        })}
        {program.pattern.waste > 0.5 && (
          <div className="lane lane-spacer" style={{ flex: `${program.pattern.waste} 0 0` }} />
        )}
        {edgeTrim > 0 && (
          <div className="lane lane-spacer" style={{ flex: `${edgeTrim} 0 0` }} />
        )}
      </div>
    </div>
  );
}

function ProgramProductsTable({
  program,
  products,
  allowOvershoot,
}: {
  program: ProgramResult;
  products: RankedPlan["products"];
  allowOvershoot: boolean;
}) {
  const rows = productIndicesInProgram(program)
    .map((index) => {
      const product = products[index];
      if (!product) return null;
      const pieces = program.piecesPerProduct[index] ?? 0;
      const weightKg = program.weightPerProductKg[index] ?? 0;
      return { product, index, pieces, weightKg };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Pedido</th>
            <th>Peso un.</th>
            <th>Produzido</th>
            <th>Peso produzido</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product, index, pieces, weightKg }) => (
            <tr key={product.blank.id}>
              <td>
                <strong style={{ color: BLANK_COLORS[index % BLANK_COLORS.length] }}>
                  {isSlitterItem(product.blank)
                    ? `${fmtInt(product.blank.width)} mm slitter`
                    : fmtDim(product.blank.width, product.blank.length)}
                </strong>
              </td>
              <td>
                {isSlitterItem(product.blank)
                  ? `${product.blank.minQty > 0 ? `${fmtInt(product.blank.minQty)} un · ` : ""}${fmtKg(product.blank.minKg)}`
                  : `${fmtInt(product.blank.minQty)} un · ${fmtKg(product.blank.minKg)}`}
              </td>
              <td>
                {isSlitterItem(product.blank)
                  ? `${fmtNumber(product.unitWeightKg, 4)} Kg/mm`
                  : fmtKg(product.unitWeightKg)}
              </td>
              <td>
                {isSlitterItem(product.blank)
                  ? fmtMeters(pieces)
                  : `${fmtInt(pieces)} un`}
                {!isSlitterItem(product.blank) &&
                allowOvershoot &&
                pieces > product.blank.minQty
                  ? ` (+${pieces - product.blank.minQty})`
                  : ""}
              </td>
              <td>
                {fmtKg(weightKg)}
                {allowOvershoot && weightKg > product.blank.minKg
                  ? ` (+${fmtNumber(weightKg - product.blank.minKg, 1)} Kg)`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function patternSummary(program: ProgramResult, products: RankedPlan["products"]): string {
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const strip of program.pattern.strips) {
    if (seen.has(strip.productIndex)) continue;
    seen.add(strip.productIndex);
    const blank = products[strip.productIndex]?.blank;
    if (!blank) continue;
    parts.push(blankSpecCitationLine(blank));
  }
  return parts.join(" + ");
}

/** Calculadora do modelo Slitters — Itens unificados (como chapas/bobinas). */
export default function SlitterCalculator() {
  const draft = useMemo(() => loadDraft(), []);
  const [items, setItems] = useState<BlankInput[]>(() =>
    draft?.items?.length ? draft.items : EMPTY_ITEMS,
  );
  const [allowOvershoot, setAllowOvershoot] = useState(() => draft?.allowOvershoot ?? true);
  const [demandModes, setDemandModes] = useState<Record<string, "qty" | "weight">>(() => {
    if (draft?.demandModes && Object.keys(draft.demandModes).length > 0) {
      return draft.demandModes;
    }
    if (draft?.items?.length) {
      return Object.fromEntries(draft.items.map((item) => [item.id, "weight" as const]));
    }
    return EMPTY_MODES;
  });
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [priceTableRevision, setPriceTableRevision] = useState(0);
  const [conditions, setConditions] = useState<QuoteConditionsState>(() => ({
    ...EMPTY_QUOTE_CONDITIONS,
    ...(draft?.conditions ?? {}),
  }));
  const [client, setClient] = useState<QuoteClientInfo>(() => ({
    ...EMPTY_QUOTE_CLIENT,
    ...(draft?.client ?? {}),
  }));
  const [status, setStatus] = useState<{ text: string; kind: "" | "ok" | "error" }>({
    text: "",
    kind: "",
  });

  useEffect(() => {
    saveDraft({ client, items, conditions, demandModes, allowOvershoot });
  }, [client, items, conditions, demandModes, allowOvershoot]);

  useEffect(() => {
    let cancelled = false;
    void loadPriceTable().then(() => {
      if (!cancelled) setPriceTableRevision((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const coil = useMemo(
    () => coilFromSlitterItems(items, allowOvershoot),
    [items, allowOvershoot],
  );

  const result = useMemo(() => optimizeCutting({ coil, blanks: items }), [coil, items]);
  const plan: RankedPlan | null = result.ok
    ? result.alternatives[selectedAlt] ?? result.alternatives[0] ?? null
    : null;

  const itemLossById = useMemo(
    () => itemLossFromPlan(plan, coil),
    [plan, coil],
  );

  const summary = useMemo(
    () => quoteSummary(items, itemLossById, conditions.frete),
    [items, itemLossById, conditions.frete],
  );

  const updateCondition = (key: keyof QuoteConditionsState, value: string) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      saveDraft({ client, items, conditions, demandModes, allowOvershoot });
      setStatus({ text: "Orçamento salvo neste navegador.", kind: "ok" });
    } catch {
      setStatus({ text: "Não foi possível salvar.", kind: "error" });
    }
  };

  const handlePdf = (variant: "cliente" | "liganer" | "gestao") => {
    if ((variant === "liganer" || variant === "gestao") && !plan) {
      setStatus({
        text:
          variant === "gestao"
            ? "Calcule um plano de corte antes de gerar o PDF gestão."
            : "Calcule um plano de corte antes de gerar o PDF Liganer.",
        kind: "error",
      });
      return;
    }
    exportQuotePdf({
      kind: variant,
      items,
      conditions,
      summary,
      lossByItemId: itemLossById,
      plan,
      coil,
      client,
    });
    setStatus({
      text:
        variant === "cliente"
          ? "PDF cliente gerado."
          : variant === "gestao"
            ? "PDF gestão gerado."
            : "PDF Liganer gerado.",
      kind: "ok",
    });
  };

  return (
    <div className="calculator-model" data-model="slitters">
      <QuoteClientFields client={client} onChange={setClient} />

      <SlitterItemsTable
        items={items}
        coil={coil}
        demandModes={demandModes}
        allowOvershoot={allowOvershoot}
        priceTableRevision={priceTableRevision}
        itemLossById={itemLossById}
        fretePercent={conditions.frete}
        onAllowOvershootChange={(value) => {
          setSelectedAlt(0);
          setAllowOvershoot(value);
        }}
        onDemandModesChange={(next) => {
          setSelectedAlt(0);
          setDemandModes(next);
        }}
        onItemsChange={(next) => {
          setSelectedAlt(0);
          setItems(next);
        }}
      />

      <QuoteTotals summary={summary} />
      <QuoteConditions
        conditions={conditions}
        onChange={updateCondition}
        onSave={handleSave}
        onPdfCliente={() => handlePdf("cliente")}
        onPdfLiganer={() => handlePdf("liganer")}
        onPdfGestao={() => handlePdf("gestao")}
        statusText={status.text}
        statusKind={status.kind}
      />

      <div className="grid results-grid">
        <section className="card span-all">
          <div className="section-head">
            <h2>Resultado do corte</h2>
          </div>
          {!result.ok && <div className="error">{result.message}</div>}
          {result.ok && plan && (
            <>
              <p className="note">
                <strong>{plan.setupCount}</strong> programa{plan.setupCount > 1 ? "s" : ""} de corte
              </p>

              {plan.programs.map((program, idx) => {
                const programCoil = coilForProgram(program, plan.products, coil);
                const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
                const breakdown = lossBreakdown([program], usefulKg, programCoil);
                return (
                  <div className="program" key={idx}>
                    <div className="program-head">
                      <h3>
                        Programa {idx + 1} ·{" "}
                        {patternSummary(program, plan.products)}
                      </h3>
                    </div>
                    <p className="note" style={{ marginTop: 0 }}>
                      Comprimento total: <strong>{fmtMeters(program.coilLengthMm)}</strong>
                    </p>
                    <LanePreview
                      program={program}
                      coilWidth={programCoil.width}
                      edgeTrim={programCoil.edgeTrim}
                    />
                    <table>
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Acabamento</th>
                          <th>PVC</th>
                          <th>Espessura</th>
                          <th>Largura</th>
                          <th>Comprimento</th>
                          <th>Peças nesta tira</th>
                          <th>Cortes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupIdenticalStrips(program.pattern.strips).map((strip, sIdx) => {
                          const blank = plan.products[strip.productIndex]?.blank;
                          const continuous =
                            blank && isSlitterItem(blank) && strip.cutLength <= 1 + 1e-9;
                          const n = continuous
                            ? 1
                            : Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
                          const displayLen = continuous ? program.coilLengthMm : strip.cutLength;
                          const spec = blank ? blankSpecCitation(blank) : null;
                          return (
                            <tr key={sIdx}>
                              <td>{spec?.tipo ?? "—"}</td>
                              <td>{spec?.acabamento ?? "—"}</td>
                              <td>{spec?.pvc ?? "—"}</td>
                              <td>{spec?.espessura ?? "—"}</td>
                              <td>{fmtMm(strip.stripWidth)}</td>
                              <td>
                                {fmtMm(displayLen)}
                                {strip.rotated ? " (girado)" : ""}
                              </td>
                              <td>{fmtInt(n)}</td>
                              <td>{fmtInt(strip.stripCount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="section-head" style={{ marginTop: 16 }}>
                      <h3>Melhor aproveitamento</h3>
                    </div>
                    <p className="note loss-info-note">
                      Sobra longitudinal: <strong>{fmtPct(breakdown.longitudinalPct)}</strong>{" "}
                      ({fmtPlainInt(breakdown.widthWasteMm)}mm)
                      {" "}· Sobra transversal: <strong>{fmtPct(breakdown.transversalPct)}</strong>{" "}
                      ({fmtKg(breakdown.transversalKg)})
                      {" "}· Refile: <strong>{fmtPlainMm(programCoil.edgeTrim * 2)}</strong>:{" "}
                      <strong>{fmtPct(breakdown.refilePct)}</strong> ({fmtKg(breakdown.refileKg)})
                      {" "}— refile e transversal não entram no %; o refile só reduz a largura útil dos planos de corte.
                    </p>
                    <div className="kpis">
                      <div className="kpi good">
                        <span>Aproveitamento</span>
                        <b>{fmtPct(breakdown.yieldPercent)}</b>
                      </div>
                      <div className="kpi">
                        <span>Peso necessário</span>
                        <b>{fmtKg(breakdown.physicalCoilKg)}</b>
                      </div>
                    </div>

                    <ProgramProductsTable
                      program={program}
                      products={plan.products}
                      allowOvershoot={coil.allowOvershoot ?? true}
                    />
                  </div>
                );
              })}
            </>
          )}
        </section>
      </div>

      {result.ok && result.alternatives.length > 0 && (
        <section className="card" style={{ marginTop: 20 }}>
          <div className="section-head">
            <h2>
              {result.alternatives.length > 1 ? "Planos de corte possíveis" : "Detalhe do plano"}
            </h2>
          </div>
          <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
            Compare soluções com um único setup ou com vários programas (trocas de faca na largura).
          </p>
          {result.alternatives.map((alt, idx) => (
            <button
              key={alt.label + idx}
              className={`alt ${idx === selectedAlt ? "active" : ""}`}
              type="button"
              onClick={() => setSelectedAlt(idx)}
            >
              <strong>
                {idx === 0 ? "Recomendado · " : ""}
                {alt.label}
              </strong>
              <div className="note" style={{ marginTop: 4 }}>
                {fmtPct(alt.yieldPercent)} aproveit. · {fmtKg(alt.coilWeightKg)} necessário ·{" "}
                {alt.setupCount} programa{alt.setupCount > 1 ? "s" : ""}
                {alt.programs.length > 1 && (
                  <>
                    {" "}
                    · {alt.programs.map((p, i) => `P${i + 1} ${fmtMeters(p.coilLengthMm)}`).join(" + ")}
                  </>
                )}
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
