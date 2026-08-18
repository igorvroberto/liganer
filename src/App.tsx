import { useMemo, useState } from "react";
import { fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct } from "./lib/format";
import { optimizeCutting } from "./lib/optimize";
import {
  BLANK_COLORS,
  COMMON_THICKNESSES,
  STAINLESS_GRADES,
  type BlankInput,
  type CalcResult,
  type CoilInput,
  type RankedPlan,
} from "./lib/types";

let blankSeq = 3;

function newBlank(partial?: Partial<BlankInput>): BlankInput {
  blankSeq += 1;
  return {
    id: `blank-${blankSeq}`,
    name: "",
    width: 0,
    length: 0,
    minKg: 1000,
    minQty: 0,
    ...partial,
  };
}

const EXAMPLE_COIL: CoilInput = {
  width: 1250,
  thickness: 1,
  density: 7.93,
  kerf: 0,
  edgeTrim: 0,
};

const EXAMPLE_BLANKS: BlankInput[] = [
  { id: "blank-1", name: "Blank A", width: 600, length: 470, minKg: 1000, minQty: 0 },
  { id: "blank-2", name: "Blank B", width: 650, length: 500, minKg: 1000, minQty: 0 },
];

function PatternBar({
  plan,
  coilWidth,
}: {
  plan: RankedPlan | CalcResult;
  coilWidth: number;
}) {
  const program = plan.programs[0];
  if (!program) return null;
  const { pattern } = program;
  const total = coilWidth;
  return (
    <div className="pattern-bar" title={`Largura da bobina ${fmtMm(coilWidth)}`}>
      {pattern.strips.map((strip, idx) => (
        <div
          key={`${strip.productIndex}-${idx}`}
          className="pattern-seg"
          style={{
            width: `${(strip.stripWidth / total) * 100}%`,
            background: BLANK_COLORS[strip.productIndex % BLANK_COLORS.length],
          }}
        >
          {fmtInt(strip.stripWidth)}
        </div>
      ))}
      {pattern.waste > 0.5 && (
        <div className="pattern-seg waste" style={{ width: `${(pattern.waste / total) * 100}%` }}>
          sucata {fmtInt(pattern.waste)}
        </div>
      )}
    </div>
  );
}

function LanePreview({ plan }: { plan: RankedPlan | CalcResult }) {
  const program = plan.programs[0];
  if (!program) return null;
  const maxCut = Math.max(...program.pattern.strips.map((s) => s.cutLength));
  const repeats = 4;
  return (
    <div className="lanes" aria-hidden="true">
      {program.pattern.strips.map((strip, idx) => {
        const color = BLANK_COLORS[strip.productIndex % BLANK_COLORS.length];
        const h = Math.max(42, (strip.cutLength / maxCut) * 52);
        return (
          <div key={`${strip.productIndex}-${idx}`} className="lane">
            {Array.from({ length: repeats }, (_, n) => (
              <div
                key={n}
                className="blank-rect"
                style={{ background: color, height: h }}
              >
                {fmtInt(strip.stripWidth)}×{fmtInt(strip.cutLength)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [coil, setCoil] = useState<CoilInput>(EXAMPLE_COIL);
  const [gradeId, setGradeId] = useState("304");
  const [blanks, setBlanks] = useState<BlankInput[]>(EXAMPLE_BLANKS);
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [printNote] = useState(
    "O peso pode ultrapassar um pouco o mínimo informado, desde que cada blank atinja pelo menos o kg pedido.",
  );

  const result = useMemo(() => optimizeCutting({ coil, blanks }), [coil, blanks]);
  const plan: RankedPlan | null = result.ok
    ? result.alternatives[selectedAlt] ?? result.alternatives[0] ?? null
    : null;

  const updateCoil = (patch: Partial<CoilInput>) => {
    setSelectedAlt(0);
    setCoil((prev) => ({ ...prev, ...patch }));
  };

  const updateBlank = (id: string, patch: Partial<BlankInput>) => {
    setSelectedAlt(0);
    setBlanks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <div className="brand-mark">
            <div className="logo">LG</div>
            <div>
              <div className="eyebrow">Liganer · Aço inoxidável</div>
              <h1>Calculadora de aproveitamento de blanks</h1>
            </div>
          </div>
          <p>
            Combina largura e comprimento dos blanks na largura original da bobina, calcula peso em
            kg e quantidade em peças, e escolhe o plano de corte com melhor aproveitamento.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              setCoil(EXAMPLE_COIL);
              setGradeId("304");
              setBlanks(EXAMPLE_BLANKS);
              setSelectedAlt(0);
            }}
          >
            Carregar exemplo
          </button>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Imprimir
          </button>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Bobina e material</h2>
          <div className="fields">
            <label className="field">
              <span>Largura original da bobina (mm)</span>
              <input
                type="number"
                min={1}
                value={coil.width || ""}
                onChange={(e) => updateCoil({ width: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Espessura (mm)</span>
              <input
                type="number"
                min={0.1}
                step={0.05}
                value={coil.thickness || ""}
                onChange={(e) => updateCoil({ thickness: Number(e.target.value) })}
              />
            </label>
            <div className="field span-2">
              <span>Espessuras comuns</span>
              <div className="chips">
                {COMMON_THICKNESSES.map((t) => (
                  <button
                    key={t}
                    className={`chip ${coil.thickness === t ? "active" : ""}`}
                    onClick={() => updateCoil({ thickness: t })}
                    type="button"
                  >
                    {fmtNumber(t, 2)} mm
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Liga / densidade</span>
              <select
                value={gradeId}
                onChange={(e) => {
                  const grade = STAINLESS_GRADES.find((g) => g.id === e.target.value);
                  setGradeId(e.target.value);
                  if (grade) updateCoil({ density: grade.density });
                }}
              >
                {STAINLESS_GRADES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label} ({fmtNumber(g.density, 2)} g/cm³)
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Densidade (g/cm³)</span>
              <input
                type="number"
                min={1}
                step={0.01}
                value={coil.density || ""}
                onChange={(e) => updateCoil({ density: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Perda entre tiras / faca (mm)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={coil.kerf}
                onChange={(e) => updateCoil({ kerf: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span>Refile de borda (mm cada lado)</span>
              <input
                type="number"
                min={0}
                step={0.5}
                value={coil.edgeTrim}
                onChange={(e) => updateCoil({ edgeTrim: Number(e.target.value) })}
              />
            </label>
          </div>

          <h2 style={{ marginTop: 22 }}>Blanks</h2>
          <div className="blank-head">
            <span />
            <span>Nome</span>
            <span>Largura</span>
            <span>Comprimento</span>
            <span>Peso mín. kg</span>
            <span>Qtd. mín.</span>
            <span />
          </div>
          {blanks.map((blank, index) => (
            <div className="blank-row" key={blank.id}>
              <span
                className="swatch"
                style={{ background: BLANK_COLORS[index % BLANK_COLORS.length] }}
              />
              <input
                placeholder={`Blank ${index + 1}`}
                value={blank.name}
                onChange={(e) => updateBlank(blank.id, { name: e.target.value })}
              />
              <input
                type="number"
                min={1}
                placeholder="mm"
                value={blank.width || ""}
                onChange={(e) => updateBlank(blank.id, { width: Number(e.target.value) })}
              />
              <input
                type="number"
                min={1}
                placeholder="mm"
                value={blank.length || ""}
                onChange={(e) => updateBlank(blank.id, { length: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                value={blank.minKg || ""}
                onChange={(e) => updateBlank(blank.id, { minKg: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                value={blank.minQty || ""}
                onChange={(e) => updateBlank(blank.id, { minQty: Number(e.target.value) })}
              />
              <button
                className="btn-icon"
                type="button"
                aria-label="Remover blank"
                onClick={() => {
                  setSelectedAlt(0);
                  setBlanks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== blank.id)));
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="row-actions">
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setSelectedAlt(0);
                setBlanks((prev) => [...prev, newBlank({ name: `Blank ${prev.length + 1}` })]);
              }}
            >
              + Adicionar blank
            </button>
            <span className="note">Giro automático 90° se melhorar o encaixe na bobina.</span>
          </div>
        </section>

        <section className="card">
          <h2>Melhor aproveitamento</h2>
          {!result.ok && <div className="error">{result.message}</div>}
          {result.ok && plan && (
            <>
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
                  <span>Sucata</span>
                  <b>{fmtKg(plan.scrapKg)}</b>
                </div>
              </div>

              <PatternBar plan={plan} coilWidth={coil.width} />
              <p className="note">
                Comprimento necessário: <strong>{fmtMeters(plan.totalCoilLengthMm)}</strong> ·{" "}
                {plan.setupCount} programa{plan.setupCount > 1 ? "s" : ""} de corte
              </p>
              <LanePreview plan={plan} />

              {plan.programs.map((program, idx) => (
                <div className="program" key={idx}>
                  <h3>
                    Programa {idx + 1} · {fmtMeters(program.coilLengthMm)} de bobina
                  </h3>
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
                        const blank = plan.products[strip.productIndex].blank;
                        const n = Math.floor((program.coilLengthMm + 1e-6) / strip.cutLength);
                        return (
                          <tr key={sIdx}>
                            <td>
                              {blank.name || `Blank ${strip.productIndex + 1}`} · {fmtMm(strip.stripWidth)}
                            </td>
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
                </div>
              ))}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Blank</th>
                      <th>Peso un.</th>
                      <th>Peças</th>
                      <th>Peso produzido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.products.map((product, i) => (
                      <tr key={product.blank.id}>
                        <td>
                          <strong style={{ color: BLANK_COLORS[i % BLANK_COLORS.length] }}>
                            {product.blank.name || `Blank ${i + 1}`}
                          </strong>
                          <div className="note" style={{ marginTop: 0 }}>
                            {fmtDim(product.blank.width, product.blank.length)} · mín. {fmtInt(product.minPieces)} un.
                          </div>
                        </td>
                        <td>{fmtKg(product.unitWeightKg)}</td>
                        <td>{fmtInt(product.pieces)}</td>
                        <td>
                          {fmtKg(product.weightKg)}
                          {product.weightKg > product.blank.minKg && product.blank.minKg > 0
                            ? ` (+${fmtNumber(product.weightKg - product.blank.minKg, 1)} kg)`
                            : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="note">{printNote}</p>
            </>
          )}
        </section>
      </div>

      {result.ok && result.alternatives.length > 1 && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>Outros planos possíveis</h2>
          {result.alternatives.map((alt, idx) => (
            <button
              key={alt.label + idx}
              className={`alt ${idx === selectedAlt ? "active" : ""}`}
              type="button"
              onClick={() => setSelectedAlt(idx)}
            >
              <strong>{idx === 0 ? "Recomendado · " : ""}{alt.label}</strong>
              <div className="note" style={{ marginTop: 4 }}>
                {fmtPct(alt.yieldPercent)} de aproveitamento · {fmtKg(alt.coilWeightKg)} de bobina ·{" "}
                {alt.setupCount} setup{alt.setupCount > 1 ? "s" : ""} · sucata {fmtKg(alt.scrapKg)}
              </div>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
