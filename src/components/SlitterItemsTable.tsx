import { useState } from "react";
import {
  blankUnitKg,
  resyncBlankDemand,
  syncBlankFromQty,
  syncBlankFromWeight,
  syncSlitterFromLength,
  syncSlitterFromQty,
  syncSlitterFromWeight,
} from "../lib/blankSync";
import {
  fmtCurrency,
  fmtDecimal2,
  fmtNumber,
  fmtThickness,
  parseDecimalBr,
  parseDecimalBr2,
  round2,
} from "../lib/format";
import {
  lineLabelFromSpecs,
  lookupPriceFator100,
  priceTableOptions,
} from "../lib/priceTable";
import {
  COMMISSION_OPTIONS,
  ITEM_KIND_OPTIONS,
  isSlitterItem,
  itemKindOf,
  type BlankInput,
  type CoilInput,
  type CommissionOption,
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

  if (tipo && acabamento && next.thickness && next.thickness > 0 && next.pvc) {
    const lookup = lookupPriceFator100({
      tipo,
      acabamento,
      espessura: next.thickness,
      pvc: next.pvc,
    });
    next.priceFactor100 = lookup.matched ? round2(lookup.precoFator100) : undefined;
    next.icms = lookup.matched
      ? round2(lookup.icms > 0 && lookup.icms <= 1 ? lookup.icms * 100 : lookup.icms)
      : undefined;
  } else {
    next.priceFactor100 = undefined;
    next.icms = undefined;
  }
  return next;
}

function emptyItem(id: string): BlankInput {
  return {
    id,
    name: "",
    width: 0,
    length: 0,
    minKg: 0,
    minQty: 0,
  };
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
  const [priceFactorDrafts, setPriceFactorDrafts] = useState<Record<string, string>>({});

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
    if (
      patch.tipo !== undefined ||
      patch.acabamento !== undefined ||
      patch.thickness !== undefined ||
      patch.pvc !== undefined
    ) {
      setPriceFactorDrafts((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        let next = withPriceFromTable(item, patch);
        const localCoil = coilForItem(next);
        const activeMode = mode ?? demandModes[id] ?? "weight";

        if (isSlitterItem(next)) {
          if (patch.length !== undefined) {
            next = syncSlitterFromLength(next, localCoil);
          } else if (
            patch.width !== undefined ||
            patch.thickness !== undefined ||
            patch.coilWidth !== undefined
          ) {
            if (next.minKg > 0) next = syncSlitterFromWeight(next, localCoil);
          }
          return next;
        }

        if (
          patch.width !== undefined ||
          patch.length !== undefined ||
          patch.itemKind !== undefined ||
          patch.thickness !== undefined
        ) {
          return resyncBlankDemand(next, localCoil, activeMode);
        }
        return next;
      }),
    );
  };

  const applyKind = (item: BlankInput, kind: ItemKind | undefined): BlankInput => {
    const next: BlankInput = { ...item, itemKind: kind };
    const localCoil = coilForItem(next);
    const mode = demandModes[item.id] ?? "weight";
    if (kind === "slitter") {
      if (next.minKg > 0) return syncSlitterFromWeight(next, localCoil);
      return next;
    }
    if (kind === "blank") {
      return resyncBlankDemand(next, localCoil, mode);
    }
    return next;
  };

  const updateItemKind = (id: string, kind: ItemKind | undefined) => {
    // Só o 1º item define o material; aplica a todos (sem misturar BLANK/SLITTER).
    if (items[0]?.id !== id) return;
    setItems((prev) => prev.map((item) => applyKind(item, kind)));
  };

  const updateQty = (id: string, raw: string) => {
    const qty = raw === "" ? 0 : Number(raw);
    const current = items.find((i) => i.id === id);
    if (current && !isSlitterItem(current)) setMode(id, "qty");
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const minQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
        if (isSlitterItem(item)) {
          return syncSlitterFromQty({ ...item, minQty }, coilForItem(item));
        }
        const unitKg = blankUnitKg(item, coilForItem(item));
        return { ...item, ...syncBlankFromQty(minQty, unitKg) };
      }),
    );
  };

  const updateWeight = (id: string, raw: string) => {
    const kg = raw === "" ? 0 : Number(raw);
    const current = items.find((i) => i.id === id);
    if (current && !isSlitterItem(current)) setMode(id, "weight");
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const minKg = Number.isFinite(kg) ? Math.max(0, kg) : 0;
        if (isSlitterItem(item)) {
          return syncSlitterFromWeight({ ...item, minKg }, coilForItem(item));
        }
        const unitKg = blankUnitKg(item, coilForItem(item));
        return { ...item, ...syncBlankFromWeight(minKg, unitKg) };
      }),
    );
  };

  const addItem = () => {
    const id = `item-${Date.now()}`;
    const lockedKind = itemKindOf(items[0]);
    onDemandModesChange({ ...demandModes, [id]: "weight" });
    setItems((prev) => [...prev, { ...emptyItem(id), itemKind: lockedKind }]);
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

        <div className="table-scroll">
          <table className="items-table">
            <thead>
              <tr>
                <th className="delete-column" aria-label="Ações" />
                <th className="item-number-column">Item</th>
                <th>{"LARGURA\nORIGINAL\nBOBINA"}</th>
                <th>Material</th>
                <th>Tipo</th>
                <th>Acabamento</th>
                <th>PVC</th>
                <th>Espessura</th>
                <th>Largura</th>
                <th>Comprimento</th>
                <th>Quantidade</th>
                <th>{"Peso\nunitário"}</th>
                <th>{"Peso\ntotal"}</th>
                <th>{"Preço\nsem IPI"}</th>
                <th>ICMS</th>
                <th>Subtotal</th>
                <th>Observação</th>
                <th>{"Preço\nfator 100"}</th>
                <th>{"Fator\nmáximo"}</th>
                <th>{"Fator\nutilizado"}</th>
                <th>{"Preço\nfator utilizado"}</th>
                <th>Comissão</th>
                <th>{"Preço\nserviço"}</th>
                <th>{"Descrição\nserviço"}</th>
                <th>{"Preço\ntotal"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const localCoil = coilForItem(item);
                const unitKg = blankUnitKg(item, localCoil);
                const mode = demandModes[item.id] ?? "weight";
                const lockedKind = itemKindOf(items[0]);
                const kind = index === 0 ? itemKindOf(item) : (lockedKind ?? itemKindOf(item));
                const slitter = kind === "slitter";
                const materialLocked = index > 0;
                const usedPrice = calcUsedFactorPrice(item.priceFactor100, item.usedFactor);
                const rowOpts = priceTableOptions({
                  tipo: item.tipo,
                  acabamento: item.acabamento,
                });
                const tipoOpts = globalOpts.tipo;
                const acabOpts = item.tipo ? rowOpts.acabamento : globalOpts.acabamento;
                const espOpts = item.tipo && item.acabamento ? rowOpts.espessura : globalOpts.espessura;
                const pvcOpts = globalOpts.pvc;
                const lengthEditable = !slitter || item.minKg > 0;

                return (
                  <tr key={item.id}>
                    <td className="delete-column">
                      <button
                        className="trash-button"
                        type="button"
                        aria-label={`Remover ${dimLabel(item)}`}
                        onClick={() => removeItem(item.id)}
                        disabled={items.length <= 1}
                      >
                        ×
                      </button>
                    </td>
                    <td className="item-number-cell">{index + 1}</td>
                    <td>
                      <input
                        className="cell-control"
                        type="number"
                        min={1}
                        step={1}
                        value={item.coilWidth || ""}
                        onChange={(e) =>
                          updateItem(item.id, { coilWidth: Number(e.target.value) || undefined })
                        }
                        aria-label="Largura original bobina"
                      />
                    </td>
                    <td>
                      <select
                        className="cell-control item-kind-select"
                        value={kind ?? ""}
                        disabled={materialLocked}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateItemKind(item.id, v ? (v as ItemKind) : undefined);
                        }}
                        aria-label="Material do item"
                        title={
                          materialLocked
                            ? "Definido pelo item 1 — não é possível misturar materiais"
                            : undefined
                        }
                      >
                        <option value="">—</option>
                        {ITEM_KIND_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="cell-control"
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
                    <td>
                      <select
                        className="cell-control"
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
                    <td>
                      <select
                        className="cell-control"
                        value={item.pvc ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            pvc: (e.target.value || undefined) as PvcOption | undefined,
                          })
                        }
                        aria-label="PVC"
                      >
                        <option value="">—</option>
                        {pvcOpts.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="cell-control"
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
                    <td>
                      <input
                        className="cell-control"
                        type="number"
                        min={1}
                        step={1}
                        value={item.width || ""}
                        onChange={(e) => updateItem(item.id, { width: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        type="number"
                        min={1}
                        step={1}
                        value={item.length || ""}
                        disabled={slitter && !lengthEditable}
                        title={
                          slitter
                            ? lengthEditable
                              ? "Altera o peso total mantendo a quantidade"
                              : "Informe o peso total para calcular/editar o comprimento"
                            : undefined
                        }
                        onChange={(e) =>
                          updateItem(item.id, { length: Number(e.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={`cell-control ${!slitter && mode === "qty" ? "linked-active" : ""}`}
                        type="number"
                        min={0}
                        step={1}
                        value={item.minQty || ""}
                        title={slitter ? "Somente manual no SLITTER" : undefined}
                        onChange={(e) => updateQty(item.id, e.target.value)}
                        aria-label="Quantidade"
                      />
                    </td>
                    <td className="formula-cell">
                      <span className="calculated-cell">
                        {unitKg > 0
                          ? `${fmtNumber(unitKg, 3)} Kg${slitter && !(item.length > 0) ? " /mm" : ""}`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <input
                        className={`cell-control ${!slitter && mode === "weight" ? "linked-active" : ""}`}
                        type="number"
                        min={0}
                        step={0.1}
                        value={item.minKg || ""}
                        title={
                          slitter
                            ? "Calcula o comprimento automaticamente (quantidade só muda se você editar)"
                            : undefined
                        }
                        onChange={(e) => updateWeight(item.id, e.target.value)}
                        aria-label="Peso total"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={
                          item.priceWithoutIpi != null
                            ? String(item.priceWithoutIpi).replace(".", ",")
                            : ""
                        }
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { priceWithoutIpi: v ?? undefined });
                        }}
                        aria-label="Preço sem IPI"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={item.icms != null ? String(item.icms).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { icms: v ?? undefined });
                        }}
                        aria-label="ICMS"
                        title="Percentual (ex.: 4 = 4%). Preenchido pela tabela quando possível."
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={item.subtotal != null ? String(item.subtotal).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { subtotal: v ?? undefined });
                        }}
                        aria-label="Subtotal"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        type="text"
                        value={item.observation ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { observation: e.target.value || undefined })
                        }
                        aria-label="Observação"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={
                          priceFactorDrafts[item.id] ??
                          (item.priceFactor100 != null ? fmtDecimal2(item.priceFactor100) : "")
                        }
                        onChange={(e) => {
                          const raw = e.target.value.replace(".", ",");
                          if (!/^\d*(,\d{0,2})?$/.test(raw) && raw !== "") return;
                          setPriceFactorDrafts((prev) => ({ ...prev, [item.id]: raw }));
                          updateItem(item.id, {
                            priceFactor100: raw === "" ? undefined : (parseDecimalBr2(raw) ?? undefined),
                          });
                        }}
                        onBlur={() => {
                          setPriceFactorDrafts((prev) => {
                            if (!(item.id in prev)) return prev;
                            const next = { ...prev };
                            delete next[item.id];
                            return next;
                          });
                        }}
                        title="Preenchido pela tabela; pode editar manualmente (2 casas)"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={item.maxFactor != null ? String(item.maxFactor).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { maxFactor: v ?? undefined });
                        }}
                        aria-label="Fator máximo"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={item.usedFactor != null ? String(item.usedFactor).replace(".", ",") : ""}
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { usedFactor: v ?? undefined });
                        }}
                        aria-label="Fator utilizado"
                      />
                    </td>
                    <td className="formula-cell">
                      <span className="calculated-cell">
                        {usedPrice != null ? fmtCurrency(usedPrice) : "—"}
                      </span>
                    </td>
                    <td>
                      <select
                        className="cell-control"
                        value={item.commission ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, {
                            commission: (e.target.value || undefined) as CommissionOption | undefined,
                          })
                        }
                        aria-label="Comissão"
                      >
                        <option value="">—</option>
                        {COMMISSION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={
                          item.servicePrice != null ? String(item.servicePrice).replace(".", ",") : ""
                        }
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { servicePrice: v ?? undefined });
                        }}
                        aria-label="Preço serviço"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        type="text"
                        value={item.serviceDescription ?? ""}
                        onChange={(e) =>
                          updateItem(item.id, { serviceDescription: e.target.value || undefined })
                        }
                        aria-label="Descrição serviço"
                      />
                    </td>
                    <td>
                      <input
                        className="cell-control"
                        inputMode="decimal"
                        value={
                          item.totalPrice != null ? String(item.totalPrice).replace(".", ",") : ""
                        }
                        onChange={(e) => {
                          const v = parseDecimalBr(e.target.value);
                          updateItem(item.id, { totalPrice: v ?? undefined });
                        }}
                        aria-label="Preço total"
                      />
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
