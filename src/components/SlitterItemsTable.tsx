import { blankUnitKg, resyncBlankDemand, syncBlankFromQty, syncBlankFromWeight } from "../lib/blankSync";
import { fmtCurrency, fmtNumber, fmtThickness, parseDecimalBr, parseThickness } from "../lib/format";
import {
  BLANK_COLORS,
  ITEM_KIND_OPTIONS,
  PVC_OPTIONS,
  isSlitterItem,
  itemKindOf,
  type BlankInput,
  type CoilInput,
  type ItemKind,
  type PvcOption,
} from "../lib/types";

type DemandModeMap = Record<string, "qty" | "weight">;

type Props = {
  items: BlankInput[];
  coil: CoilInput;
  demandModes: DemandModeMap;
  allowOvershoot: boolean;
  onAllowOvershootChange: (value: boolean) => void;
  onDemandModesChange: (next: DemandModeMap) => void;
  onItemsChange: (next: BlankInput[]) => void;
};

function calcUsedFactorPrice(priceFactor100: number | undefined, usedFactor: number | undefined): number | null {
  if (!priceFactor100 || !usedFactor || usedFactor <= 0) return null;
  return priceFactor100 / (usedFactor / 100);
}

function dimLabel(item: BlankInput): string {
  if (isSlitterItem(item)) {
    if (item.width > 0 && item.length > 0) return `${item.width}×${item.length} slitter`;
    return item.width > 0 ? `${item.width} mm slitter` : "slitter";
  }
  if (item.width > 0 && item.length > 0) return `${item.width}×${item.length}`;
  return "item";
}

export default function SlitterItemsTable({
  items,
  coil,
  demandModes,
  allowOvershoot,
  onAllowOvershootChange,
  onDemandModesChange,
  onItemsChange,
}: Props) {
  const setItems = (updater: (prev: BlankInput[]) => BlankInput[]) => {
    onItemsChange(updater(items));
  };

  const setMode = (id: string, mode: "qty" | "weight") => {
    onDemandModesChange({ ...demandModes, [id]: mode });
  };

  const coilForItem = (item: BlankInput): CoilInput => ({
    ...coil,
    thickness: item.thickness && item.thickness > 0 ? item.thickness : coil.thickness,
    width: item.coilWidth && item.coilWidth > 0 ? item.coilWidth : coil.width,
  });

  const updateItem = (id: string, patch: Partial<BlankInput>, mode?: "qty" | "weight") => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        const activeMode = mode ?? demandModes[id] ?? "weight";
        if (
          patch.width !== undefined ||
          patch.length !== undefined ||
          patch.itemKind !== undefined ||
          patch.thickness !== undefined
        ) {
          return resyncBlankDemand(next, coilForItem(next), activeMode);
        }
        return next;
      }),
    );
  };

  const updateItemKind = (id: string, kind: ItemKind) => {
    const mode = demandModes[id] ?? "weight";
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, itemKind: kind };
        return resyncBlankDemand(next, coilForItem(next), mode);
      }),
    );
  };

  const updateQty = (id: string, raw: string) => {
    setMode(id, "qty");
    const qty = raw === "" ? 0 : Number(raw);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const unitKg = blankUnitKg(item, coilForItem(item));
        return { ...item, ...syncBlankFromQty(Number.isFinite(qty) ? qty : 0, unitKg) };
      }),
    );
  };

  const updateWeight = (id: string, raw: string) => {
    setMode(id, "weight");
    const kg = raw === "" ? 0 : Number(raw);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const unitKg = blankUnitKg(item, coilForItem(item));
        return { ...item, ...syncBlankFromWeight(Number.isFinite(kg) ? kg : 0, unitKg) };
      }),
    );
  };

  const addItem = () => {
    const id = `item-${Date.now()}`;
    const template = items[0];
    onDemandModesChange({ ...demandModes, [id]: "weight" });
    setItems((prev) => [
      ...prev,
      {
        id,
        name: "",
        itemKind: "blank",
        width: 0,
        length: 0,
        minKg: 0,
        minQty: 0,
        line: template?.line ?? "",
        thickness: template?.thickness,
        coilWidth: template?.coilWidth,
        pvc: template?.pvc ?? "sem",
        priceFactor100: undefined,
        usedFactor: undefined,
        servicePrice: undefined,
        serviceDescription: undefined,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    const nextModes = { ...demandModes };
    delete nextModes[id];
    onDemandModesChange(nextModes);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <section className="card itens-card">
      <div className="items-panel">
        <div className="items-panel-head">
          <div>
            <h2>Itens</h2>
            <p className="note">
              Como em chapas/bobinas: tudo na linha do item (tipo, bobina, dimensões e preço). BLANK exige
              comprimento; SLITTER pode deixar em branco. O plano de corte usa a largura/espessura da bobina
              do primeiro item preenchido.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={addItem}>
            + Adicionar item
          </button>
        </div>

        <div className="field span-all itens-shared">
          <span>O peso informado pode ser ultrapassado?</span>
          <div className="chips">
            <button
              type="button"
              className={`chip ${allowOvershoot ? "active" : ""}`}
              onClick={() => onAllowOvershootChange(true)}
            >
              Sim
            </button>
            <button
              type="button"
              className={`chip ${!allowOvershoot ? "active" : ""}`}
              onClick={() => onAllowOvershootChange(false)}
            >
              Não
            </button>
          </div>
        </div>

        <div className="items-table-wrap itens-table-scroll">
          <table className="items-table itens-table-wide">
            <thead>
              <tr>
                <th />
                <th>Item</th>
                <th>Tipo</th>
                <th>Linha</th>
                <th>PVC</th>
                <th>Espessura</th>
                <th>Largura bobina</th>
                <th>Largura</th>
                <th>Comprimento</th>
                <th>Peso (Kg)</th>
                <th>Qtd</th>
                <th>Peso un.</th>
                <th>Preço fator 100</th>
                <th>Fator util.</th>
                <th>Preço fator util.</th>
                <th>Preço serviço</th>
                <th>Descrição serviço</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const localCoil = coilForItem(item);
                const unitKg = blankUnitKg(item, localCoil);
                const mode = demandModes[item.id] ?? "weight";
                const kind = itemKindOf(item);
                const slitter = kind === "slitter";
                const usedPrice = calcUsedFactorPrice(item.priceFactor100, item.usedFactor);
                return (
                  <tr key={item.id}>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: BLANK_COLORS[index % BLANK_COLORS.length] }}
                      />
                    </td>
                    <td className="item-index">{index + 1}</td>
                    <td>
                      <select
                        className="item-kind-select"
                        value={kind}
                        onChange={(e) => updateItemKind(item.id, e.target.value as ItemKind)}
                        aria-label="Tipo do item"
                      >
                        {ITEM_KIND_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="304 2B"
                        value={item.line ?? ""}
                        onChange={(e) => updateItem(item.id, { line: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={item.pvc ?? "sem"}
                        onChange={(e) => updateItem(item.id, { pvc: e.target.value as PvcOption })}
                      >
                        {PVC_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="0,40"
                        value={item.thickness ? fmtThickness(item.thickness) : ""}
                        onChange={(e) => {
                          const raw = e.target.value.replace(".", ",");
                          if (!/^\d*(,\d{0,2})?$/.test(raw) && raw !== "") return;
                          const parsed = parseThickness(raw);
                          updateItem(item.id, { thickness: parsed ?? undefined });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="1250"
                        value={item.coilWidth || ""}
                        onChange={(e) =>
                          updateItem(item.id, { coilWidth: Number(e.target.value) || undefined })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.width || ""}
                        onChange={(e) => updateItem(item.id, { width: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.length || ""}
                        placeholder={slitter ? "opcional" : undefined}
                        onChange={(e) => updateItem(item.id, { length: Number(e.target.value) })}
                        title={slitter ? "Opcional para SLITTER" : undefined}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className={mode === "weight" ? "linked-active" : "linked"}
                        value={item.minKg || ""}
                        onChange={(e) => updateWeight(item.id, e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={mode === "qty" ? "linked-active" : "linked"}
                        value={item.minQty || ""}
                        onChange={(e) => updateQty(item.id, e.target.value)}
                      />
                    </td>
                    <td className="unit-cell">
                      {unitKg > 0 ? (
                        <>
                          <strong>{fmtNumber(unitKg, 3)} Kg</strong>
                          <span>{slitter && !(item.length > 0) ? "por mm" : "por peça"}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="45,00"
                        value={item.priceFactor100 != null ? String(item.priceFactor100).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { priceFactor100: v ?? undefined });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="170"
                        value={item.usedFactor != null ? String(item.usedFactor).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { usedFactor: v ?? undefined });
                        }}
                      />
                    </td>
                    <td className="unit-cell">
                      <strong>{usedPrice != null ? fmtCurrency(usedPrice) : "—"}</strong>
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        placeholder="1,24"
                        value={item.servicePrice != null ? String(item.servicePrice).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { servicePrice: v ?? undefined });
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Corte + PVC"
                        value={item.serviceDescription ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { serviceDescription: e.target.value || undefined })
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        type="button"
                        aria-label={`Remover ${dimLabel(item)}`}
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
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
      </div>
    </section>
  );
}
