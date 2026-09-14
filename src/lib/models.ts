import type { FieldDef, ModelDef } from './types'

export const COMMISSION_OPTIONS = ['Bonificada', 'Normal', 'Reduzida']

function calcField(
  key: string,
  label: string,
  type: FieldDef['type'],
  calc: FieldDef['calc'],
  extra: Partial<FieldDef> = {},
): FieldDef {
  return { key, label, type, virtual: true, calculated: true, calc, ...extra }
}

function footerFieldsModule(): FieldDef[] {
  return [
    { key: 'pagamento', label: 'Pagamento', aliases: ['pagamento', 'condicao', 'condição'], section: 'Rodapé' },
    { key: 'prazo_entrega', label: 'Prazo de entrega', aliases: ['prazo de entrega', 'entrega', 'prazo'], section: 'Rodapé' },
    {
      key: 'local_expedicao',
      label: 'Local de expedição',
      aliases: ['local de expedicao', 'local de expedição', 'expedicao', 'expedição'],
      options: ['SP', 'CE'],
      askWhenNew: true,
      section: 'Rodapé',
    },
    {
      key: 'cidade_cliente',
      label: 'Cidade/UF do cliente',
      aliases: [
        'cidade/uf do cliente',
        'cidade uf do cliente',
        'cidade do cliente',
        'cidade',
        'cliente cidade',
      ],
      section: 'Rodapé',
    },
    {
      key: 'tipo_frete',
      label: 'Tipo de frete',
      aliases: ['tipo de frete', 'frete'],
      options: ['CIF', 'FOB'],
      askWhenNew: true,
      section: 'Rodapé',
    },
    {
      key: 'observacoes_gerais',
      label: 'Observações gerais',
      aliases: ['observacoes gerais', 'observações gerais', 'observacoes', 'observações'],
      section: 'Rodapé',
    },
    {
      key: 'frete_percentual',
      label: 'Frete (%)',
      aliases: ['frete', 'percentual frete', 'frete percentual', 'frete %'],
      type: 'percent',
      section: 'Rodapé',
    },
  ]
}

function commercialFields(): FieldDef[] {
  return [
    { key: 'observacao', label: 'Observação', aliases: ['observacao', 'observação', 'obs'] },
    {
      key: 'preco_fator_100',
      label: 'Preço\nfator 100',
      aliases: [
        'preco fator 100', 'preço fator 100', 'preco', 'preço', 'valor',
        'preco bobina fator 100', 'preço bobina fator 100',
      ],
      type: 'currency',
      calculated: true,
      virtual: true,
      calc: 'precoFator100',
    },
    { key: 'fator_maximo', label: 'Fator\nmáximo', aliases: ['fator maximo', 'fator máximo'], type: 'number' },
    { key: 'fator_utilizado', label: 'Fator\nutilizado', aliases: ['fator utilizado', 'fator usado'], type: 'number' },
    calcField('_preco_fator_utilizado', 'Preço\nfator utilizado', 'currency', 'precoFatorUtilizado'),
    { key: 'comissao', label: 'Comissão', aliases: ['comissao', 'comissão'], options: COMMISSION_OPTIONS, askWhenNew: true },
  ]
}

function icmsField(): FieldDef {
  return {
    key: 'icms',
    label: 'ICMS',
    aliases: ['icms'],
    type: 'percent',
    fractionDigits: 0,
  }
}

/** Ordem: ACE MTS/MTO, FIL IND, AÇOS PRIME, IMG, CSA, TETTO (cada um MTS depois MTO). */
function supplierFields(): FieldDef[] {
  const groups: {
    key: (suffix: string) => string
    label: string
    alias: (suffix: string) => string[]
  }[] = [
    {
      key: (suffix) => `ace_${suffix}`,
      label: 'ACE',
      alias: (suffix) => [`ace ${suffix}`],
    },
    {
      key: (suffix) => `filial_industria_${suffix}`,
      label: 'FIL IND',
      alias: (suffix) => [
        `filial industria ${suffix}`,
        `filial indústria ${suffix}`,
        `fil ind ${suffix}`,
      ],
    },
    {
      key: (suffix) => `acos_prime_${suffix}`,
      label: 'AÇOS PRIME',
      alias: (suffix) => [`acos prime ${suffix}`, `aços prime ${suffix}`],
    },
    {
      key: (suffix) => `img_${suffix}`,
      label: 'IMG',
      alias: (suffix) => [`img ${suffix}`],
    },
    {
      key: (suffix) => `csa_${suffix}`,
      label: 'CSA',
      alias: (suffix) => [`csa ${suffix}`],
    },
    {
      key: (suffix) => `tetto_${suffix}`,
      label: 'TETTO',
      alias: (suffix) => [`tetto ${suffix}`],
    },
  ]

  const fields: FieldDef[] = []
  for (const group of groups) {
    for (const suffix of ['mts', 'mto'] as const) {
      fields.push({
        key: group.key(suffix),
        label: `${group.label}\n${suffix.toUpperCase()}`,
        aliases: group.alias(suffix),
        type: 'boolean',
      })
    }
  }
  return fields
}

export const MODELS: ModelDef[] = [
  {
    id: 'chapas',
    name: 'ACE',
    status: 'configured',
    sheet: 'Orçamento',
    rowRange: '3 a 12',
    fields: [
      {
        key: 'material',
        label: 'Material',
        aliases: ['material', 'produto', 'descricao', 'descrição'],
        searchable: true,
        askWhenNew: true,
      },
      { key: 'um', label: 'UM', aliases: ['um', 'unidade medida'], default: 'KG' },
      icmsField(),
      calcField('_subtotal', 'Subtotal', 'currency', 'subtotal'),
      ...commercialFields(),
      { key: 'preco_servico', label: 'Preço\nserviço', aliases: ['preco servico', 'preço serviço'], type: 'currency' },
      { key: 'descricao_servico', label: 'Descrição\nserviço', aliases: ['descricao servico', 'descrição serviço'] },
      calcField('_preco_total', 'Preço\ntotal', 'currency', 'precoTotal'),
      calcField('_preco_sem_ipi', 'Preço\nsem IPI', 'currency', 'precoSemIpi'),
      ...supplierFields(),
      ...footerFieldsModule(),
    ],
  },
]

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}

export function itemFields(model: ModelDef): FieldDef[] {
  return model.fields.filter((f) => f.section !== 'Rodapé' && !f.hiddenInApp)
}

export function footerFields(model: ModelDef): FieldDef[] {
  return model.fields.filter((f) => f.section === 'Rodapé')
}

export function fieldLabel(label: string): string {
  return label.replace(/\n/g, ' ')
}

/** Cabeçalho da tabela de itens: cada espaço vira quebra de linha. */
export function itemHeaderLabel(label: string): string {
  return label.replace(/ +/g, '\n')
}

/** Campos internos omitidos no PDF do cliente */
export const HIDDEN_FROM_CLIENT = new Set([
  'fator_maximo',
  'fator_utilizado',
  'comissao',
  'preco_fator_100',
  '_preco_fator_utilizado',
  'preco_bobina_fator_100',
  '_preco_bobina_fator_utilizado',
  'preco_servico',
  'descricao_servico',
  'campanha',
  'acrescimo_perda_percentual',
  '_acrescimo_perda_percentual',
  '_acrescimo_perda_valor',
  '_preco_total',
])

export function isSupplierKey(key: string): boolean {
  return /^(ace_|filial_industria_|acos_prime_|img_|csa_|tetto_)/.test(key)
}
