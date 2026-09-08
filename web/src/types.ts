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
  situacao: string
  proxima_acao: string
  necessidade_identificada: string
  classificacao_comercial: string
  motivo_prospect: string
  abordagem: string
  visita_presencial: string
  observacoes_comerciais: string
}

export type Filters = {
  q: string
  categoria: string
  potencial: string
  cidade: string
  classificacao: string
  situacao: string
  multiproduto: string
  visita: string
}

export const CATEGORIA_LABEL: Record<string, string> = {
  C: 'Construção',
  CD: 'Corte e Dobra',
  M: 'Metalúrgica',
  I: 'Indústria / Inox',
  R: 'Distribuição',
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  categoria: '',
  potencial: '',
  cidade: '',
  classificacao: '',
  situacao: '',
  multiproduto: '',
  visita: '',
}
