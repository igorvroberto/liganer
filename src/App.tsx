import SlitterCalculator from "./calculators/SlitterCalculator";

export default function App() {
  return (
    <div className="app">
      <header className="hero">
        <div className="brand-row">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}liganer-favicon.webp`}
            alt="Liganer"
            width={42}
            height={42}
          />
          <div>
            <p className="eyebrow">Liganer · Aço inoxidável</p>
            <h1>Calculadora de aproveitamento de blanks e slitters</h1>
          </div>
        </div>
        <p className="lede">
          Informe os itens na bobina. O material (BLANK ou SLITTER) do primeiro item vale para toda a
          lista — não é possível misturar.
        </p>
      </header>

      <SlitterCalculator />
    </div>
  );
}
