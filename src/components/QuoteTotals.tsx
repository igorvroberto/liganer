import { fmtCurrency, fmtInt } from "../lib/format";
import type { QuoteSummary } from "../lib/quoteSummary";

type Props = {
  summary: QuoteSummary;
};

/** Totais idênticos ao orçamento chapas-bobinas. */
export default function QuoteTotals({ summary }: Props) {
  return (
    <section className="card">
      <h2>Totais</h2>
      <div className="summary-grid">
        <div className="summary-item">
          <span>Total (Kg)</span>
          <strong>{fmtInt(summary.totalKg)} Kg</strong>
        </div>
        <div className="summary-item">
          <span>Subtotal</span>
          <strong>{fmtCurrency(summary.subtotal)}</strong>
        </div>
        <div className="summary-item">
          <span>IPI 3,25%</span>
          <strong>{fmtCurrency(summary.ipi)}</strong>
        </div>
        <div className="summary-item">
          <span>Total</span>
          <strong>{fmtCurrency(summary.total)}</strong>
        </div>
      </div>
    </section>
  );
}
