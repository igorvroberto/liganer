import type { QuoteClientInfo } from "../lib/quoteClient";

type Props = {
  client: QuoteClientInfo;
  onChange: (next: QuoteClientInfo) => void;
};

/** Nome do cliente + CNPJ — mesma posição/padrão do chapas-bobinas (antes de Itens). */
export default function QuoteClientFields({ client, onChange }: Props) {
  return (
    <section className="card client-fields-card">
      <div className="grid-2">
        <label className="field">
          <span>Nome do cliente</span>
          <input
            type="text"
            value={client.name}
            onChange={(e) => onChange({ ...client, name: e.target.value })}
            autoComplete="organization"
          />
        </label>
        <label className="field">
          <span>CNPJ</span>
          <input
            type="text"
            value={client.cnpj}
            onChange={(e) => onChange({ ...client, cnpj: e.target.value })}
            autoComplete="off"
            inputMode="numeric"
          />
        </label>
      </div>
    </section>
  );
}
