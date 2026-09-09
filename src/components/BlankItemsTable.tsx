import { fmtNumber } from "../lib/format";
import { blankUnitKg, resyncBlankDemand, syncBlankFromQty, syncBlankFromWeight } from "../lib/blankSync";
import {
  BLANK_COLORS,
  ITEM_KIND_OPTIONS,
  isSlitterItem,
  itemKindOf,
  type BlankInput,
  type CoilInput,
  type ItemKind,
} from "../lib/types";

type DemandModeMap = Record<string, "qty" | "weight">;

type Props = {
  blanks: BlankInput[];
  coil: CoilInput;
  demandModes: DemandModeMap;
  onDemandModesChange: (next: DemandModeMap) => void;
  onBlanksChange: (next: BlankInput[]) => void;
  /** No modelo Slitters: seletor BLANK/SLITTER antes da largura. */
  allowItemKind?: boolean;
};

function dimLabel(blank: BlankInput): string {
  if (isSlitterItem(blank)) {
    if (blank.width > 0 && blank.length > 0) return `${blank.width}×${blank.length} slitter`;
    return blank.width > 0 ? `${blank.width} mm slitter` : "slitter";
  }
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
  allowItemKind = false,
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
        if (
          patch.width !== undefined ||
          patch.length !== undefined ||
          patch.itemKind !== undefined
        ) {
          return resyncBlankDemand(next, coil, activeMode);
        }
        return next;
      }),
    );
  };

  const updateItemKind = (id: string, kind: ItemKind) => {
    const mode = demandModes[id] ?? "weight";
    setBlanks((prev) =>
      prev.map((blank) => {
        if (blank.id !== id) return blank;
        const next: BlankInput = {
          ...blank,
          itemKind: kind,
        };
        return resyncBlankDemand(next, coil, mode);
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
        itemKind: "blank",
        width: 0,
        length: 0,
        minKg: 0,
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
          <p className="note">
            {allowItemKind
              ? "Selecione BLANK ou SLITTER. BLANK exige comprimento; SLITTER pode informar comprimento, mas não é obrigatório. Ao editar peso ou quantidade, o outro campo é recalculado."
              : "Informe largura, comprimento, peso e quantidade. Ao editar peso ou quantidade, o outro campo é recalculado."}
          </p>
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
              {allowItemKind && <th>Tipo</th>}
              <th>Largura (mm)</th>
              <th>Comprimento (mm)</th>
              <th>Peso (Kg)</th>
              <th>{allowItemKind ? "Qtd" : "Quantidade (un)"}</th>
              <th>Peso un.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {blanks.map((blank, index) => {
              const unitKg = blankUnitKg(blank, coil);
              const mode = demandModes[blank.id] ?? "weight";
              const kind = itemKindOf(blank);
              const slitter = kind === "slitter";
              return (
                <tr key={blank.id}>
                  <td>
                    <span
                      className="swatch"
                      style={{ background: BLANK_COLORS[index % BLANK_COLORS.length] }}
                    />
                  </td>
                  {allowItemKind && (
                    <td>
                      <select
                        className="item-kind-select"
                        value={kind}
                        onChange={(e) => updateItemKind(blank.id, e.target.value as ItemKind)}
                        aria-label="Tipo do item"
                      >
                        {ITEM_KIND_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={blank.width || ""}
                      onChange={(e) => updateBlank(blank.id, { width: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={blank.length || ""}
                      placeholder={slitter ? "opcional" : undefined}
                      onChange={(e) => updateBlank(blank.id, { length: Number(e.target.value) })}
                      title={slitter ? "Opcional para SLITTER" : undefined}
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
                  <td>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className={mode === "qty" ? "linked-active" : "linked"}
                      value={blank.minQty || ""}
                      onChange={(e) => updateQty(blank.id, e.target.value)}
                      title={
                        slitter && !(blank.length > 0)
                          ? "Sem comprimento: quantidade = mm de tira"
                          : undefined
                      }
                    />
                  </td>
                  <td className="unit-cell">
                    {unitKg > 0 ? (
                      <>
                        <strong>{fmtNumber(unitKg, 3)} Kg</strong>
                        <span>{slitter && !(blank.length > 0) ? "por mm" : "por peça"}</span>
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
        {allowItemKind
          ? "BLANK pode girar 90° na bobina. SLITTER entra só na largura (sem giro); comprimento é opcional. A espessura entra no peso unitário."
          : "Giro automático de 90° na bobina quando melhorar o aproveitamento. A espessura entra no peso unitário."}
      </p>
    </div>
  );
}
