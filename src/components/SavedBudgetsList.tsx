import type { BudgetListItem } from "../lib/budgetTypes";

type Props = {
  items: BudgetListItem[];
  loading?: boolean;
  onPdfCliente: (number: string) => void;
  onPdfLiganer: (number: string) => void;
  onPdfGestao: (number: string) => void;
  onXlsx: (number: string) => void;
  onEdit: (number: string) => void;
  onDelete: (number: string) => void;
};

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function ownerLabel(item: BudgetListItem): string {
  const name = item.owner?.name?.trim();
  if (name) return name;
  const email = item.owner?.email?.trim();
  if (email) return email;
  return "—";
}

export default function SavedBudgetsList({
  items,
  loading = false,
  onPdfCliente,
  onPdfLiganer,
  onPdfGestao,
  onXlsx,
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
        <p className="note">Nenhum orçamento salvo ainda. Use Salvar nas Condições.</p>
      ) : null}
      {items.length > 0 ? (
        <div className="table-scroll saved-budgets-scroll">
          <table className="saved-budgets-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>CNPJ</th>
                <th>Dono</th>
                <th>Dia/horário</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={`${row.source}-${row.number}`}>
                  <td>{row.number}</td>
                  <td>{row.client || "—"}</td>
                  <td>{row.cnpj || "—"}</td>
                  <td>{ownerLabel(row)}</td>
                  <td>{formatWhen(row.savedAt || row.createdAt)}</td>
                  <td>
                    <div className="saved-budget-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => onPdfCliente(row.number)}
                      >
                        PDF cliente
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => onPdfLiganer(row.number)}
                      >
                        PDF Liganer
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => onPdfGestao(row.number)}
                      >
                        PDF gestão
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => onXlsx(row.number)}
                      >
                        XLSX
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => onEdit(row.number)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-compact"
                        onClick={() => onDelete(row.number)}
                      >
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
