export type Lead = {
  id: string
  empresa: string
  cnpj: string
  cidade: string
  /** UF (ex.: SP, MS) — campo CSV `estado` */
  estado: string
  distancia_km_aracatuba: string
  categoria: string
  subcategoria: string
  /** Linha de produto: Ferro para construção; Carbono; Inox (multi via "; ") */
  linha: string
  produto_provavel: string
  produto_secundario: string
  justificativa_produto: string
  potencial: string
  multioportunidade: string
  consumo_estimado: string
  compra_recorrente: string
  tipo_operacao: string
  o_que_fabrica_constroi: string
  obras_atuais: string
  fornecedor_atual: string
  comprador: string
  cargo_comprador: string
  telefone: string
  whatsapp: string
  email: string
  site: string
  endereco: string
  fonte: string
  data_pesquisa: string
  ultimo_contato: string
  status: string
  proximo_contato: string
  ultima_compra: string
  responsavel: string
  crm: string
  vendedor: string
  situacao: string
  proxima_acao: string
  necessidade_identificada: string
  motivo_prospect: string
  abordagem: string
  observacoes_comerciais: string
  indicacao: string
}

export type Filters = {
  q: string
  categoria: string
  linha: string
  potencial: string
  cidade: string
  situacao: string
  status: string
  /** Distância máxima a partir de Araçatuba (km) */
  raioKm: number
}

export const RAIO_MAX_KM = 200

/** Linha de produto (material) — pode ser multi no CSV */
export const LINHA_OPTIONS = ['Ferro para construção', 'Carbono', 'Inox'] as const

export type Linha = (typeof LINHA_OPTIONS)[number]

/** Ordem canônica das categorias comerciais (operação — sem material) */
export const CATEGORIA_OPTIONS = [
  'Construtora',
  'Corte e dobra',
  'Indústria',
  'Metalúrgica',
  'Revenda',
  'Pré-moldados',
  'Artefatos de concreto',
  'Fundações',
  'Infraestrutura',
  'Silos e estruturas agro',
  'Tanques e vasos',
] as const

export type Categoria = (typeof CATEGORIA_OPTIONS)[number]

/** Abreviação compacta para a barra de stats */
export const CATEGORIA_ABREV: Record<string, string> = {
  Construtora: 'C',
  'Corte e dobra': 'CD',
  Indústria: 'I',
  Metalúrgica: 'M',
  Revenda: 'R',
  'Pré-moldados': 'PM',
  'Artefatos de concreto': 'AC',
  Fundações: 'F',
  Infraestrutura: 'IF',
  'Silos e estruturas agro': 'SA',
  'Tanques e vasos': 'TV',
}

export const POTENCIAL_OPTIONS = ['Alto', 'Médio', 'Baixo'] as const

export const SITUACAO_OPTIONS = ['Qualificado', 'Desqualificado'] as const

export const CRM_OPTIONS = ['Ativo', 'Inativo', 'Sem cadastro', 'Sem compra'] as const

export const STATUS_OPTIONS = [
  'Sem retorno',
  'Em contato',
  'Orçamento enviado',
  'Cliente',
] as const

export const EMPTY_FILTERS: Filters = {
  q: '',
  categoria: '',
  linha: '',
  potencial: '',
  cidade: '',
  situacao: '',
  status: '',
  raioKm: RAIO_MAX_KM,
}

/** Campos editáveis no painel (follow-up também na tabela) */
export const EDITABLE_FIELDS: {
  key: keyof Lead
  label: string
  kind: 'text' | 'textarea' | 'select' | 'date'
  options?: readonly string[]
}[] = [
  { key: 'empresa', label: 'Empresa', kind: 'text' },
  { key: 'cnpj', label: 'CNPJ', kind: 'text' },
  { key: 'cidade', label: 'Cidade', kind: 'text' },
  { key: 'estado', label: 'UF', kind: 'text' },
  { key: 'distancia_km_aracatuba', label: 'Distância (km)', kind: 'text' },
  { key: 'categoria', label: 'Categoria', kind: 'select', options: CATEGORIA_OPTIONS },
  { key: 'potencial', label: 'Potencial', kind: 'select', options: POTENCIAL_OPTIONS },
  { key: 'produto_provavel', label: 'Produto principal', kind: 'textarea' },
  { key: 'produto_secundario', label: 'Produto secundário', kind: 'textarea' },
  { key: 'responsavel', label: 'Responsável', kind: 'text' },
  { key: 'crm', label: 'CRM', kind: 'select', options: CRM_OPTIONS },
  { key: 'vendedor', label: 'Vendedor', kind: 'text' },
  { key: 'ultimo_contato', label: 'Último contato', kind: 'date' },
  { key: 'status', label: 'Status', kind: 'select', options: STATUS_OPTIONS },
  { key: 'proximo_contato', label: 'Próximo contato', kind: 'date' },
  { key: 'ultima_compra', label: 'Última compra', kind: 'date' },
  { key: 'observacoes_comerciais', label: 'Observação', kind: 'textarea' },
  { key: 'proxima_acao', label: 'Próxima ação', kind: 'textarea' },
  { key: 'motivo_prospect', label: 'Motivo', kind: 'textarea' },
  { key: 'abordagem', label: 'Abordagem', kind: 'textarea' },
  { key: 'telefone', label: 'Telefone', kind: 'text' },
  { key: 'whatsapp', label: 'WhatsApp', kind: 'text' },
  { key: 'email', label: 'E-mail', kind: 'text' },
  { key: 'comprador', label: 'Comprador', kind: 'text' },
  { key: 'situacao', label: 'Situação', kind: 'select', options: SITUACAO_OPTIONS },
  { key: 'indicacao', label: 'Indicação', kind: 'text' },
]
