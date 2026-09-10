import { describe, expect, it } from "vitest";
import { EMPTY_QUOTE_CLIENT } from "./quoteClient";
import { EMPTY_QUOTE_CONDITIONS } from "./quoteSummary";
import { loadDraft, saveDraft, localPrintNumber, type DraftState } from "./storage";

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
  conditions: { ...EMPTY_QUOTE_CONDITIONS, pagamento: "30 dias", frete: "CIF incluso" },
  demandModes: { "item-1": "weight" },
  allowOvershoot: false,
};

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
    expect(loaded?.conditions.frete).toBe("CIF incluso");
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
