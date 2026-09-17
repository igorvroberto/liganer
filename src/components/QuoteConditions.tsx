import {
  QUOTE_CONDITION_FIELDS,
  type QuoteConditions,
} from "../lib/quoteSummary";

type Props = {
  conditions: QuoteConditions;
  onChange: (key: keyof QuoteConditions, value: string) => void;
  onSave: () => void;
  onCancelEdit?: () => void;
  editingNumber?: string | null;
  statusText?: string;
  statusKind?: "" | "ok" | "error";
  saveBusy?: boolean;
};

/** Condições + ação Salvar/Atualizar (PDF/XLSX ficam em Orçamentos salvos). */
export default function QuoteConditions({
  conditions,
  onChange,
  onSave,
  onCancelEdit,
  editingNumber = null,
  statusText,
  statusKind = "",
  saveBusy = false,
}: Props) {
  const saveLabel = editingNumber ? `Atualizar ${editingNumber}` : "Salvar";
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
          className="btn btn-dark"
          onClick={onSave}
          disabled={saveBusy}
        >
          {saveBusy ? "Salvando…" : saveLabel}
        </button>
        {editingNumber && onCancelEdit ? (
          <button type="button" className="btn btn-secondary" onClick={onCancelEdit}>
            Cancelar edição
          </button>
        ) : null}
      </div>
      {statusText ? <p className={`status ${statusKind}`}>{statusText}</p> : null}
    </section>
  );
}
