import { SavedListSection } from "@liganer/shared/react";
import type { BudgetSituacao, SavedListItem } from "@liganer/shared";
import { useMemo } from "react";
import {
  normalizeBudgetSituacao,
  toSavedListItem,
  type BudgetListItem,
} from "../lib/budgetTypes";

type Props = {
  items: BudgetListItem[];
  loading?: boolean;
  editingNumber?: string | null;
  onPdfCliente: (number: string) => void;
  onPdfLiganer: (number: string) => void;
  onPdfGestao: (number: string) => void;
  onXlsx: (number: string) => void;
  onEdit: (item: BudgetListItem) => void;
  onDelete: (item: BudgetListItem) => void;
  onSituacaoChange: (item: BudgetListItem, situacao: BudgetSituacao) => void;
};

export default function SavedBudgetsList({
  items,
  loading = false,
  editingNumber = null,
  onPdfCliente,
  onPdfLiganer,
  onPdfGestao,
  onXlsx,
  onEdit,
  onDelete,
  onSituacaoChange,
}: Props) {
  const savedListItems = useMemo<SavedListItem[]>(
    () =>
      items.map((item) => {
        const isEditing = Boolean(
          editingNumber && (item.number === editingNumber || item.name === editingNumber),
        );
        return { ...toSavedListItem(item), meta: { isEditing, source: item.source } };
      }),
    [items, editingNumber],
  );

  return (
    <SavedListSection
      title="Orçamentos salvos"
      sectionClassName="card span-all saved-budgets"
      items={savedListItems}
      loading={loading}
      emptyNote="Nenhum orçamento salvo ainda. Use Salvar nas Condições."
      entityLabel="orçamento"
      logoUrl={`${window.location.origin}${import.meta.env.BASE_URL}liganer_favicon.webp`}
      editingBanner={
        editingNumber ? (
          <p className="editing-banner">
            Editando orçamento <strong>{editingNumber}</strong>. Use <strong>Atualizar</strong> para
            gravar as alterações
          </p>
        ) : null
      }
      onSituacaoChange={(item, situacao) => {
        const original = items.find(
          (row) => row.id === item.id || row.number === item.number,
        );
        if (original && normalizeBudgetSituacao(original.situacao) !== situacao) {
          onSituacaoChange(original, situacao);
        }
      }}
      renderActions={(item) => {
        const original = items.find(
          (row) => row.id === item.id || row.number === item.number,
        );
        if (!original) return null;
        return (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onPdfCliente(original.number)}
            >
              PDF cliente
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onPdfLiganer(original.number)}
            >
              PDF Liganer
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onPdfGestao(original.number)}
            >
              PDF gestão
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onXlsx(original.number)}
            >
              XLSX
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => onEdit(original)}
            >
              Editar
            </button>
            <button
              type="button"
              className="btn btn-danger btn-compact"
              onClick={() => onDelete(original)}
            >
              Excluir
            </button>
          </>
        );
      }}
    />
  );
}
