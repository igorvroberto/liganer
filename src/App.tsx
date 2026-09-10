import { useState } from "react";
import BlankCalculator from "./calculators/BlankCalculator";
import SlitterCalculator from "./calculators/SlitterCalculator";
import { CALCULATOR_MODELS, type CalculatorModel } from "./lib/types";

export default function App() {
  const [model, setModel] = useState<CalculatorModel>("slitters");

  return (
    <div className="app">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            LG
          </div>
          <div>
            <p className="eyebrow">Liganer · Aço inoxidável</p>
            <h1>Calculadora de aproveitamento de blanks e slitters</h1>
          </div>
        </div>
        <p className="lede">
          Escolha o modelo de cálculo. Slitters usa a mecânica atual de tiras na bobina. Blanks parte
          da mesma base e terá regras próprias em seguida.
        </p>
        <div className="model-picker" role="group" aria-label="Modelo de cálculo">
          <span className="model-picker-label">Modelo</span>
          <div className="chips">
            {CALCULATOR_MODELS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip ${model === option.value ? "active" : ""}`}
                onClick={() => setModel(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {model === "slitters" ? (
        <SlitterCalculator key="slitters" />
      ) : (
        <BlankCalculator key="blanks" />
      )}
    </div>
  );
}
