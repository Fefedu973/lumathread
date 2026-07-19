import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@site/components/ui/tabs";
import { cn } from "@site/lib/utils";

const MANAGERS = [
  {
    id: "bun",
    label: "bun",
    command:
      "bunx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json",
  },
  {
    id: "npm",
    label: "npm",
    command:
      "npx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json",
  },
  {
    id: "pnpm",
    label: "pnpm",
    command:
      "pnpm dlx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json",
  },
  {
    id: "yarn",
    label: "yarn",
    command:
      "yarn dlx shadcn@latest add https://fefedu973.github.io/lumathread/r/lumathread.json",
  },
] as const;

export function InstallTabs({ className }: { className?: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(command);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard unavailable — nothing to do.
    }
  };

  return (
    <Tabs
      defaultValue="bun"
      className={cn(
        "inline-flex max-w-full flex-col gap-0 overflow-hidden rounded-xl border bg-muted/40 backdrop-blur",
        className,
      )}
    >
      <TabsList
        variant="line"
        className="h-9 gap-2 border-b border-border/60 px-2"
      >
        {MANAGERS.map((manager) => (
          <TabsTrigger
            key={manager.id}
            value={manager.id}
            className="font-mono text-xs"
          >
            {manager.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {MANAGERS.map((manager) => (
        <TabsContent key={manager.id} value={manager.id} className="w-full">
          <div className="flex items-center gap-3 py-2.5 pr-2 pl-4">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground sm:text-[13px]">
              <span className="select-none text-muted-foreground/60">$ </span>
              {manager.command}
            </code>
            <button
              type="button"
              onClick={() => copy(manager.command)}
              aria-label={
                copied === manager.command ? "Copied" : "Copy install command"
              }
              className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied === manager.command ? (
                <Check className="size-3.5 text-emerald-500" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </button>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
