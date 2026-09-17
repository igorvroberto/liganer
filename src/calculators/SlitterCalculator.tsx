import { useCallback, useEffect, useMemo, useState } from "react";
import QuoteClientFields from "../components/QuoteClientFields";
import QuoteConditions from "../components/QuoteConditions";
import QuoteTotals from "../components/QuoteTotals";
import SavedBudgetsList from "../components/SavedBudgetsList";
import SlitterItemsTable from "../components/SlitterItemsTable";
import { fmtDim, fmtInt, fmtKg, fmtMeters, fmtMm, fmtNumber, fmtPct, fmtPlainInt, fmtPlainMm } from "../lib/format";
import { blankSpecCitation, blankSpecCitationLine } from "../lib/materialGroups";
import {
  groupIdenticalStrips,
  lossBreakdown,
  optimizeCutting,
  productIndicesInProgram,
} from "../lib/optimize";
import type { BudgetListItem, BudgetRecord } from "../lib/budgetTypes";
import { newBudgetId } from "../lib/budgetTypes";
import { EMPTY_QUOTE_CLIENT, type QuoteClientInfo } from "../lib/quoteClient";
import { exportQuotePdf, type PdfKind } from "../lib/quotePdfExport";
import { downloadItemsExcel } from "../lib/quoteExport";
import { loadPriceTable } from "../lib/priceTable";
import {
  EMPTY_QUOTE_CONDITIONS,
  itemLossFromPlan,
  quoteSummary,
  type QuoteConditions as QuoteConditionsState,
  type QuoteSummary,
} from "../lib/quoteSummary";
import {
  deleteBudgetRemote,
  fetchBudgetRemote,
  findSavedBudget,
  hasRemoteSync,
  listBudgetsRemote,
  loadAppConfig,
  loadDraft,
  loadSavedBudgets,
  localPrintNumber,
  mergeBudgetLists,
  removeSavedBudget,
  saveBudgetRemote,
  saveDraft,
  savedBudgetsAsListItems,
  upsertSavedBudget,
  type AppConfig,
} from "../lib/storage";
import { coilForProgram, coilFromSlitterItems } from "../lib/slitterCoil";
import {
  BLANK_COLORS,
  isSlitterItem,
  type BlankInput,
  type ProgramResult,
  type RankedPlan,
} from "../lib/types";
import {
  fetchVendasUser,
  vendasLoginUrl,
  type VendasUser,
} from "../lib/vendasAuth";

type Props = {
  vendasUser: VendasUser | null;
  onVendasUser: (user: VendasUser | null) => void;
};

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

function ProgramProductsTable({
  program,
  products,
  allowOvershoot,
}: {
  program: ProgramResult;
  products: RankedPlan["products"];
  allowOvershoot: boolean;
}) {
  const rows = productIndicesInProgram(program)
    .map((index) => {
      const product = products[index];
      if (!product) return null;
      const pieces = program.piecesPerProduct[index] ?? 0;
      const weightKg = program.weightPerProductKg[index] ?? 0;
      return { product, index, pieces, weightKg };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  return (
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
          {rows.map(({ product, index, pieces, weightKg }) => (
            <tr key={product.blank.id}>
              <td>
                <strong style={{ color: BLANK_COLORS[index % BLANK_COLORS.length] }}>
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
                  ? fmtMeters(pieces)
                  : `${fmtInt(pieces)} un`}
                {!isSlitterItem(product.blank) &&
                allowOvershoot &&
                pieces > product.blank.minQty
                  ? ` (+${pieces - product.blank.minQty})`
                  : ""}
              </td>
              <td>
                {fmtKg(weightKg)}
                {allowOvershoot && weightKg > product.blank.minKg
                  ? ` (+${fmtNumber(weightKg - product.blank.minKg, 1)} Kg)`
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

/** Calculadora do modelo Slitters — Itens unificados (como chapas/bobinas). */
export default function SlitterCalculator({ vendasUser, onVendasUser }: Props) {
  const draft = useMemo(() => loadDraft(), []);
  const [items, setItems] = useState<BlankInput[]>(() =>
    draft?.items?.length ? draft.items : EMPTY_ITEMS,
  );
  const [allowOvershoot, setAllowOvershoot] = useState(() => draft?.allowOvershoot ?? true);
  const [demandModes, setDemandModes] = useState<Record<string, "qty" | "weight">>(() => {
    if (draft?.demandModes && Object.keys(draft.demandModes).length > 0) {
      return draft.demandModes;
    }
    if (draft?.items?.length) {
      return Object.fromEntries(draft.items.map((item) => [item.id, "weight" as const]));
    }
    return EMPTY_MODES;
  });
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [priceTableRevision, setPriceTableRevision] = useState(0);
  const [conditions, setConditions] = useState<QuoteConditionsState>(() => ({
    ...EMPTY_QUOTE_CONDITIONS,
    ...(draft?.conditions ?? {}),
  }));
  const [client, setClient] = useState<QuoteClientInfo>(() => ({
    ...EMPTY_QUOTE_CLIENT,
    ...(draft?.client ?? {}),
  }));
  const [status, setStatus] = useState<{ text: string; kind: "" | "ok" | "error" }>({
    text: "",
    kind: "",
  });
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null);
  const [budgetList, setBudgetList] = useState<BudgetListItem[]>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig>({});

  useEffect(() => {
    saveDraft({ client, items, conditions, demandModes, allowOvershoot });
  }, [client, items, conditions, demandModes, allowOvershoot]);

  useEffect(() => {
    let cancelled = false;
    void loadPriceTable().then(() => {
      if (!cancelled) setPriceTableRevision((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBudgetList = useCallback(async (config?: AppConfig) => {
    const cfg = config ?? (await loadAppConfig());
    const local = savedBudgetsAsListItems(loadSavedBudgets());
    if (!hasRemoteSync(cfg)) {
      setBudgetList(local);
      return { config: cfg, remote: false as const };
    }
    try {
      const remote = await listBudgetsRemote(cfg);
      setBudgetList(mergeBudgetLists(local, remote));
      return { config: cfg, remote: true as const };
    } catch (err) {
      setBudgetList(local);
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBudgetsLoading(true);
    void (async () => {
      try {
        const cfg = await loadAppConfig();
        if (cancelled) return;
        setAppConfig(cfg);
        await refreshBudgetList(cfg);
      } catch {
        if (!cancelled) setBudgetList(savedBudgetsAsListItems());
      } finally {
        if (!cancelled) setBudgetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshBudgetList]);

  const coil = useMemo(
    () => coilFromSlitterItems(items, allowOvershoot),
    [items, allowOvershoot],
  );

  const result = useMemo(() => optimizeCutting({ coil, blanks: items }), [coil, items]);
  const plan: RankedPlan | null = result.ok
    ? result.alternatives[selectedAlt] ?? result.alternatives[0] ?? null
    : null;

  const itemLossById = useMemo(
    () => itemLossFromPlan(plan, coil),
    [plan, coil],
  );

  const summary = useMemo(
    () => quoteSummary(items, itemLossById, conditions.frete),
    [items, itemLossById, conditions.frete],
  );

  const updateCondition = (key: keyof QuoteConditionsState, value: string) => {
    setConditions((prev) => ({ ...prev, [key]: value }));
  };

  const applyBudgetToForm = (budget: BudgetRecord) => {
    setClient({ ...EMPTY_QUOTE_CLIENT, ...budget.client });
    setItems(budget.items.length ? budget.items : EMPTY_ITEMS);
    setConditions({ ...EMPTY_QUOTE_CONDITIONS, ...budget.conditions });
    setDemandModes(
      Object.keys(budget.demandModes).length
        ? budget.demandModes
        : Object.fromEntries((budget.items.length ? budget.items : EMPTY_ITEMS).map((item) => [item.id, "weight" as const])),
    );
    setAllowOvershoot(budget.allowOvershoot !== false);
    setSelectedAlt(0);
  };

  const buildBudgetPayload = (
    number: string,
    summaryValue: QuoteSummary,
    owner: VendasUser | null,
  ): BudgetRecord => {
    const now = new Date().toISOString();
    return {
      id: editingBudget?.id || newBudgetId(),
      number,
      name: number,
      client,
      items,
      conditions,
      demandModes,
      allowOvershoot,
      summary: summaryValue,
      createdAt: editingBudget?.createdAt || now,
      savedAt: now,
      source: hasRemoteSync(appConfig) ? "remote" : "local",
      owner,
    };
  };

  const handleSave = async () => {
    if (!items.length) {
      setStatus({ text: "Informe ao menos um item antes de salvar.", kind: "error" });
      return;
    }
    setSaveBusy(true);
    try {
      const cfg = await loadAppConfig();
      setAppConfig(cfg);
      const remote = hasRemoteSync(cfg);

      let user = vendasUser;
      if (!user) {
        user = await fetchVendasUser();
        onVendasUser(user);
      }
      if (remote && !user) {
        setStatus({
          text: "Faça login em vendas.liganer.com.br para salvar na lista da equipe.",
          kind: "error",
        });
        window.location.assign(vendasLoginUrl(`${import.meta.env.BASE_URL}`));
        return;
      }

      let number = editingBudget?.number?.trim() || "";
      if (!number && !remote) number = localPrintNumber();

      const owner =
        editingBudget?.owner?.email ? editingBudget.owner : user;

      let record = buildBudgetPayload(number || "00000000", summary, owner);
      if (!remote) {
        record = upsertSavedBudget({ ...record, number, name: number, source: "local" });
      } else {
        const toRemote: BudgetRecord = { ...record, number: number || "" };
        const remoteRes = await saveBudgetRemote(toRemote, cfg);
        number = remoteRes.number;
        record = upsertSavedBudget({
          ...record,
          number,
          name: number,
          source: "remote",
        });
      }

      await refreshBudgetList(cfg);
      const wasEditing = Boolean(editingBudget);
      setEditingBudget(null);
      setStatus({
        text: remote
          ? wasEditing
            ? `Orçamento ${record.number} atualizado no servidor.`
            : `Orçamento ${record.number} salvo.`
          : `Orçamento ${record.number} salvo só neste navegador (sem syncSecret).`,
        kind: "ok",
      });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Não foi possível salvar o orçamento.",
        kind: "error",
      });
    } finally {
      setSaveBusy(false);
    }
  };

  const cancelEditingBudget = () => {
    setEditingBudget(null);
    setStatus({ text: "Edição cancelada.", kind: "ok" });
  };

  const loadBudgetByNumber = async (number: string): Promise<BudgetRecord | null> => {
    const cfg = appConfig.saveUrl ? appConfig : await loadAppConfig();
    if (hasRemoteSync(cfg)) {
      try {
        const remote = await fetchBudgetRemote(number, cfg);
        upsertSavedBudget(remote);
        return remote;
      } catch {
        // fallback local
      }
    }
    return findSavedBudget(number);
  };

  const handleSavedPdf = async (number: string, kind: PdfKind) => {
    try {
      const budget = await loadBudgetByNumber(number);
      if (!budget) {
        setStatus({ text: `Orçamento ${number} não encontrado.`, kind: "error" });
        return;
      }

      if (kind === "cliente") {
        const budgetSummary =
          budget.summary ?? quoteSummary(budget.items, {}, budget.conditions.frete);
        exportQuotePdf({
          kind: "cliente",
          items: budget.items,
          conditions: budget.conditions,
          summary: budgetSummary,
          client: budget.client,
          number: budget.number,
        });
        setStatus({ text: `PDF cliente do orçamento ${budget.number} gerado.`, kind: "ok" });
        return;
      }

      const budgetCoil = coilFromSlitterItems(budget.items, budget.allowOvershoot !== false);
      const cut = optimizeCutting({ coil: budgetCoil, blanks: budget.items });
      const budgetPlan = cut.ok ? cut.alternatives[0] ?? null : null;
      if (!budgetPlan) {
        setStatus({
          text:
            kind === "gestao"
              ? `Não há plano de corte válido para o PDF gestão do orçamento ${budget.number}.`
              : `Não há plano de corte válido para o PDF Liganer do orçamento ${budget.number}.`,
          kind: "error",
        });
        return;
      }
      const lossById = itemLossFromPlan(budgetPlan, budgetCoil);
      const budgetSummary = quoteSummary(budget.items, lossById, budget.conditions.frete);
      exportQuotePdf({
        kind,
        items: budget.items,
        conditions: budget.conditions,
        summary: budgetSummary,
        lossByItemId: lossById,
        plan: budgetPlan,
        coil: budgetCoil,
        client: budget.client,
        number: budget.number,
      });
      setStatus({
        text:
          kind === "gestao"
            ? `PDF gestão do orçamento ${budget.number} gerado.`
            : `PDF Liganer do orçamento ${budget.number} gerado.`,
        kind: "ok",
      });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Falha ao abrir PDF do orçamento.",
        kind: "error",
      });
    }
  };

  const handleSavedXlsx = async (number: string) => {
    try {
      const budget = await loadBudgetByNumber(number);
      if (!budget) {
        setStatus({ text: `Orçamento ${number} não encontrado.`, kind: "error" });
        return;
      }
      downloadItemsExcel(budget.items, budget.conditions, { number: budget.number });
      setStatus({ text: `XLSX do orçamento ${budget.number} exportado.`, kind: "ok" });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Falha ao exportar XLSX do orçamento.",
        kind: "error",
      });
    }
  };

  const handleSavedEdit = async (item: BudgetListItem) => {
    try {
      const number = item.number || item.name || item.id;
      const budget = await loadBudgetByNumber(number);
      if (!budget) {
        setStatus({ text: `Orçamento ${number} não encontrado.`, kind: "error" });
        return;
      }
      if (!budget.items.length) {
        setStatus({ text: "Orçamento sem itens para editar.", kind: "error" });
        return;
      }
      applyBudgetToForm(budget);
      setEditingBudget({
        ...budget,
        owner: budget.owner || item.owner || null,
      });
      setStatus({
        text: `Editando orçamento ${budget.number}. Use Atualizar para gravar as alterações`,
        kind: "ok",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Falha ao carregar orçamento.",
        kind: "error",
      });
    }
  };

  const handleSavedDelete = async (item: BudgetListItem) => {
    const number = item.number || item.name || item.id;
    if (!window.confirm(`Excluir o orçamento ${number}?`)) return;
    try {
      const cfg = appConfig.saveUrl ? appConfig : await loadAppConfig();
      removeSavedBudget(item.id);
      if (item.number) removeSavedBudget(item.number);
      if (item.name && item.name !== item.id) removeSavedBudget(item.name);

      if (item.number && hasRemoteSync(cfg)) {
        try {
          await deleteBudgetRemote(item.number, cfg);
        } catch (err) {
          setStatus({
            text: `Removido neste navegador, mas falhou no servidor: ${
              err instanceof Error ? err.message : ""
            }`.trim(),
            kind: "error",
          });
          await refreshBudgetList(cfg);
          return;
        }
      }

      if (
        editingBudget &&
        (editingBudget.id === item.id || editingBudget.number === item.number)
      ) {
        setEditingBudget(null);
      }
      await refreshBudgetList(cfg);
      setStatus({ text: `Orçamento ${number} excluído.`, kind: "ok" });
    } catch (err) {
      setStatus({
        text: err instanceof Error ? err.message : "Falha ao excluir orçamento.",
        kind: "error",
      });
    }
  };

  return (
    <div className="calculator-model" data-model="slitters">
      <QuoteClientFields client={client} onChange={setClient} />

      <SlitterItemsTable
        items={items}
        coil={coil}
        demandModes={demandModes}
        allowOvershoot={allowOvershoot}
        priceTableRevision={priceTableRevision}
        itemLossById={itemLossById}
        fretePercent={conditions.frete}
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
        onSave={() => void handleSave()}
        onCancelEdit={cancelEditingBudget}
        editingNumber={editingBudget?.number ?? null}
        statusText={status.text}
        statusKind={status.kind}
        saveBusy={saveBusy}
      />

      <SavedBudgetsList
        items={budgetList}
        loading={budgetsLoading}
        editingNumber={editingBudget?.number ?? null}
        onPdfCliente={(n) => void handleSavedPdf(n, "cliente")}
        onPdfLiganer={(n) => void handleSavedPdf(n, "liganer")}
        onPdfGestao={(n) => void handleSavedPdf(n, "gestao")}
        onXlsx={(n) => void handleSavedXlsx(n)}
        onEdit={(item) => void handleSavedEdit(item)}
        onDelete={(item) => void handleSavedDelete(item)}
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

              {plan.programs.map((program, idx) => {
                const programCoil = coilForProgram(program, plan.products, coil);
                const usefulKg = program.weightPerProductKg.reduce((s, w) => s + w, 0);
                const breakdown = lossBreakdown([program], usefulKg, programCoil);
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
                    <LanePreview
                      program={program}
                      coilWidth={programCoil.width}
                      edgeTrim={programCoil.edgeTrim}
                    />
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

                    <div className="section-head" style={{ marginTop: 16 }}>
                      <h3>Melhor aproveitamento</h3>
                    </div>
                    <p className="note loss-info-note">
                      Sobra longitudinal: <strong>{fmtPct(breakdown.longitudinalPct)}</strong>{" "}
                      ({fmtPlainInt(breakdown.widthWasteMm)}mm)
                      {" "}· Sobra transversal: <strong>{fmtPct(breakdown.transversalPct)}</strong>{" "}
                      ({fmtKg(breakdown.transversalKg)})
                      {" "}· Refile: <strong>{fmtPlainMm(programCoil.edgeTrim * 2)}</strong>:{" "}
                      <strong>{fmtPct(breakdown.refilePct)}</strong> ({fmtKg(breakdown.refileKg)})
                      {" "}— refile e transversal não entram no %; o refile só reduz a largura útil dos planos de corte.
                    </p>
                    <div className="kpis">
                      <div className="kpi good">
                        <span>Aproveitamento</span>
                        <b>{fmtPct(breakdown.yieldPercent)}</b>
                      </div>
                      <div className="kpi">
                        <span>Peso necessário</span>
                        <b>{fmtKg(breakdown.physicalCoilKg)}</b>
                      </div>
                    </div>

                    <ProgramProductsTable
                      program={program}
                      products={plan.products}
                      allowOvershoot={coil.allowOvershoot ?? true}
                    />
                  </div>
                );
              })}
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
                {fmtPct(alt.yieldPercent)} aproveit. · {fmtKg(alt.coilWeightKg)} necessário ·{" "}
                {alt.setupCount} programa{alt.setupCount > 1 ? "s" : ""}
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
