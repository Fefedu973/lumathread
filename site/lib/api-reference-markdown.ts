import type { PropGroup } from "@site/data/api-reference";

export interface ApiReferenceMarkdownOptions {
  title: string;
  description?: string;
  installCommand?: string;
  documentationUrl?: string;
}

function escapeTableCell(value: string) {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>")
    .replace(/`/g, "\\`");
}

function codeCell(value: string) {
  return `\`${escapeTableCell(value)}\``;
}

export function createApiReferenceMarkdown(
  groups: readonly PropGroup[],
  options: ApiReferenceMarkdownOptions,
) {
  const lines = [`# ${options.title}`];

  if (options.description) {
    lines.push("", options.description);
  }

  if (options.installCommand) {
    lines.push(
      "",
      "## Installation",
      "",
      "```bash",
      options.installCommand,
      "```",
    );
  }

  if (options.documentationUrl) {
    lines.push("", `[Open the documentation](${options.documentationUrl})`);
  }

  for (const group of groups) {
    lines.push("", `## ${group.title}`);

    if (group.description) {
      lines.push("", group.description);
    }

    lines.push(
      "",
      "| Prop | Type | Default | Description |",
      "| --- | --- | --- | --- |",
      ...group.rows.map(
        (row) =>
          `| ${codeCell(row.name)} | ${codeCell(row.type)} | ${
            row.defaultValue ? codeCell(row.defaultValue) : "—"
          } | ${escapeTableCell(row.description)} |`,
      ),
    );
  }

  return `${lines.join("\n")}\n`;
}
