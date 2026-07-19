import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const labRoot = join(root, "site", "features", "lab");

function lineCount(path: string) {
  return readFileSync(path, "utf8").split(/\r?\n/u).length;
}

function sourceFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    if (entry.isDirectory()) return sourceFiles(child);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [child] : [];
  });
}

describe("lab architecture", () => {
  test("keeps the route as a composition boundary", () => {
    const page = join(root, "site", "pages", "lab.tsx");
    expect(lineCount(page)).toBeLessThanOrEqual(30);
    const source = readFileSync(page, "utf8");
    expect(source).toContain("useLabController");
    expect(source).toContain("LabShell");
  });

  test("keeps feature modules focused", () => {
    for (const file of sourceFiles(labRoot)) {
      const localPath = relative(root, file);
      const maximum = localPath.endsWith("use-lab-controller.ts") ? 700 : 600;
      expect(
        lineCount(file),
        `${localPath} exceeded ${maximum} lines`,
      ).toBeLessThanOrEqual(maximum);
    }
  });

  test("keeps every control domain behind a section", () => {
    const expectedSections = [
      "renderer",
      "inputs",
      "path",
      "motion",
      "material",
      "palette",
      "scene",
      "glass",
      "lifecycle",
    ];

    for (const section of expectedSections) {
      const path = join(labRoot, "sections", `${section}-section.tsx`);
      expect(() => readFileSync(path, "utf8")).not.toThrow();
    }

    const pathSection = readFileSync(
      join(labRoot, "sections", "path-section.tsx"),
      "utf8",
    );
    expect(pathSection).toContain("PathInterpolationControls");
  });

  test("keeps every lab parameter wired to a control", async () => {
    // Counting JSX tokens breaks as soon as controls are rendered from a
    // helper or a map, so assert the real contract instead: every field of the
    // serializable lab state must still be referenced by the feature.
    const { INITIAL_STATE } = await import(
      "../features/lab/model/initial-state"
    );
    const source = sourceFiles(labRoot)
      .filter((file) => !file.endsWith("initial-state.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    const orphaned = Object.keys(INITIAL_STATE).filter(
      (key) => !source.includes(key),
    );

    expect(
      orphaned,
      `lab state fields lost their controls: ${orphaned.join(", ")}`,
    ).toEqual([]);
  });

  test("keeps a dense control surface", () => {
    const source = sourceFiles(labRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    // Floors rather than exact counts: folding controls into helpers is
    // allowed, deleting whole families of them is not.
    const minimums = {
      "<NumberSlider": 140,
      "<SelectField": 15,
      "<SwitchField": 15,
      "<ControlGroup": 40,
      "<SectionHeading": 9,
    };

    for (const [token, minimum] of Object.entries(minimums)) {
      expect(
        source.split(token).length - 1,
        `${token} dropped below ${minimum}`,
      ).toBeGreaterThanOrEqual(minimum);
    }
  });

  test("routes every lab select through the label-aware adapter", () => {
    for (const file of sourceFiles(labRoot)) {
      if (file.endsWith("lab-select.tsx")) continue;
      expect(readFileSync(file, "utf8"), relative(root, file)).not.toContain(
        "@site/components/ui/select",
      );
    }
  });

  test("edits full filament settings through one selected control surface", () => {
    const controller = readFileSync(
      join(labRoot, "hooks", "use-filament-editor.ts"),
      "utf8",
    );
    const panel = readFileSync(
      join(labRoot, "controls", "lab-control-panel.tsx"),
      "utf8",
    );
    const model = readFileSync(
      join(labRoot, "model", "filament-state.ts"),
      "utf8",
    );

    expect(panel).toContain("FilamentSelector");
    expect(controller).toContain("updateFilamentScopedState");
    expect(model).toContain("FILAMENT_STATE_KEYS");
  });
});
