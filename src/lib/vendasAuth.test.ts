import { describe, expect, it } from "vitest";
import { normalizeVendasUser, vendasLoginUrl } from "./vendasAuth";

describe("vendasAuth", () => {
  it("normalizeVendasUser exige email", () => {
    expect(normalizeVendasUser(null)).toBeNull();
    expect(normalizeVendasUser({ name: "X" })).toBeNull();
    expect(normalizeVendasUser({ email: "a@b.com", name: "Ana", id: "1" })).toEqual({
      id: "1",
      email: "a@b.com",
      name: "Ana",
    });
    expect(normalizeVendasUser({ email: "a@b.com" })).toEqual({
      id: "a@b.com",
      email: "a@b.com",
      name: "a@b.com",
    });
  });

  it("vendasLoginUrl monta next", () => {
    expect(vendasLoginUrl("/orcamento/blanks-slitters/")).toBe(
      "/login.html?next=%2Forcamento%2Fblanks-slitters%2F",
    );
  });
});
