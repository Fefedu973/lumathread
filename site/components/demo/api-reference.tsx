import { Check, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@site/components/ui/button";
import { API_REFERENCE } from "@site/data/api-reference";
import { createApiReferenceMarkdown } from "@site/lib/api-reference-markdown";

const API_REFERENCE_MARKDOWN = createApiReferenceMarkdown(API_REFERENCE, {
  title: "LumaThread props reference",
  description:
    "The complete public API for the LumaThread registry component. LumaThread and LumaThreadScene are aliases of HeroWaveBackground and HeroWaveScene.",
  installCommand:
    "bunx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json",
  documentationUrl: "https://fefedu973.github.io/lumathread/#api",
});

export function ApiReference() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const buttonLabel = useMemo(
    () => (copied ? "Markdown copied" : "Copy as Markdown"),
    [copied],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(API_REFERENCE_MARKDOWN);
      setCopied(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={copyMarkdown}
          aria-label={buttonLabel}
        >
          {copied ? (
            <Check
              data-icon="inline-start"
              className="text-emerald-500"
              aria-hidden
            />
          ) : (
            <Copy data-icon="inline-start" aria-hidden />
          )}
          <span aria-live="polite">{buttonLabel}</span>
        </Button>
      </div>
      <div className="space-y-8">
        {API_REFERENCE.map((group) => (
          <div key={group.id} id={`api-${group.id}`} className="scroll-mt-24">
            <h3 className="mb-1 text-sm font-semibold tracking-tight">
              {group.title}
            </h3>
            {group.description ? (
              <p className="mb-3 text-xs text-muted-foreground">
                {group.description}
              </p>
            ) : (
              <div className="mb-3" />
            )}
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Prop</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Default</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.name} className="border-b last:border-b-0">
                      <td className="px-4 py-2.5 align-top font-mono text-xs whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="max-w-72 px-4 py-2.5 align-top font-mono text-xs text-muted-foreground">
                        {row.type}
                      </td>
                      <td className="px-4 py-2.5 align-top font-mono text-xs text-muted-foreground whitespace-pre-line">
                        {row.defaultValue ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 align-top text-xs text-muted-foreground">
                        {row.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
