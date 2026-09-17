import { useEffect, useState } from "react";
import SlitterCalculator from "./calculators/SlitterCalculator";
import {
  fetchVendasUser,
  vendasLoginUrl,
  type VendasUser,
} from "./lib/vendasAuth";

export default function App() {
  const [vendasUser, setVendasUser] = useState<VendasUser | null>(null);

  useEffect(() => {
    void fetchVendasUser().then(setVendasUser);
  }, []);

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
          <div className="session-chip">
            {vendasUser ? (
              <>
                <strong>{vendasUser.name}</strong>
                <span>{vendasUser.email}</span>
              </>
            ) : (
              <a
                className="btn btn-secondary btn-compact"
                href={vendasLoginUrl(`${import.meta.env.BASE_URL}`)}
              >
                Entrar
              </a>
            )}
          </div>
        </div>
      </header>

      <SlitterCalculator vendasUser={vendasUser} onVendasUser={setVendasUser} />
    </div>
  );
}
