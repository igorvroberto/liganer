export type BlankInput = {
  id: string;
  name: string;
  width: number;
  length: number;
  minKg: number;
  minQty: number;
};

/** Modelo de cálculo selecionado na calculadora. */
export type CalculatorModel = "slitters" | "blanks";

export const CALCULATOR_MODELS: { value: CalculatorModel; label: string }[] = [
  { value: "slitters", label: "Slitters" },
  { value: "blanks", label: "Blanks" },
];

export type PvcOption = "sem" | "azul" | "preto-branco" | "preto" | "laser";

export const PVC_OPTIONS: { value: PvcOption; label: string }[] = [
  { value: "sem", label: "Sem PVC" },
  { value: "azul", label: "Azul" },
  { value: "preto-branco", label: "Preto e branco" },
  { value: "preto", label: "Preto" },
  { value: "laser", label: "Laser" },
];

export function pvcLabel(pvc: PvcOption | undefined): string {
  return PVC_OPTIONS.find((o) => o.value === pvc)?.label ?? "Sem PVC";
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
