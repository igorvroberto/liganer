import {
  QUOTE_CONDITION_FIELDS,
  type QuoteConditions,
} from "../lib/quoteSummary";

type Props = {
  conditions: QuoteConditions;
  onChange: (key: keyof QuoteConditions, value: string) => void;
  onPdfCliente: () => void;
  onPdfLiganer: () => void;
  onPdfGestao: () => void;
  onXlsx: () => void;
  statusText?: string;
  statusKind?: "" | "ok" | "error";
  pdfClienteBusy?: boolean;
};

/** Condições + ações de PDF (salvamento ocorre ao gerar PDF cliente). */
export default function QuoteConditions({
  conditions,
  onChange,
  onPdfCliente,
  onPdfLiganer,
  onPdfGestao,
  onXlsx,
  statusText,
  statusKind = "",
  pdfClienteBusy = false,
}: Props) {
  return (
    <section className="card">
      <h2>Condições</h2>
      <div className="grid-2">
        {QUOTE_CONDITION_FIELDS.map((field) => (
          <label className="field" key={field.key}>
            <span>{field.label}</span>
            {field.kind === "select" ? (
              <select
                value={conditions[field.key]}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Selecionar…</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={conditions[field.key]}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <div className="actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPdfCliente}
          disabled={pdfClienteBusy}
        >
          {pdfClienteBusy ? "Salvando…" : "PDF cliente"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPdfLiganer}>
          PDF Liganer
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPdfGestao}>
          PDF gestão
        </button>
        <button type="button" className="btn btn-secondary" onClick={onXlsx}>
          XLSX
        </button>
      </div>
      {statusText ? <p className={`status ${statusKind}`}>{statusText}</p> : null}
    </section>
  );
}
