import type { Lead } from '../types'
import { CATEGORIA_ABREV, CATEGORIA_OPTIONS } from '../types'

type Props = {
  all: Lead[]
  filtered: Lead[]
}

export function StatsBar({ all, filtered }: Props) {
  const count = (pred: (l: Lead) => boolean) => filtered.filter(pred).length
  const byCat = CATEGORIA_OPTIONS.map((c) => ({
    c,
    n: count((l) => l.categoria === c),
  })).filter((x) => x.n > 0)

  return (
    <section className="stats" aria-label="Resumo">
      <div className="stat">
        <strong>{filtered.length}</strong>
        <span>visíveis / {all.length}</span>
      </div>
      <div className="stat">
        <strong>{count((l) => l.potencial === 'Alto')}</strong>
        <span>potencial Alto</span>
      </div>
      <div className="stat cats">
        {byCat.map(({ c, n }) => (
          <span key={c} title={c}>
            {CATEGORIA_ABREV[c] ?? c}:{n}
          </span>
        ))}
      </div>
    </section>
  )
}
