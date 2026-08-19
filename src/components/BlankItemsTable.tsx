import { fmtNumber } from "../lib/format";
import { blankUnitKg, resyncBlankDemand, syncBlankFromQty, syncBlankFromWeight } from "../lib/blankSync";
import { BLANK_COLORS, type BlankInput, type CoilInput } from "../lib/types";

type DemandModeMap = Record<string, "qty" | "weight">;

type Props = {
  blanks: BlankInput[];
  coil: CoilInput;
  demandModes: DemandModeMap;
  onDemandModesChange: (next: DemandModeMap) => void;
  onBlanksChange: (next: BlankInput[]) => void;
};

function dimLabel(blank: BlankInput): string {
  if (blank.width > 0 && blank.length > 0) {
    return `${blank.width}×${blank.length}`;
  }
  return "item";
}

export default function BlankItemsTable({
  blanks,
  coil,
  demandModes,
  onDemandModesChange,
  onBlanksChange,
}: Props) {
  const setBlanks = (updater: (prev: BlankInput[]) => BlankInput[]) => {
    onBlanksChange(updater(blanks));
  };

  const setMode = (id: string, mode: "qty" | "weight") => {
    onDemandModesChange({ ...demandModes, [id]: mode });
  };

  const updateBlank = (id: string, patch: Partial<BlankInput>, mode?: "qty" | "weight") => {
    setBlanks((prev) =>
      prev.map((blank) => {
        if (blank.id !== id) return blank;
        const next = { ...blank, ...patch };
        const activeMode = mode ?? demandModes[id] ?? "weight";
        if (patch.width !== undefined || patch.length !== undefined) {
          return resyncBlankDemand(next, coil, activeMode);
        }
        return next;
      }),
    );
  };

  const updateQty = (id: string, raw: string) => {
    setMode(id, "qty");
    const qty = raw === "" ? 0 : Number(raw);
    setBlanks((prev) =>
      prev.map((blank) => {
        if (blank.id !== id) return blank;
        const unitKg = blankUnitKg(blank, coil);
        return { ...blank, ...syncBlankFromQty(Number.isFinite(qty) ? qty : 0, unitKg) };
      }),
    );
  };

  const updateWeight = (id: string, raw: string) => {
    setMode(id, "weight");
    const kg = raw === "" ? 0 : Number(raw);
    setBlanks((prev) =>
      prev.map((blank) => {
        if (blank.id !== id) return blank;
        const unitKg = blankUnitKg(blank, coil);
        return { ...blank, ...syncBlankFromWeight(Number.isFinite(kg) ? kg : 0, unitKg) };
      }),
    );
  };

  const addItem = () => {
    const id = `blank-${Date.now()}`;
    onDemandModesChange({ ...demandModes, [id]: "weight" });
    setBlanks((prev) => [
      ...prev,
      {
        id,
        name: "",
        width: 0,
        length: 0,
        minKg: 1000,
        minQty: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (blanks.length <= 1) return;
    const nextModes = { ...demandModes };
    delete nextModes[id];
    onDemandModesChange(nextModes);
    setBlanks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="items-panel">
      <div className="items-panel-head">
        <div>
          <h2>Itens do pedido</h2>
          <p className="note">Informe largura, comprimento, quantidade e peso. Ao editar quantidade ou peso, o outro campo é recalculado.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={addItem}>
          + Adicionar item
        </button>
      </div>

      <div className="items-table-wrap">
        <table className="items-table">
          <thead>
            <tr>
              <th />
              <th>Largura (mm)</th>
              <th>Comprimento (mm)</th>
              <th>Quantidade (un)</th>
              <th>Peso (kg)</th>
              <th>Peso un.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {blanks.map((blank, index) => {
              const unitKg = blankUnitKg(blank, coil);
              const mode = demandModes[blank.id] ?? "weight";
              return (
                <tr key={blank.id}>
                  <td>
                    <span
                      className="swatch"
                      style={{ background: BLANK_COLORS[index % BLANK_COLORS.length] }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="600"
                      value={blank.width || ""}
                      onChange={(e) => updateBlank(blank.id, { width: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="470"
                      value={blank.length || ""}
                      onChange={(e) => updateBlank(blank.id, { length: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={mode === "qty" ? "linked-active" : "linked"}
                      value={blank.minQty || ""}
                      onChange={(e) => updateQty(blank.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      className={mode === "weight" ? "linked-active" : "linked"}
                      value={blank.minKg || ""}
                      onChange={(e) => updateWeight(blank.id, e.target.value)}
                    />
                  </td>
                  <td className="unit-cell">
                    {unitKg > 0 ? (
                      <>
                        <strong>{fmtNumber(unitKg, 3)} kg</strong>
                        <span>por peça</span>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      type="button"
                      aria-label={`Remover ${dimLabel(blank)}`}
                      onClick={() => removeItem(blank.id)}
                      disabled={blanks.length <= 1}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="note items-footnote">
        Giro automático de 90° na bobina quando melhorar o aproveitamento. A espessura entra no peso unitário.
      </p>
    </div>
  );
}
