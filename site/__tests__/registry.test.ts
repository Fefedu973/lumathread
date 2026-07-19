import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

interface RegistryFile {
  path: string;
  target?: string;
}

interface RegistryDefinition {
  items: Array<{
    name: string;
    files: RegistryFile[];
  }>;
}

const root = resolve(import.meta.dir, "../..");
const sourceRoot = join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : sourceFiles(path);
    }
    return [relative(root, path).split(sep).join("/")];
  });
}

describe("shadcn registry", () => {
  test("ships every renderer source module and no test modules", () => {
    const registry = JSON.parse(
      readFileSync(join(root, "registry.json"), "utf8"),
    ) as RegistryDefinition;
    const item = registry.items.find(({ name }) => name === "lumathread");
    expect(item).toBeDefined();

    const expected = sourceFiles(sourceRoot).sort();
    const actual = item?.files.map(({ path }) => path).sort();
    expect(actual).toEqual(expected);
    expect(actual?.some((path) => path.includes("__tests__"))).toBe(false);
  });

  test("preserves the renderer tree below the ui alias", () => {
    const registry = JSON.parse(
      readFileSync(join(root, "registry.json"), "utf8"),
    ) as RegistryDefinition;
    const item = registry.items.find(({ name }) => name === "lumathread");

    for (const file of item?.files ?? []) {
      expect(file.target).toBe(
        `@ui/lumathread/${file.path.replace(/^src\//, "")}`,
      );
    }
  });
});
