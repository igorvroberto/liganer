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
  fmtNumber,
  fmtThickness,
  parseDecimalBr,
  round2,
} from "../lib/format";
import {
  lineLabelFromSpecs,
  lookupPriceFator100,
  priceTableOptions,
} from "../lib/priceTable";
import {
  COIL_WIDTH_OPTIONS_MM,
  COIL_WIDTH_OTHER_LABEL,
  COMMISSION_OPTIONS,
  ITEM_KIND_OPTIONS,
  MTO_FIELDS,
  isSlitterItem,
  itemKindOf,
  type BlankInput,
  type CoilInput,
  type CommissionOption,
  type ItemKind,
  type MtoFieldKey,
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

/** Valores comerciais bloqueados — mesma lógica base do chapas-bobinas (sem frete ainda). */
function itemCommercialDisplay(item: BlankInput) {
  const usedPrice = calcUsedFactorPrice(item.priceFactor100, item.usedFactor);
  const service = item.servicePrice ?? 0;
  const totalPrice = usedPrice != null ? usedPrice + service : null;
  const priceWithoutIpi = totalPrice;
  const subtotal =
    priceWithoutIpi != null && item.minKg > 0 ? priceWithoutIpi * item.minKg : null;
  return {
    priceFactor100: item.priceFactor100,
    icms: item.icms,
    usedPrice,
    totalPrice,
    priceWithoutIpi,
    subtotal,
  };
}

function dimLabel(item: BlankInput): string {
  if (isSlitterItem(item)) {
    if (item.width > 0 && item.length > 0) return `${item.width}×${item.length} slitter`;
    return item.width > 0 ? `${item.width} mm slitter` : "slitter";
  }
  if (item.width > 0 && item.length > 0) return `${item.width}×${item.length}`;
  return "item";
}

function CoilWidthControl({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  const preset =
    value != null && value > 0 && (COIL_WIDTH_OPTIONS_MM as readonly number[]).includes(value);
  /** 0 = modo OUTRA sem valor digitado ainda (como chapas). */
  const otherEmpty = value === 0;
  const otherCustom = value != null && value > 0 && !preset;
  const showOtherInput = otherEmpty || otherCustom;
  const selectValue = showOtherInput ? COIL_WIDTH_OTHER_LABEL : preset ? String(value) : "";

  return (
    <div className="cell-control-stack">
      <select
        className="cell-control"
        value={selectValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (!raw) {
            onChange(undefined);
            return;
          }
          if (raw === COIL_WIDTH_OTHER_LABEL) {
            onChange(otherCustom ? value : 0);
            return;
          }
          onChange(Number(raw) || undefined);
        }}
        aria-label="Largura original bobina"
      >
        <option value="">—</option>
        {COIL_WIDTH_OPTIONS_MM.map((opt) => (
          <option key={opt} value={String(opt)}>
            {opt}
          </option>
        ))}
        <option value={COIL_WIDTH_OTHER_LABEL}>{COIL_WIDTH_OTHER_LABEL}</option>
      </select>
      {showOtherInput ? (
        <input
          className="cell-control"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={COIL_WIDTH_OTHER_LABEL}
          value={otherCustom ? value : ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(0);
              return;
            }
            const n = Number(raw);
            onChange(Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
          }}
          aria-label="Largura original bobina personalizada"
        />
      ) : null}
    </div>
  );
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
                <th>{"Preço\nsem\nIPI"}</th>
                <th>ICMS</th>
                <th>Subtotal</th>
                <th>Observação</th>
                <th>{"Preço\nfator\n100"}</th>
                <th>{"Fator\nmáximo"}</th>
                <th>{"Fator\nutilizado"}</th>
                <th>{"Preço\nfator\nutilizado"}</th>
                <th>Comissão</th>
                <th>{"Preço\nserviço"}</th>
                <th>{"Descrição\nserviço"}</th>
                <th>{"Preço\ntotal"}</th>
                {MTO_FIELDS.map((field) => (
                  <th key={field.key} className="boolean-column">
                    {field.label}
                  </th>
                ))}
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
                const commercial = itemCommercialDisplay(item);
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
                      <CoilWidthControl
                        value={item.coilWidth}
                        onChange={(coilWidth) => updateItem(item.id, { coilWidth })}
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
                    <td className="formula-cell">
                      <span className="calculated-cell" title="Calculado (bloqueado)">
                        {commercial.priceWithoutIpi != null
                          ? fmtCurrency(commercial.priceWithoutIpi)
                          : "—"}
                      </span>
                    </td>
                    <td className="formula-cell">
                      <span className="calculated-cell" title="Da tabela de preços (bloqueado)">
                        {commercial.icms != null ? `${fmtNumber(commercial.icms, 0)}%` : "—"}
                      </span>
                    </td>
                    <td className="formula-cell">
                      <span className="calculated-cell" title="Peso total × preço sem IPI (bloqueado)">
                        {commercial.subtotal != null ? fmtCurrency(commercial.subtotal) : "—"}
                      </span>
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
                    <td className="formula-cell">
                      <span className="calculated-cell" title="Da tabela de preços (bloqueado)">
                        {commercial.priceFactor100 != null
                          ? fmtCurrency(commercial.priceFactor100)
                          : "—"}
                      </span>
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
                      <span className="calculated-cell" title="Preço fator 100 ÷ (fator utilizado / 100)">
                        {commercial.usedPrice != null ? fmtCurrency(commercial.usedPrice) : "—"}
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
                    <td className="formula-cell">
                      <span className="calculated-cell" title="Preço fator utilizado + preço serviço">
                        {commercial.totalPrice != null ? fmtCurrency(commercial.totalPrice) : "—"}
                      </span>
                    </td>
                    {MTO_FIELDS.map((field) => (
                      <td key={field.key} className="boolean-column">
                        <input
                          className="cell-check"
                          type="checkbox"
                          checked={Boolean(item[field.key])}
                          onChange={(e) =>
                            updateItem(item.id, {
                              [field.key]: e.target.checked,
                            } as Pick<BlankInput, MtoFieldKey>)
                          }
                          aria-label={field.label.replace("\n", " ")}
                        />
                      </td>
                    ))}
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
