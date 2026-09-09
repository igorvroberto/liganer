import { blankUnitKg, resyncBlankDemand, syncBlankFromQty, syncBlankFromWeight } from "../lib/blankSync";
import { fmtCurrency, fmtNumber, fmtThickness, parseDecimalBr } from "../lib/format";
import {
  lineLabelFromSpecs,
  lookupPriceFator100,
  priceTableOptions,
} from "../lib/priceTable";
import {
  BLANK_COLORS,
  ITEM_KIND_OPTIONS,
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
  /** Força re-render quando a tabela de preços carrega. */
  priceTableRevision?: number;
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

function withPriceFromTable(item: BlankInput, patch: Partial<BlankInput>): BlankInput {
  const next = { ...item, ...patch };
  const tipo = next.tipo ?? "";
  const acabamento = next.acabamento ?? "";
  next.line = lineLabelFromSpecs(tipo, acabamento) || next.line;

  const specsChanged =
    patch.tipo !== undefined ||
    patch.acabamento !== undefined ||
    patch.thickness !== undefined ||
    patch.pvc !== undefined;

  if (!specsChanged) return next;

  if (tipo && acabamento && next.thickness && next.thickness > 0) {
    const lookup = lookupPriceFator100({
      tipo,
      acabamento,
      espessura: next.thickness,
      pvc: next.pvc ?? "sem",
    });
    next.priceFactor100 = lookup.matched ? lookup.precoFator100 : undefined;
  } else {
    next.priceFactor100 = undefined;
  }
  return next;
}

export default function SlitterItemsTable({
  items,
  coil,
  demandModes,
  allowOvershoot,
  priceTableRevision = 0,
  onAllowOvershootChange,
  onDemandModesChange,
  onItemsChange,
}: Props) {
  void priceTableRevision;
  const globalOpts = priceTableOptions();

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
        const next = withPriceFromTable(item, patch);
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
        tipo: template?.tipo,
        acabamento: template?.acabamento,
        thickness: template?.thickness,
        coilWidth: template?.coilWidth,
        pvc: template?.pvc ?? "sem",
        priceFactor100: template?.priceFactor100,
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
              Tipo, acabamento, PVC e espessura vêm da tabela de preços. O preço fator 100 é preenchido
              automaticamente conforme o PVC. Material BLANK exige comprimento; SLITTER pode deixar em
              branco. O plano de corte usa a largura/espessura da bobina do primeiro item preenchido.
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
                <th className="col-material">Material</th>
                <th className="col-tipo">Tipo</th>
                <th className="col-acabamento">Acabamento</th>
                <th className="col-pvc">PVC</th>
                <th className="col-espessura">Espessura</th>
                <th className="col-coil-width">Largura bobina</th>
                <th className="col-dim">Largura</th>
                <th className="col-dim">Comprimento</th>
                <th className="col-peso">Peso (Kg)</th>
                <th className="col-qtd">Qtd</th>
                <th className="col-unit">Peso un.</th>
                <th className="col-preco-100">Preço fator 100</th>
                <th className="col-fator">Fator util.</th>
                <th className="col-preco-util">Preço fator util.</th>
                <th className="col-servico">Preço serviço</th>
                <th className="col-desc-servico">Descrição serviço</th>
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
                const rowOpts = priceTableOptions({
                  tipo: item.tipo,
                  acabamento: item.acabamento,
                });
                const tipoOpts = globalOpts.tipo;
                const acabOpts = item.tipo ? rowOpts.acabamento : globalOpts.acabamento;
                const espOpts = item.tipo && item.acabamento ? rowOpts.espessura : globalOpts.espessura;
                const pvcOpts = globalOpts.pvc;

                return (
                  <tr key={item.id}>
                    <td>
                      <span
                        className="swatch"
                        style={{ background: BLANK_COLORS[index % BLANK_COLORS.length] }}
                      />
                    </td>
                    <td className="item-index">{index + 1}</td>
                    <td className="col-material">
                      <select
                        className="item-kind-select"
                        value={kind}
                        onChange={(e) => updateItemKind(item.id, e.target.value as ItemKind)}
                        aria-label="Material do item"
                      >
                        {ITEM_KIND_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-tipo">
                      <select
                        value={item.tipo ?? ""}
                        onChange={(e) => {
                          const tipo = e.target.value || undefined;
                          const nextAcabOpts = priceTableOptions({ tipo }).acabamento;
                          const acabamento =
                            tipo && item.acabamento && nextAcabOpts.includes(item.acabamento)
                              ? item.acabamento
                              : undefined;
                          const nextEspOpts = priceTableOptions({ tipo, acabamento }).espessura;
                          const thickness =
                            acabamento &&
                            item.thickness &&
                            nextEspOpts.includes(item.thickness)
                              ? item.thickness
                              : undefined;
                          updateItem(item.id, { tipo, acabamento, thickness });
                        }}
                        aria-label="Tipo"
                      >
                        <option value="">—</option>
                        {tipoOpts.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-acabamento">
                      <select
                        value={item.acabamento ?? ""}
                        onChange={(e) => {
                          const acabamento = e.target.value || undefined;
                          const nextEspOpts = priceTableOptions({
                            tipo: item.tipo,
                            acabamento,
                          }).espessura;
                          const thickness =
                            acabamento &&
                            item.thickness &&
                            nextEspOpts.includes(item.thickness)
                              ? item.thickness
                              : undefined;
                          updateItem(item.id, { acabamento, thickness });
                        }}
                        aria-label="Acabamento"
                        disabled={!item.tipo}
                      >
                        <option value="">—</option>
                        {acabOpts.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-pvc">
                      <select
                        value={item.pvc ?? "sem"}
                        onChange={(e) => updateItem(item.id, { pvc: e.target.value as PvcOption })}
                        aria-label="PVC"
                      >
                        {pvcOpts.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-espessura">
                      <select
                        value={item.thickness ? String(item.thickness) : ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateItem(item.id, {
                            thickness: raw ? Number(raw) : undefined,
                          });
                        }}
                        aria-label="Espessura"
                        disabled={!item.tipo || !item.acabamento}
                      >
                        <option value="">—</option>
                        {espOpts.map((opt) => (
                          <option key={opt} value={String(opt)}>
                            {fmtThickness(opt)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-coil-width">
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
                    <td className="col-dim">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.width || ""}
                        onChange={(e) => updateItem(item.id, { width: Number(e.target.value) })}
                      />
                    </td>
                    <td className="col-dim">
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
                    <td className="col-peso">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        className={mode === "weight" ? "linked-active" : "linked"}
                        value={item.minKg || ""}
                        onChange={(e) => updateWeight(item.id, e.target.value)}
                      />
                    </td>
                    <td className="col-qtd">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={mode === "qty" ? "linked-active" : "linked"}
                        value={item.minQty || ""}
                        onChange={(e) => updateQty(item.id, e.target.value)}
                      />
                    </td>
                    <td className="unit-cell col-unit">
                      {unitKg > 0 ? (
                        <>
                          <strong>{fmtNumber(unitKg, 3)} Kg</strong>
                          <span>{slitter && !(item.length > 0) ? "por mm" : "por peça"}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="col-preco-100">
                      <input
                        inputMode="decimal"
                        placeholder="auto"
                        value={item.priceFactor100 != null ? String(item.priceFactor100).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { priceFactor100: v ?? undefined });
                        }}
                        title="Preenchido pela tabela; pode editar manualmente"
                      />
                    </td>
                    <td className="col-fator">
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
                    <td className="unit-cell col-preco-util">
                      <strong>{usedPrice != null ? fmtCurrency(usedPrice) : "—"}</strong>
                    </td>
                    <td className="col-servico">
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
                    <td className="col-desc-servico">
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
