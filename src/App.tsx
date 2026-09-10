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
            <p className="eyebrow">Liganer</p>
            <h1>Orçamento de blanks e slitters</h1>
          </div>
        </div>
      </header>

      <SlitterCalculator />
    </div>
  );
}
