export type FieldType = 'number' | 'currency' | 'percent' | 'boolean' | 'text'

export type FieldDef = {
  key: string
  label: string
  aliases?: string[]
  type?: FieldType
  options?: string[]
  customOptionLabel?: string
  /** Campo de texto com busca no catálogo (typeahead), em vez de select. */
  searchable?: boolean
  default?: string | number | boolean
  locked?: boolean
  hiddenInApp?: boolean
  askWhenNew?: boolean
  section?: 'Rodapé'
  virtual?: boolean
  calculated?: boolean
  /** Casas decimais na exibição (padrão 2). Use 0 para inteiros. */
  fractionDigits?: number
  /** Separador de milhar (padrão true). */
  useGrouping?: boolean
  calc?: keyof RowCalculation
}

export type ModelDef = {
  id: string
  name: string
  status: 'configured' | 'pending'
  fields: FieldDef[]
  sheet?: string
  rowRange?: string
  formulaNote?: string
}

export type ItemRow = Record<string, string | number | boolean | undefined>

export type Conditions = Record<string, string | number | boolean | undefined>

export type ClientInfo = {
  name: string
  cnpj: string
}

export type RowCalculation = {
  pesoUnitario: number
  pesoTotal: number
  precoFator100: number
  precoFatorUtilizado: number
  precoBobinaFator100: number
  precoBobinaFatorUtilizado: number
  precoTotal: number
  precoSemIpi: number
  subtotal: number
  precoSp: number
  precoCe: number
  subtotalSp: number
  subtotalCe: number
  calculoIpiSp: number
  calculoIpiCe: number
  precoComIpiSp: number
  precoComIpiCe: number
  estoqueTotal: number
  fatorReal4: number
  fatorReal18: number
  pesoNecessario: number
  quantidadeCortes: number
  perdaMm: number
  perdaPercentual: number
  acrescimoPerdaPercentual: number
  acrescimoPerdaValor: number
  /** Alíquota ICMS (ex.: 0.04 = 4%). */
  icms: number
  /** Alíquota IPI da linha. */
  ipiRate: number
}

export type Summary = {
  totalKg: number
  subtotal: number
  subtotalSp: number
  subtotalCe: number
  ipi: number
  ipiSp: number
  ipiCe: number
  total: number
  totalSp: number
  totalCe: number
  frete: number
}

export type BudgetRecord = {
  id: string
  createdAt: string
  modelId: string
  modelName: string
  client: ClientInfo
  rows: ItemRow[]
  conditions: Conditions
  summary: Summary
  number?: string
  /** Nome exibido na lista de orçamentos salvos. */
  name?: string
  savedAt?: string
  /** Origem do salvamento, ex.: botão Salvar ou PDF cliente. */
  source?: string
}

export type BudgetListItem = {
  id: string
  name: string
  number?: string | null
  client: ClientInfo
  createdAt?: string | null
  savedAt?: string | null
  source?: string | null
}
