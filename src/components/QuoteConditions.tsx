import {
  QUOTE_CONDITION_FIELDS,
  type QuoteConditions,
} from "../lib/quoteSummary";

type Props = {
  conditions: QuoteConditions;
  onChange: (key: keyof QuoteConditions, value: string) => void;
  onSave: () => void;
  onPdfCliente: () => void;
  onPdfLiganer: () => void;
  onPdfGestao: () => void;
  statusText?: string;
  statusKind?: "" | "ok" | "error";
};

/** Condições + ações idênticas ao orçamento chapas-bobinas. */
export default function QuoteConditions({
  conditions,
  onChange,
  onSave,
  onPdfCliente,
  onPdfLiganer,
  onPdfGestao,
  statusText,
  statusKind = "",
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
        <button type="button" className="btn btn-dark" onClick={onSave}>
          Salvar
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPdfCliente}>
          PDF cliente
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPdfLiganer}>
          PDF Liganer
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPdfGestao}>
          PDF gestão
        </button>
      </div>
      {statusText ? <p className={`status ${statusKind}`}>{statusText}</p> : null}
    </section>
  );
}
