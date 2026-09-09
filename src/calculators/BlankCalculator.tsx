import { useEffect, useMemo, useState } from "react";
import BlankItemsTable from "../components/BlankItemsTable";
import { resyncBlankDemand } from "../lib/blankSync";
import { fmtCurrency, fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct, fmtThickness, parseDecimalBr, parseThickness } from "../lib/format";
import { lossBreakdown, optimizeCutting, programLoss } from "../lib/optimize";
import { downloadPlanPdf } from "../lib/pdfReport";
import {
  BLANK_COLORS,
  DEFAULT_DENSITY,
  FIXED_EDGE_TRIM_MM,
  PVC_OPTIONS,
  type BlankInput,
  type CoilInput,
  type ProgramResult,
  type PvcOption,
  type RankedPlan,
} from "../lib/types";

const EMPTY_COIL: CoilInput = {
  width: 0,
  thickness: 0,
  density: DEFAULT_DENSITY,
  kerf: 0,
  edgeTrim: FIXED_EDGE_TRIM_MM,
  allowOvershoot: true,
  line: "",
};

const EMPTY_BLANKS: BlankInput[] = [
  { id: "blank-1", name: "", width: 0, length: 0, minKg: 0, minQty: 0 },
];

const EMPTY_MODES: Record<string, "qty" | "weight"> = {
  "blank-1": "weight",
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
      const label = `${blank.width}×${blank.length}`;
      return `${label} ${fmtInt(strip.stripWidth)} mm`;
    })
    .join(" + ");
}

function calcUsedFactorPrice(priceFactor100: number | undefined, usedFactor: number | undefined): number | null {
  if (!priceFactor100 || !usedFactor || usedFactor <= 0) return null;
  return priceFactor100 / (usedFactor / 100);
}

/**
 * Calculadora do modelo Blanks.
 * Por enquanto copia a mecânica de Slitters; as regras específicas virão em seguida.
 */
export default function BlankCalculator() {
  const [coil, setCoil] = useState<CoilInput>(EMPTY_COIL);
  const [thicknessText, setThicknessText] = useState("");
  const [priceFactor100Text, setPriceFactor100Text] = useState("");
  const [usedFactorText, setUsedFactorText] = useState("");
  const [servicepriceText, setServicePriceText] = useState("");
  const [blanks, setBlanks] = useState<BlankInput[]>(EMPTY_BLANKS);
  const [demandModes, setDemandModes] = useState<Record<string, "qty" | "weight">>(EMPTY_MODES);
  const [selectedAlt, setSelectedAlt] = useState(0);

  useEffect(() => {
    setBlanks((prev) =>
      prev.map((blank) => resyncBlankDemand(blank, coil, demandModes[blank.id] ?? "weight")),
    );
  }, [coil.thickness]);

  const result = useMemo(() => optimizeCutting({ coil, blanks }), [coil, blanks]);
  const plan: RankedPlan | null = result.ok
    ? result.alternatives[selectedAlt] ?? result.alternatives[0] ?? null
    : null;

  const updateCoil = (patch: Partial<CoilInput>) => {
    setSelectedAlt(0);
    setCoil((prev) => ({ ...prev, ...patch, density: DEFAULT_DENSITY, edgeTrim: FIXED_EDGE_TRIM_MM }));
  };

  const setThickness = (value: number) => {
    updateCoil({ thickness: Number(value.toFixed(2)) });
    setThicknessText(fmtThickness(value));
  };

  return (
    <div className="calculator-model" data-model="blanks">
      <section className="card coil-card">
        <h2>Bobina</h2>
        <div className="fields coil-fields">
          <label className="field">
            <span>Linha</span>
            <input
              type="text"
              placeholder="Ex.: 304 2B"
              value={coil.line ?? ""}
              onChange={(e) => updateCoil({ line: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Espessura (mm)</span>
            <input
              inputMode="decimal"
              value={thicknessText}
              onChange={(e) => {
                const raw = e.target.value.replace(".", ",");
                if (!/^\d*(,\d{0,2})?$/.test(raw)) return;
                setThicknessText(raw);
                const parsed = parseThickness(raw);
                if (parsed !== null) {
                  updateCoil({ thickness: Number(parsed.toFixed(2)) });
                }
              }}
              onBlur={() => {
                const parsed = parseThickness(thicknessText);
                if (parsed !== null) setThickness(parsed);
                else setThicknessText(fmtThickness(coil.thickness));
              }}
            />
          </label>
          <label className="field">
            <span>Largura original da bobina (mm)</span>
            <input
              type="number"
              min={1}
              value={coil.width || ""}
              onChange={(e) => updateCoil({ width: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="field span-all">
          <span>O peso informado pode ser ultrapassado?</span>
          <div className="chips">
            <button
              type="button"
              className={`chip ${(coil.allowOvershoot ?? true) ? "active" : ""}`}
              onClick={() => updateCoil({ allowOvershoot: true })}
            >
              Sim
            </button>
            <button
              type="button"
              className={`chip ${coil.allowOvershoot === false ? "active" : ""}`}
              onClick={() => updateCoil({ allowOvershoot: false })}
            >
              Não
            </button>
          </div>
          <p className="note" style={{ marginTop: 6 }}>
            {coil.allowOvershoot === false
              ? "O Kg digitado em cada item é o máximo. Se um programa produzir além disso, as demais tiras são reduzidas."
              : "O plano pode produzir um pouco acima do Kg informado quando as tiras compartilham o mesmo comprimento de bobina."}
          </p>
        </div>

      </section>

      <section className="card">
        <h2>Formação de preço</h2>
        <div className="fields coil-fields">
          <label className="field">
            <span>Preço bobina reduzida fator 100 (R$/Kg)</span>
            <input
              inputMode="decimal"
              placeholder="Ex.: 45,00"
              value={priceFactor100Text}
              onChange={(e) => {
                const raw = e.target.value;
                setPriceFactor100Text(raw);
                const v = parseDecimalBr(raw);
                updateCoil({ priceFactor100: v ?? undefined });
              }}
            />
          </label>
          <label className="field">
            <span>PVC</span>
            <select
              value={coil.pvc ?? "sem"}
              onChange={(e) => updateCoil({ pvc: e.target.value as PvcOption })}
            >
              {PVC_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Fator utilizado</span>
            <input
              inputMode="decimal"
              placeholder="Ex.: 170"
              value={usedFactorText}
              onChange={(e) => {
                const raw = e.target.value;
                setUsedFactorText(raw);
                const v = parseDecimalBr(raw);
                updateCoil({ usedFactor: v ?? undefined });
              }}
            />
          </label>
          <label className="field">
            <span>Preço fator utilizado (R$/Kg)</span>
            <input
              readOnly
              tabIndex={-1}
              className="input-readonly"
              value={(() => {
                const p = calcUsedFactorPrice(coil.priceFactor100, coil.usedFactor);
                return p !== null ? fmtCurrency(p) : "—";
              })()}
            />
          </label>
          <label className="field">
            <span>Perda longitudinal (%)</span>
            <input
              readOnly
              tabIndex={-1}
              className="input-readonly"
              value={plan ? fmtPct(lossBreakdown(plan.programs, plan.usefulWeightKg, coil).longitudinalPct) : "—"}
            />
          </label>
        </div>
        <div className="fields coil-fields" style={{ marginTop: 16 }}>
          <label className="field">
            <span>Preço serviço (R$)</span>
            <input
              inputMode="decimal"
              placeholder="Ex.: 1,24"
              value={servicepriceText}
              onChange={(e) => {
                const raw = e.target.value;
                setServicePriceText(raw);
                const v = parseDecimalBr(raw);
                updateCoil({ servicePrice: v ?? undefined });
              }}
            />
          </label>
          <label className="field">
            <span>Descrição do serviço</span>
            <input
              type="text"
              placeholder="Ex.: Corte (0,38) + Recorte (0,38) + PVC azul (0,48)"
              value={coil.serviceDescription ?? ""}
              onChange={(e) => updateCoil({ serviceDescription: e.target.value || undefined })}
            />
          </label>
        </div>
        {(() => {
          const usedPrice = calcUsedFactorPrice(coil.priceFactor100, coil.usedFactor);
          const servicePrice = coil.servicePrice ?? 0;
          const breakdown = plan ? lossBreakdown(plan.programs, plan.usefulWeightKg, coil) : null;
          const longitudinalPct = breakdown ? breakdown.longitudinalPct : 0;
          const priceWithLongLoss = usedPrice != null ? usedPrice * (1 + longitudinalPct / 100) + servicePrice : null;
          const priceWithoutLoss = usedPrice != null ? usedPrice + servicePrice : null;
          return (
            <div className="pricing-results" style={{ marginTop: 16 }}>
              <div className="pricing-result highlight">
                <span>Preço considerando perda longitudinal (R$/Kg)</span>
                <b>{priceWithLongLoss != null && plan ? fmtCurrency(priceWithLongLoss) : "—"}</b>
              </div>
              <div className="pricing-result">
                <span>Preço desconsiderando perda (R$/Kg)</span>
                <b>{priceWithoutLoss != null ? fmtCurrency(priceWithoutLoss) : "—"}</b>
              </div>
            </div>
          );
        })()}
      </section>

      <section className="card">
        <BlankItemsTable
          blanks={blanks}
          coil={coil}
          demandModes={demandModes}
          onDemandModesChange={(next) => {
            setSelectedAlt(0);
            setDemandModes(next);
          }}
          onBlanksChange={(next) => {
            setSelectedAlt(0);
            setBlanks(next);
          }}
        />
      </section>

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
                            {fmtDim(product.blank.width, product.blank.length)}
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
