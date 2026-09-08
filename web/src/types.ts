export type Lead = {
  id: string
  empresa: string
  cnpj: string
  cidade: string
  estado: string
  distancia_km_aracatuba: string
  categoria: string
  subcategoria: string
  produto_provavel: string
  produto_secundario: string
  justificativa_produto: string
  potencial: string
  multiproduto: string
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
  ultima_compra: string
  situacao: string
  proxima_acao: string
  necessidade_identificada: string
  motivo_prospect: string
  abordagem: string
  observacoes_comerciais: string
}

export type Filters = {
  q: string
  categoria: string
  potencial: string
  cidade: string
  situacao: string
  multiproduto: string
}

export const CATEGORIA_LABEL: Record<string, string> = {
  C: 'Construção',
  CD: 'Corte e Dobra',
  M: 'Metalúrgica',
  I: 'Indústria / Inox',
  R: 'Distribuição',
}

export const POTENCIAL_OPTIONS = ['Alto', 'Médio', 'Baixo'] as const

export const SITUACAO_OPTIONS = ['Qualificado', 'Desqualificado'] as const

export const EMPTY_FILTERS: Filters = {
  q: '',
  categoria: '',
  potencial: '',
  cidade: '',
  situacao: '',
  multiproduto: '',
}

/** Campos editáveis alinhados aos filtros + operação comercial */
export const EDITABLE_FIELDS: {
  key: keyof Lead
  label: string
  kind: 'text' | 'textarea' | 'select' | 'date'
  options?: readonly string[]
}[] = [
  { key: 'empresa', label: 'Empresa', kind: 'text' },
  { key: 'cnpj', label: 'CNPJ', kind: 'text' },
  { key: 'cidade', label: 'Cidade', kind: 'text' },
  { key: 'estado', label: 'Estado', kind: 'text' },
  { key: 'categoria', label: 'Categoria', kind: 'select', options: ['C', 'CD', 'M', 'I', 'R'] },
  { key: 'subcategoria', label: 'Subcategoria', kind: 'text' },
  { key: 'potencial', label: 'Potencial', kind: 'select', options: POTENCIAL_OPTIONS },
  { key: 'situacao', label: 'Situação', kind: 'select', options: SITUACAO_OPTIONS },
  { key: 'ultima_compra', label: 'Última compra', kind: 'date' },
  { key: 'multiproduto', label: 'Multiproduto', kind: 'select', options: ['Sim', 'Não'] },
  { key: 'produto_provavel', label: 'Produto principal', kind: 'textarea' },
  { key: 'produto_secundario', label: 'Produto secundário', kind: 'textarea' },
  { key: 'proxima_acao', label: 'Próxima ação', kind: 'textarea' },
  { key: 'motivo_prospect', label: 'Motivo', kind: 'textarea' },
  { key: 'abordagem', label: 'Abordagem', kind: 'textarea' },
  { key: 'telefone', label: 'Telefone', kind: 'text' },
  { key: 'whatsapp', label: 'WhatsApp', kind: 'text' },
  { key: 'email', label: 'E-mail', kind: 'text' },
  { key: 'comprador', label: 'Comprador', kind: 'text' },
  { key: 'observacoes_comerciais', label: 'Observações', kind: 'textarea' },
]
