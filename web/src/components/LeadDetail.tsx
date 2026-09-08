import type { Lead } from '../types'
import { CATEGORIA_LABEL } from '../types'

type Props = {
  lead: Lead | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function Linkish({ value }: { value?: string }) {
  if (!value || value === 'Não identificado' || value === 'N/A') return <span>{value || '—'}</span>
  if (value.startsWith('http')) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value}
      </a>
    )
  }
  if (value.includes('@')) {
    return <a href={`mailto:${value}`}>{value}</a>
  }
  return <span>{value}</span>
}

export function LeadDetail({ lead, onClose }: Props) {
  if (!lead) {
    return (
      <aside className="detail empty-detail">
        <p>Selecione um lead na tabela para ver o dossiê comercial.</p>
      </aside>
    )
  }

  const wa = lead.whatsapp?.replace(/\D/g, '')

  return (
    <aside className="detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">
            {lead.id} · {lead.categoria}/{lead.subcategoria} · {CATEGORIA_LABEL[lead.categoria]}
          </p>
          <h2>{lead.empresa}</h2>
          <p className="muted">
            {lead.cidade}/{lead.estado} · Potencial <strong>{lead.potencial}</strong>
            {/^sim/i.test(lead.multiproduto) ? ' · ★ Multiproduto' : ''}
          </p>
        </div>
        <button type="button" className="btn ghost" onClick={onClose} aria-label="Fechar">
          Fechar
        </button>
      </header>

      <div className="detail-actions">
        {lead.telefone && lead.telefone !== 'Não identificado' ? (
          <a className="btn" href={`tel:${lead.telefone.replace(/[^\d+]/g, '')}`}>
            Ligar
          </a>
        ) : null}
        {wa ? (
          <a className="btn" href={`https://wa.me/55${wa.replace(/^55/, '')}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : null}
        {lead.email && lead.email.includes('@') ? (
          <a className="btn ghost" href={`mailto:${lead.email}`}>
            E-mail
          </a>
        ) : null}
        {lead.site?.startsWith('http') ? (
          <a className="btn ghost" href={lead.site} target="_blank" rel="noreferrer">
            Site
          </a>
        ) : null}
      </div>

      <dl className="detail-grid">
        <Row label="Classificação" value={lead.classificacao_comercial} />
        <Row label="Situação" value={lead.situacao} />
        <Row label="Próxima ação" value={lead.proxima_acao} />
        <Row label="Produto principal" value={lead.produto_provavel} />
        <Row label="Produto secundário" value={lead.produto_secundario} />
        <Row label="Justificativa" value={lead.justificativa_produto} />
        <Row label="Motivo (prospect)" value={lead.motivo_prospect} />
        <Row label="Abordagem" value={lead.abordagem} />
        <Row label="Consumo" value={lead.consumo_estimado} />
        <Row label="Recorrente" value={lead.compra_recorrente} />
        <Row label="Visita" value={lead.visita_presencial} />
        <Row label="Tipo de operação" value={lead.tipo_operacao} />
        <Row label="Fabrica / constrói" value={lead.o_que_fabrica_constroi} />
        <Row label="Obras atuais" value={lead.obras_atuais} />
        <Row label="Fornecedor atual" value={lead.fornecedor_atual} />
        <Row label="Comprador" value={lead.comprador} />
        <Row label="Cargo" value={lead.cargo_comprador} />
        <Row label="Telefone" value={lead.telefone} />
        <Row label="WhatsApp" value={lead.whatsapp} />
        <div className="detail-row">
          <dt>E-mail</dt>
          <dd>
            <Linkish value={lead.email} />
          </dd>
        </div>
        <div className="detail-row">
          <dt>Site</dt>
          <dd>
            <Linkish value={lead.site} />
          </dd>
        </div>
        <Row label="Endereço" value={lead.endereco} />
        <Row label="CNPJ" value={lead.cnpj} />
        <Row label="Necessidade" value={lead.necessidade_identificada} />
        <Row label="Observações" value={lead.observacoes_comerciais} />
        <Row label="Fonte" value={lead.fonte} />
        <Row label="Data pesquisa" value={lead.data_pesquisa} />
        <Row label="Último contato" value={lead.ultimo_contato || '—'} />
      </dl>
    </aside>
  )
}
