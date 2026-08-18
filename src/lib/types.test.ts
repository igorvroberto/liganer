import { describe, expect, it } from "vitest";
import { lengthColor, widthColor } from "./types";

describe("cores de largura e comprimento", () => {
  it("nunca usa a mesma cor para largura e comprimento do mesmo item", () => {
    for (let i = 0; i < 16; i++) {
      expect(widthColor(i)).not.toBe(lengthColor(i));
    }
  });
});
