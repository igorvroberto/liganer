import { useEffect, useMemo, useState } from "react";
import QuoteConditions from "../components/QuoteConditions";
import QuoteTotals from "../components/QuoteTotals";
import SlitterItemsTable from "../components/SlitterItemsTable";
import { fmtCurrency, fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct } from "../lib/format";
import { blankSpecCitation, blankSpecCitationLine } from "../lib/materialGroups";
import { groupIdenticalStrips, lossBreakdown, optimizeCutting, programLoss } from "../lib/optimize";
import { downloadPlanPdf } from "../lib/pdfReport";
import { loadPriceTable } from "../lib/priceTable";
import {
  downloadItemsCsv,
  downloadItemsExcel,
  loadQuoteConditions,
  saveQuoteDraft,
} from "../lib/quoteExport";
import {
  EMPTY_QUOTE_CONDITIONS,
  quoteSummary,
  type QuoteConditions as QuoteConditionsState,
} from "../lib/quoteSummary";
import { coilFromSlitterItems } from "../lib/slitterCoil";
import {
  BLANK_COLORS,
  isSlitterItem,
  type BlankInput,
  type CoilInput,
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

function ProgramTimeline({
  programs,
  totalLengthMm,
}: {
  programs: ProgramResult[];
  totalLengthMm: number;
}) {
  if (programs.length <= 1) return null;
  return (
    <div className="timeline" aria-label="Sequência de programas na bobina">
      {programs.map((program, idx) => (
        <div
          key={idx}
          className="timeline-seg"
          style={{ flex: program.coilLengthMm / totalLengthMm }}
          title={`Programa ${idx + 1}: ${fmtMeters(program.coilLengthMm)}`}
        >
          P{idx + 1}
        </div>
      ))}
    </div>
  );
}

function ProgramLossNote({ program, coil }: { program: ProgramResult; coil: CoilInput }) {
  const loss = programLoss(program, coil);
  return (
    <p className="program-loss">
      Perda (longitudinal): <strong>{fmtPct(loss.lossPercent)}</strong>
      <span>
        {" "}
        · sucata {fmtKg(loss.scrapKg)} · sobra {fmtMm(loss.widthWasteMm)} ({fmtPct(loss.widthLossPercent)})
      </span>
    </p>
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

function calcUsedFactorPrice(priceFactor100: number | undefined, usedFactor: number | undefined): number | null {
  if (!priceFactor100 || !usedFactor || usedFactor <= 0) return null;
  return priceFactor100 / (usedFactor / 100);
}

/** Calculadora do modelo Slitters — Itens unificados (como chapas/bobinas). */
export default function SlitterCalculator() {
  const [items, setItems] = useState<BlankInput[]>(EMPTY_ITEMS);
  const [allowOvershoot, setAllowOvershoot] = useState(true);
  const [demandModes, setDemandModes] = useState<Record<string, "qty" | "weight">>(EMPTY_MODES);
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [priceTableRevision, setPriceTableRevision] = useState(0);
  const [conditions, setConditions] = useState<QuoteConditionsState>(EMPTY_QUOTE_CONDITIONS);
  const [status, setStatus] = useState<{ text: string; kind: "" | "ok" | "error" }>({
    text: "",
    kind: "",
  });

  useEffect(() => {
    const saved = loadQuoteConditions();
    if (saved) setConditions({ ...EMPTY_QUOTE_CONDITIONS, ...saved });
  }, []);

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

  const summary = useMemo(() => quoteSummary(items), [items]);

  const pricing = useMemo(() => {
    if (!plan) return null;
    const usedPrice = calcUsedFactorPrice(coil.priceFactor100, coil.usedFactor);
    const servicePrice = coil.servicePrice ?? 0;
    const breakdown = lossBreakdown(plan.programs, plan.usefulWeightKg, coil);
    const longitudinalPct = breakdown.longitudinalPct;
    return {
      breakdown,
      priceWithLongLoss:
        usedPrice != null ? usedPrice * (1 + longitudinalPct / 100) + servicePrice : null,
      priceWithoutLoss: usedPrice != null ? usedPrice + servicePrice : null,
    };
  }, [plan, coil]);

  const updateCondition = (key: keyof QuoteConditionsState, value: string) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    try {
      saveQuoteDraft(conditions);
      setStatus({ text: "Orçamento salvo neste navegador.", kind: "ok" });
    } catch {
      setStatus({ text: "Não foi possível salvar.", kind: "error" });
    }
  };

  const handlePdf = (variant: "cliente" | "liganer") => {
    if (!plan) {
      setStatus({ text: "Calcule um plano de corte antes de gerar o PDF.", kind: "error" });
      return;
    }
    downloadPlanPdf(plan, coil);
    setStatus({
      text: variant === "cliente" ? "PDF cliente gerado." : "PDF Liganer gerado.",
      kind: "ok",
    });
  };

  const handleExcel = () => {
    downloadItemsExcel(items, conditions);
    setStatus({ text: "Excel exportado.", kind: "ok" });
  };

  const handleCsv = () => {
    downloadItemsCsv(items, conditions);
    setStatus({ text: "CSV exportado.", kind: "ok" });
  };

  return (
    <div className="calculator-model" data-model="slitters">
      <SlitterItemsTable
        items={items}
        coil={coil}
        demandModes={demandModes}
        allowOvershoot={allowOvershoot}
        priceTableRevision={priceTableRevision}
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
        onExcel={handleExcel}
        onCsv={handleCsv}
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
              <ProgramTimeline programs={plan.programs} totalLengthMm={plan.totalCoilLengthMm} />

              {plan.programs.map((program, idx) => {
                const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
                const breakdown = lossBreakdown([program], usefulKg, coil);
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
                    <LanePreview program={program} coilWidth={coil.width} edgeTrim={coil.edgeTrim} />
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
                    <ProgramLossNote program={program} coil={coil} />

                    <div className="section-head" style={{ marginTop: 16 }}>
                      <h3>Melhor aproveitamento</h3>
                    </div>
                    <p className="note loss-info-note">
                      <strong>Aproveitamento na largura total da bobina, desconsiderando o refile.</strong>
                      {" "}Refile: <strong>{fmtMm(coil.edgeTrim * 2)}</strong> (2×{fmtMm(coil.edgeTrim)})
                      {" "}· {fmtKg(breakdown.refileKg)} ({fmtPct(breakdown.refilePct)})
                      {" "}· Perda transversal: <strong>{fmtPct(breakdown.transversalPct)}</strong>
                      {" "}({fmtKg(breakdown.transversalKg)})
                      {" "}· Perda total: <strong>{fmtPct(100 - breakdown.yieldPercent)}</strong>
                      {" "}— refile e transversal não entram no %; o refile só reduz a largura útil dos planos de corte.
                    </p>
                    <div className="kpis">
                      <div className="kpi good">
                        <span>Aproveitamento</span>
                        <b>{fmtPct(breakdown.yieldPercent)}</b>
                      </div>
                      <div className="kpi">
                        <span>Peso da bobina</span>
                        <b>{fmtKg(breakdown.physicalCoilKg)}</b>
                      </div>
                      <div className="kpi">
                        <span>Peso útil</span>
                        <b>{fmtKg(usefulKg)}</b>
                      </div>
                      <div className="kpi">
                        <span>Sucata (longitudinal)</span>
                        <b>{fmtKg(breakdown.scrapKg)}</b>
                      </div>
                    </div>

                    {pricing && (
                      <>
                        <div className="section-head" style={{ marginTop: 16 }}>
                          <h3>Preço do plano</h3>
                        </div>
                        <div className="pricing-results">
                          <div className="pricing-result highlight">
                            <span>Preço considerando perda longitudinal (R$/Kg)</span>
                            <b>
                              {pricing.priceWithLongLoss != null
                                ? fmtCurrency(pricing.priceWithLongLoss)
                                : "—"}
                            </b>
                          </div>
                          <div className="pricing-result">
                            <span>Preço desconsiderando perda (R$/Kg)</span>
                            <b>
                              {pricing.priceWithoutLoss != null
                                ? fmtCurrency(pricing.priceWithoutLoss)
                                : "—"}
                            </b>
                          </div>
                          <div className="pricing-result">
                            <span>Perda longitudinal</span>
                            <b>{fmtPct(pricing.breakdown.longitudinalPct)}</b>
                          </div>
                        </div>
                        <p className="note">
                          Valores com base no 1º item com preço/fator preenchidos · bobina{" "}
                          {fmtMm(coil.width)} · {fmtNumber(coil.thickness, 2)} mm
                          {coil.line ? ` · ${coil.line}` : ""}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}

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
                    {plan.products.map((product, i) => (
                      <tr key={product.blank.id}>
                        <td>
                          <strong style={{ color: BLANK_COLORS[i % BLANK_COLORS.length] }}>
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
                            ? fmtMeters(product.pieces)
                            : `${fmtInt(product.pieces)} un`}
                          {!isSlitterItem(product.blank) &&
                          (coil.allowOvershoot ?? true) &&
                          product.pieces > product.blank.minQty
                            ? ` (+${product.pieces - product.blank.minQty})`
                            : ""}
                        </td>
                        <td>
                          {fmtKg(product.weightKg)}
                          {(coil.allowOvershoot ?? true) && product.weightKg > product.blank.minKg
                            ? ` (+${fmtNumber(product.weightKg - product.blank.minKg, 1)} Kg)`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note">
                {coil.allowOvershoot === false
                  ? "O peso de cada item não passa do valor digitado. Tiras do mesmo programa são ajustadas para baixo quando necessário."
                  : "O corte pode ultrapassar um pouco o pedido quando os blanks compartilham o mesmo programa na bobina."}
              </p>
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
                {fmtPct(alt.yieldPercent)} aproveit. · {fmtKg(alt.coilWeightKg)} bobina ·{" "}
                {alt.setupCount} programa{alt.setupCount > 1 ? "s" : ""} · sucata {fmtKg(alt.scrapKg)}
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
