import { describe, expect, it, beforeEach } from "vitest";
import { EMPTY_QUOTE_CLIENT } from "./quoteClient";
import { EMPTY_QUOTE_CONDITIONS } from "./quoteSummary";
import type { BudgetRecord } from "./budgetTypes";
import {
  budgetDisplayName,
  findSavedBudget,
  loadDraft,
  loadSavedBudgets,
  localPrintNumber,
  mergeBudgetLists,
  removeSavedBudget,
  saveDraft,
  savedBudgetsAsListItems,
  upsertSavedBudget,
  type DraftState,
} from "./storage";

const sample: DraftState = {
  client: { ...EMPTY_QUOTE_CLIENT, name: "ACME", cnpj: "12.345.678/0001-99" },
  items: [
    {
      id: "item-1",
      name: "",
      width: 100,
      length: 200,
      minKg: 50,
      minQty: 10,
      itemKind: "blank",
    },
  ],
  conditions: { ...EMPTY_QUOTE_CONDITIONS, pagamento: "30 dias", frete: "1" },
  demandModes: { "item-1": "weight" },
  allowOvershoot: false,
};

function sampleBudget(number: string, overrides: Partial<BudgetRecord> = {}): BudgetRecord {
  return {
    id: `id-${number}`,
    number,
    name: number,
    client: { name: "ACME", cnpj: "12.345.678/0001-99" },
    items: sample.items,
    conditions: sample.conditions,
    demandModes: sample.demandModes,
    allowOvershoot: true,
    summary: { totalKg: 50, subtotal: 100, ipi: 3.25, total: 103.25, frete: 0 },
    createdAt: "2026-09-14T12:00:00.000Z",
    savedAt: "2026-09-14T12:00:00.000Z",
    source: "local",
    ...overrides,
  };
}

describe("storage draft", () => {
  it("salva e restaura cliente, itens e condições", () => {
    saveDraft(sample);
    const loaded = loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded?.client.name).toBe("ACME");
    expect(loaded?.client.cnpj).toBe("12.345.678/0001-99");
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0]?.width).toBe(100);
    expect(loaded?.conditions.pagamento).toBe("30 dias");
    expect(loaded?.conditions.frete).toBe("1");
    expect(loaded?.demandModes["item-1"]).toBe("weight");
    expect(loaded?.allowOvershoot).toBe(false);
  });
});

describe("localPrintNumber", () => {
  it("gera AAMMDD + sequência do dia (2 dígitos)", () => {
    const day = new Date(2026, 8, 10); // 10/09/2026
    const first = localPrintNumber(day);
    const second = localPrintNumber(day);
    expect(first).toBe("26091001");
    expect(second).toBe("26091002");
  });
});

describe("saved budgets", () => {
  beforeEach(() => {
    // limpa lista entre testes
    for (const b of loadSavedBudgets()) removeSavedBudget(b.number);
  });

  it("upsert e find por número; name = number", () => {
    const saved = upsertSavedBudget(sampleBudget("26091401"));
    expect(saved.number).toBe("26091401");
    expect(budgetDisplayName(saved)).toBe("26091401");
    expect(findSavedBudget("26091401")?.client.name).toBe("ACME");
    upsertSavedBudget(
      sampleBudget("26091401", {
        client: { name: "Nova", cnpj: "00.000.000/0001-00" },
        savedAt: "2026-09-14T13:00:00.000Z",
      }),
    );
    expect(findSavedBudget("26091401")?.client.name).toBe("Nova");
    expect(loadSavedBudgets()).toHaveLength(1);
  });

  it("grava owner e preserva na atualização sem owner", () => {
    const owner = { id: "u1", email: "ana@liganer.com", name: "Ana" };
    upsertSavedBudget(sampleBudget("26091403", { owner }));
    expect(findSavedBudget("26091403")?.owner).toEqual(owner);
    expect(savedBudgetsAsListItems().find((i) => i.number === "26091403")?.owner).toEqual(owner);
    upsertSavedBudget(
      sampleBudget("26091403", {
        owner: null,
        client: { name: "Editado", cnpj: "" },
      }),
    );
    expect(findSavedBudget("26091403")?.owner).toEqual(owner);
    expect(findSavedBudget("26091403")?.client.name).toBe("Editado");
  });

  it("remove orçamento e monta lista", () => {
    upsertSavedBudget(sampleBudget("26091401"));
    upsertSavedBudget(sampleBudget("26091402", { client: { name: "B", cnpj: "" } }));
    const list = savedBudgetsAsListItems();
    expect(list.map((i) => i.number).sort()).toEqual(["26091401", "26091402"]);
    removeSavedBudget("id-26091401");
    expect(findSavedBudget("26091401")).toBeNull();
    expect(loadSavedBudgets()).toHaveLength(1);
    removeSavedBudget("26091402");
    expect(loadSavedBudgets()).toHaveLength(0);
  });

  it("merge prioriza remoto no mesmo número", () => {
    const merged = mergeBudgetLists(
      [
        {
          id: "1",
          number: "26091401",
          name: "26091401",
          client: "Local",
          cnpj: "",
          createdAt: "a",
          savedAt: "a",
          source: "local",
        },
      ],
      [
        {
          id: "1",
          number: "26091401",
          name: "26091401",
          client: "Remoto",
          cnpj: "1",
          createdAt: "b",
          savedAt: "b",
          source: "remote",
        },
        {
          id: "2",
          number: "26091402",
          name: "26091402",
          client: "Outro",
          cnpj: "",
          createdAt: "c",
          savedAt: "c",
          source: "remote",
        },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.number === "26091401")?.client).toBe("Remoto");
    expect(merged.find((i) => i.number === "26091401")?.source).toBe("remote");
  });
});
