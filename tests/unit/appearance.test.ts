import { describe, expect, it } from "vitest";
import { normalizeAppearance } from "../../src/appearance";

describe("appearance normalization", () => {
  it("always resolves to the single notebook appearance", () => {
    for (const value of [undefined, null, "", "glass", "paper", "liquid", "notebook", "neo", 42]) {
      expect(normalizeAppearance(value)).toBe("notebook");
    }
  });

  it("keeps legacy persisted settings from selecting a removed appearance", () => {
    expect(normalizeAppearance("liquid")).toBe("notebook");
    expect(normalizeAppearance("neo")).toBe("notebook");
  });
});
