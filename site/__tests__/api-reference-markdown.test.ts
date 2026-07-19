import { describe, expect, test } from "bun:test";
import { API_REFERENCE } from "@site/data/api-reference";
import { createApiReferenceMarkdown } from "@site/lib/api-reference-markdown";

describe("API reference Markdown", () => {
  const markdown = createApiReferenceMarkdown(API_REFERENCE, {
    title: "LumaThread props reference",
    description: "Complete public API.",
    installCommand: "bunx shadcn@latest add example",
    documentationUrl: "https://example.com/#api",
  });

  test("contains every reference group and row", () => {
    for (const group of API_REFERENCE) {
      expect(markdown).toContain(`## ${group.title}`);
      for (const row of group.rows) {
        expect(markdown).toContain(`\`${row.name}\``);
      }
    }
  });

  test("includes useful standalone context", () => {
    expect(markdown).toStartWith("# LumaThread props reference\n");
    expect(markdown).toContain("## Installation");
    expect(markdown).toContain("bunx shadcn@latest add example");
    expect(markdown).toContain(
      "[Open the documentation](https://example.com/#api)",
    );
  });

  test("escapes TypeScript unions inside Markdown tables", () => {
    expect(markdown).toContain('`"dark" \\| "light"`');
  });
});
