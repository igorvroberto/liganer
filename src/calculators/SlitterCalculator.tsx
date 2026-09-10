import { useEffect, useMemo, useState } from "react";
import SlitterItemsTable from "../components/SlitterItemsTable";
import { fmtCurrency, fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct } from "../lib/format";
import { lossBreakdown, optimizeCutting, programLoss } from "../lib/optimize";
import { downloadPlanPdf } from "../lib/pdfReport";
import { loadPriceTable } from "../lib/priceTable";
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
          return (
            <div
              key={`${strip.productIndex}-${idx}`}
              className="lane"
              style={{ flex: `${strip.stripWidth} 1 0` }}
            >
              <div className="blank-rect" style={{ background: color }}>
                {fmtDim(strip.stripWidth, strip.cutLength)}
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
  return program.pattern.strips
    .map((strip) => {
      const blank = products[strip.productIndex].blank;
      const label = isSlitterItem(blank)
        ? blank.length > 0
          ? `${blank.width}×${blank.length} slitter`
          : `${blank.width} mm slitter`
        : `${blank.width}×${blank.length}`;
      return `${label} ${fmtInt(strip.stripWidth)} mm`;
    })
    .join(" + ");
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

      {pricing && plan && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="section-head">
            <h2>Preço do plano</h2>
          </div>
          <div className="pricing-results">
            <div className="pricing-result highlight">
              <span>Preço considerando perda longitudinal (R$/Kg)</span>
              <b>{pricing.priceWithLongLoss != null ? fmtCurrency(pricing.priceWithLongLoss) : "—"}</b>
            </div>
            <div className="pricing-result">
              <span>Preço desconsiderando perda (R$/Kg)</span>
              <b>{pricing.priceWithoutLoss != null ? fmtCurrency(pricing.priceWithoutLoss) : "—"}</b>
            </div>
            <div className="pricing-result">
              <span>Perda longitudinal</span>
              <b>{fmtPct(pricing.breakdown.longitudinalPct)}</b>
            </div>
          </div>
          <p className="note">
            Valores com base no 1º item com preço/fator preenchidos · bobina {fmtMm(coil.width)} ·{" "}
            {fmtNumber(coil.thickness, 2)} mm
            {coil.line ? ` · ${coil.line}` : ""}
          </p>
        </section>
      )}

      <div className="grid results-grid">
        <section className="card span-all">
          <div className="section-head">
            <h2>Melhor aproveitamento</h2>
          </div>
          {!result.ok && <div className="error">{result.message}</div>}
          {result.ok && plan && (
            <>
              {(() => {
                const breakdown = lossBreakdown(plan.programs, plan.usefulWeightKg, coil);
                return (
                  <p className="note loss-info-note">
                    <strong>Aproveitamento na largura total da bobina, desconsiderando o refile.</strong>
                    {" "}Refile: <strong>{fmtMm(coil.edgeTrim * 2)}</strong> (2×{fmtMm(coil.edgeTrim)})
                    {" "}· {fmtKg(breakdown.refileKg)} ({fmtPct(breakdown.refilePct)})
                    {" "}· Perda transversal: <strong>{fmtPct(breakdown.transversalPct)}</strong>
                    {" "}({fmtKg(breakdown.transversalKg)})
                    {" "}· Perda total: <strong>{fmtPct(100 - plan.yieldPercent)}</strong>
                    {" "}— refile e transversal não entram no %; o refile só reduz a largura útil dos planos de corte.
                  </p>
                );
              })()}
              <div className="kpis">
                <div className="kpi good">
                  <span>Aproveitamento</span>
                  <b>{fmtPct(plan.yieldPercent)}</b>
                </div>
                <div className="kpi">
                  <span>Peso da bobina</span>
                  <b>{fmtKg(plan.coilWeightKg)}</b>
                </div>
                <div className="kpi">
                  <span>Peso útil</span>
                  <b>{fmtKg(plan.usefulWeightKg)}</b>
                </div>
                <div className="kpi">
                  <span>Sucata (longitudinal)</span>
                  <b>{fmtKg(plan.scrapKg)}</b>
                </div>
              </div>

              <p className="note">
                Comprimento total: <strong>{fmtMeters(plan.totalCoilLengthMm)}</strong> ·{" "}
                <strong>{plan.setupCount}</strong> programa{plan.setupCount > 1 ? "s" : ""} de corte
              </p>
              <ProgramTimeline programs={plan.programs} totalLengthMm={plan.totalCoilLengthMm} />

              {plan.programs.map((program, idx) => (
                <div className="program" key={idx}>
                <div className="program-head">
                  <h3>
                    Programa {idx + 1} · {fmtMeters(program.coilLengthMm)} de bobina ·{" "}
                    {patternSummary(program, plan.products)}
                  </h3>
                </div>
                  <LanePreview program={program} coilWidth={coil.width} edgeTrim={coil.edgeTrim} />
                  <table>
                    <thead>
                      <tr>
                        <th>Tira</th>
                        <th>Orientação</th>
                        <th>Peças nesta tira</th>
                      </tr>
                    </thead>
                    <tbody>
                      {program.pattern.strips.map((strip, sIdx) => {
                        const n = Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
                        return (
                          <tr key={sIdx}>
                            <td>{fmtMm(strip.stripWidth)}</td>
                            <td>
                              {fmtDim(strip.stripWidth, strip.cutLength)}
                              {strip.rotated ? " (girado)" : ""}
                            </td>
                            <td>{fmtInt(n)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <ProgramLossNote program={program} coil={coil} />
                </div>
              ))}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Blank</th>
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
                              ? product.blank.length > 0
                                ? fmtDim(product.blank.width, product.blank.length)
                                : `${fmtInt(product.blank.width)} mm slitter`
                              : fmtDim(product.blank.width, product.blank.length)}
                          </strong>
                        </td>
                        <td>
                          {fmtInt(product.blank.minQty)} un · {fmtKg(product.blank.minKg)}
                        </td>
                        <td>{fmtKg(product.unitWeightKg)}</td>
                        <td>
                          {fmtInt(product.pieces)} un
                          {(coil.allowOvershoot ?? true) && product.pieces > product.blank.minQty
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

      {plan && (
        <div className="pdf-dock">
          <button className="btn btn-primary btn-pdf" type="button" onClick={() => downloadPlanPdf(plan, coil)}>
            Gerar relatório PDF
          </button>
        </div>
      )}
    </div>
  );
}
