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

/**
 * Campos alinhados ao exemplo tubos/barras.
 * Colunas novas do Excel entram aqui; as que já existiam no app são mantidas.
 */
export const MODELS: ModelDef[] = [
  {
    id: 'chapas',
    name: 'ACE',
    status: 'configured',
    sheet: 'Orçamento',
    rowRange: '3 a 12',
    fields: [
      {
        key: 'referencia',
        label: 'Referência',
        aliases: ['referencia', 'referência', 'codigo', 'código', 'ref'],
        locked: true,
      },
      {
        key: 'material',
        label: 'Material',
        aliases: ['material', 'produto', 'descricao', 'descrição'],
        searchable: true,
        askWhenNew: true,
      },
      {
        key: 'pecas',
        label: 'Peças',
        aliases: ['pecas', 'peças', 'peca', 'peça'],
        type: 'number',
        fractionDigits: 0,
        useGrouping: true,
      },
      {
        key: 'quantidade',
        label: 'Qde.',
        aliases: ['qde', 'qtde', 'quantidade', 'qtd'],
        type: 'number',
        fractionDigits: 2,
        useGrouping: true,
      },
      { key: 'um', label: 'UM', aliases: ['um', 'unidade medida'], default: 'KG', locked: true },
      {
        key: 'preco_sp',
        label: 'Preço\nICMS 18%',
        aliases: ['preco sp', 'preço sp', 'preco icms 18', 'icms 18', 'sp para sp'],
        type: 'currency',
        calculated: true,
        virtual: true,
        calc: 'precoSp',
      },
      {
        key: 'preco_ce',
        label: 'Preço\nICMS 4%',
        aliases: ['preco ce', 'preço ce', 'preco icms 4', 'icms 4', 'ce para sp'],
        type: 'currency',
        calculated: true,
        virtual: true,
        calc: 'precoCe',
      },
      {
        key: 'ipi',
        label: 'IPI',
        aliases: ['ipi'],
        type: 'percent',
        default: 5,
        fractionDigits: 0,
      },
      calcField('_estoque_total', 'Estoque\ntotal', 'number', 'estoqueTotal', {
        fractionDigits: 0,
        useGrouping: true,
      }),
      {
        key: 'estoque_sp',
        label: 'Estoque\nSP',
        aliases: ['estoque sp'],
        type: 'number',
        fractionDigits: 0,
        useGrouping: true,
        locked: true,
      },
      {
        key: 'estoque_ce',
        label: 'Estoque\nCE',
        aliases: ['estoque ce'],
        type: 'number',
        fractionDigits: 0,
        useGrouping: true,
        locked: true,
      },
      calcField('_subtotal_sp', 'Subtotal\n18%', 'currency', 'subtotalSp'),
      calcField('_subtotal_ce', 'Subtotal\n4%', 'currency', 'subtotalCe'),
      { key: 'observacao', label: 'Observação', aliases: ['observacao', 'observação', 'obs'] },
      {
        key: 'fator_maximo',
        label: 'Fator\nmáximo',
        aliases: ['fator maximo', 'fator máximo'],
        type: 'number',
      },
      {
        key: 'fator_utilizado',
        label: 'Fator\nutilizado',
        aliases: ['fator utilizado', 'fator usado'],
        type: 'number',
      },
      calcField('_calculo_ipi_sp', 'Cálculo IPI\n18%', 'currency', 'calculoIpiSp'),
      calcField('_calculo_ipi_ce', 'Cálculo IPI\n4%', 'currency', 'calculoIpiCe'),
      calcField('_preco_com_ipi_sp', 'Com IPI\n18%', 'currency', 'precoComIpiSp'),
      calcField('_preco_com_ipi_ce', 'Com IPI\n4%', 'currency', 'precoComIpiCe'),

      // Campos que já existiam no app (mantidos)
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
      {
        key: 'comissao',
        label: 'Comissão',
        aliases: ['comissao', 'comissão'],
        options: COMMISSION_OPTIONS,
        askWhenNew: true,
      },
      // Por último, como no Excel exemplo (origem: catálogo do produto)
      {
        key: 'fator_real_18',
        label: 'Fator real\n18%',
        aliases: ['fator real 18', 'fator real 18%'],
        type: 'number',
        fractionDigits: 0,
        calculated: true,
        virtual: true,
        calc: 'fatorReal18',
      },
      {
        key: 'fator_real_4',
        label: 'Fator real\n4%',
        aliases: ['fator real 4', 'fator real 4%'],
        type: 'number',
        fractionDigits: 0,
      },
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
  'fator_real_18',
  'fator_real_4',
  'comissao',
  'preco_fator_100',
  '_preco_fator_utilizado',
  'preco_bobina_fator_100',
  '_preco_bobina_fator_utilizado',
  'campanha',
  'acrescimo_perda_percentual',
  '_acrescimo_perda_percentual',
  '_acrescimo_perda_valor',
  'estoque_total',
  '_estoque_total',
  'estoque_sp',
  'estoque_ce',
  '_calculo_ipi_sp',
  '_calculo_ipi_ce',
  '_preco_com_ipi_sp',
  '_preco_com_ipi_ce',
])

/** Colunas só do regime ICMS 4% (omitidas no PDF 18%). */
export const PDF_4_ONLY_KEYS = new Set(['preco_ce', '_subtotal_ce'])

/** Colunas só do regime ICMS 18% (omitidas no PDF 4%). */
export const PDF_18_ONLY_KEYS = new Set(['preco_sp', '_subtotal_sp'])
