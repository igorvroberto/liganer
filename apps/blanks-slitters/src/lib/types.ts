export type ItemKind = "blank" | "slitter";

export const ITEM_KIND_OPTIONS: { value: ItemKind; label: string }[] = [
  { value: "blank", label: "BLANK" },
  { value: "slitter", label: "SLITTER" },
];

export type PvcOption = "sem" | "azul" | "preto-branco" | "preto" | "nitto";

/** Fallback estático; no modelo Slitters as opções vêm da tabela de preços. */
export const PVC_OPTIONS: { value: PvcOption; label: string }[] = [
  { value: "sem", label: "NÃO" },
  { value: "azul", label: "AZUL" },
  { value: "preto-branco", label: "PRETO E BRANCO" },
  { value: "preto", label: "PRETO" },
  { value: "nitto", label: "NITTO FIBER" },
];

export function pvcLabel(pvc: PvcOption | undefined): string {
  return PVC_OPTIONS.find((o) => o.value === pvc)?.label ?? "NÃO";
}

export type CommissionOption = "bonificada" | "normal" | "reduzida";

export const COMMISSION_OPTIONS: { value: CommissionOption; label: string }[] = [
  { value: "bonificada", label: "Bonificada" },
  { value: "normal", label: "Normal" },
  { value: "reduzida", label: "Reduzida" },
];

export type BlankInput = {
  id: string;
  name: string;
  /** Material do item (BLANK/SLITTER). Definido no item 1 e replicado nos demais. */
  itemKind?: ItemKind;
  width: number;
  length: number;
  minKg: number;
  minQty: number;
  /** Campos comerciais/por linha (modelo Slitters unificado em Itens). */
  line?: string;
  /** Tipo da tabela de preços (ex.: 304, 201). */
  tipo?: string;
  /** Acabamento da tabela de preços (ex.: 2B, ESCOVADO). */
  acabamento?: string;
  thickness?: number;
  /** Largura da bobina-mãe usada no plano de corte. */
  coilWidth?: number;
  pvc?: PvcOption;
  /** Preço sem IPI (R$). Calculado — não editável. */
  priceWithoutIpi?: number;
  /** ICMS em percentual (ex.: 4 = 4%). Da tabela — não editável. */
  icms?: number;
  /** Subtotal (R$). Calculado — não editável. */
  subtotal?: number;
  observation?: string;
  /** Preço fator 100 (R$/Kg). Da tabela — não editável. */
  priceFactor100?: number;
  /** Fator máximo permitido. */
  maxFactor?: number;
  usedFactor?: number;
  /** Comissão comercial do item. */
  commission?: CommissionOption;
  servicePrice?: number;
  serviceDescription?: string;
  /** Preço total do item. Calculado — não editável. */
  totalPrice?: number;
  /** Marcadores MTO (como em chapas-bobinas). */
  filIndMto?: boolean;
  acosPrimeMto?: boolean;
  imgMto?: boolean;
  csaMto?: boolean;
  tettoMto?: boolean;
};

export type MtoFieldKey = "filIndMto" | "acosPrimeMto" | "imgMto" | "csaMto" | "tettoMto";

export const MTO_FIELDS: { key: MtoFieldKey; label: string }[] = [
  { key: "filIndMto", label: "FIL\nIND\nMTO" },
  { key: "acosPrimeMto", label: "AÇOS\nPRIME\nMTO" },
  { key: "imgMto", label: "IMG\nMTO" },
  { key: "csaMto", label: "CSA\nMTO" },
  { key: "tettoMto", label: "TETTO\nMTO" },
];

/** Larguras padrão de bobina (mm), como em chapas-bobinas. */
export const COIL_WIDTH_OPTIONS_MM = [1250, 1500, 1219] as const;
export const COIL_WIDTH_OTHER_LABEL = "OUTRA";

export function itemKindOf(blank: Pick<BlankInput, "itemKind">): ItemKind | undefined {
  if (blank.itemKind === "slitter") return "slitter";
  if (blank.itemKind === "blank") return "blank";
  return undefined;
}

export function isSlitterItem(blank: Pick<BlankInput, "itemKind">): boolean {
  return blank.itemKind === "slitter";
}

export function isBlankItem(blank: Pick<BlankInput, "itemKind">): boolean {
  return blank.itemKind === "blank";
}

export type CoilInput = {
  width: number;
  thickness: number;
  density: number;
  kerf: number;
  edgeTrim: number;
  allowOvershoot?: boolean;
  line?: string;
  /** Opção de PVC aplicada à bobina */
  pvc?: PvcOption;
  /** Preço bobina reduzida na tabela fator 100 (R$/Kg) */
  priceFactor100?: number;
  /** Fator comercial utilizado (ex.: 170 = divide por 1,70) */
  usedFactor?: number;
  /** Preço do serviço de corte (R$) */
  servicePrice?: number;
  /** Descrição do serviço de corte */
  serviceDescription?: string;
};

export type CalcInput = {
  coil: CoilInput;
  blanks: BlankInput[];
};

export type Strip = {
  productIndex: number;
  stripWidth: number;
  cutLength: number;
  rotated: boolean;
};

export type Pattern = {
  strips: Strip[];
  usedWidth: number;
  waste: number;
};

export type ProgramResult = {
  pattern: Pattern;
  coilLengthMm: number;
  piecesPerProduct: number[];
  weightPerProductKg: number[];
  remainderMmPerStrip: number[];
};

export type ProductResult = {
  blank: BlankInput;
  unitWeightKg: number;
  minPieces: number;
  pieces: number;
  weightKg: number;
};

export type CalcResult = {
  ok: true;
  coilWeightKg: number;
  usefulWeightKg: number;
  scrapKg: number;
  yieldPercent: number;
  totalCoilLengthMm: number;
  programs: ProgramResult[];
  products: ProductResult[];
  alternatives: RankedPlan[];
};

export type CalcError = {
  ok: false;
  message: string;
};

export type RankedPlan = {
  label: string;
  yieldPercent: number;
  coilWeightKg: number;
  usefulWeightKg: number;
  scrapKg: number;
  totalCoilLengthMm: number;
  programs: ProgramResult[];
  products: ProductResult[];
  setupCount: number;
  overshootKg: number;
  shortfallKg: number;
};

export const DEFAULT_DENSITY = 8;

/** Refile fixo (mm em cada lado). Não é editável na UI. */
export const FIXED_EDGE_TRIM_MM = 5;

export const COMMON_THICKNESSES = [0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0];

export const BLANK_COLORS = [
  "#1f6f8b",
  "#c45c26",
  "#2d6a4f",
  "#7b2d8b",
  "#b08900",
  "#9b2226",
  "#3d5a80",
  "#6d597a",
];
