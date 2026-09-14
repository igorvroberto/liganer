import type { BudgetListItem } from "../lib/budgetTypes";

type Props = {
  items: BudgetListItem[];
  loading?: boolean;
  onPdf: (number: string) => void;
  onEdit: (number: string) => void;
  onDelete: (number: string) => void;
};

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

export default function SavedBudgetsList({
  items,
  loading = false,
  onPdf,
  onEdit,
  onDelete,
}: Props) {
  return (
    <section className="card span-all saved-budgets">
      <div className="section-head">
        <h2>Orçamentos salvos</h2>
      </div>
      {loading ? <p className="note">Carregando orçamentos…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="note">Nenhum orçamento salvo ainda. Gere um PDF cliente para salvar.</p>
      ) : null}
      {items.length > 0 ? (
        <div className="table-scroll">
          <table className="items-table saved-budgets-table">
            <thead>
              <tr>
                <th>Nome do orçamento</th>
                <th>Cliente</th>
                <th>CNPJ</th>
                <th>Dia/horário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.source}-${row.number}`}>
                  <td>
                    <strong>{row.number}</strong>
                  </td>
                  <td>{row.client || "—"}</td>
                  <td>{row.cnpj || "—"}</td>
                  <td>{formatWhen(row.savedAt || row.createdAt)}</td>
                  <td>
                    <div className="saved-budget-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => onPdf(row.number)}>
                        PDF
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => onEdit(row.number)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => onDelete(row.number)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
