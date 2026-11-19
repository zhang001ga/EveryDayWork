import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModuleArtwork, moduleArtworkSources } from "../../src/components/ModuleArtwork";

describe("Notion-style module icons", () => {
  it("provides one unique inline icon name for every module", () => {
    const sources = Object.values(moduleArtworkSources);
    expect(sources).toHaveLength(13);
    expect(new Set(sources).size).toBe(13);
    for (const source of sources) expect(source).toMatch(/^[A-Z][A-Za-z]+$/);
    expect(moduleArtworkSources).toMatchObject({
      development: "Code",
      testing: "Flask",
      writing: "PenNib",
      fitness: "Barbell",
      diet: "ForkKnife",
      reading: "BookOpen",
      sleep: "Moon",
    });
  });

  it("renders an inline SVG icon that is decorative by default and labelable when used alone", () => {
    const { container, rerender } = render(<ModuleArtwork module="fitness" />);
    const decorative = container.querySelector("span.module-artwork");
    expect(decorative).not.toBeNull();
    expect(decorative).toHaveClass("notion-module-icon");
    expect(decorative).toHaveAttribute("aria-hidden", "true");
    expect(decorative).toHaveAttribute("data-module", "fitness");
    expect(decorative).toHaveAttribute("data-icon", "Barbell");
    expect(decorative?.querySelector("svg")).not.toBeNull();

    rerender(<ModuleArtwork module="settings" label="数据与设置" />);
    const labelled = screen.getByRole("img", { name: "数据与设置" });
    expect(labelled).toHaveAttribute("data-icon", "GearSix");
    expect(labelled.querySelector("svg")).not.toBeNull();
    expect(labelled).not.toHaveAttribute("aria-hidden");
  });
});
