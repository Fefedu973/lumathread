import type { ReactNode } from "react";
import { cn } from "@site/lib/utils";

export function DemoSection({
  id,
  index,
  title,
  description,
  children,
  className,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 border-t py-16 md:py-20", className)}
    >
      <div className="mb-10 max-w-2xl">
        <p className="mb-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {index}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function FeatureCard({
  title,
  description,
  hint,
  children,
  className,
}: {
  title: string;
  description: string;
  /** Short call-to-action displayed under the demo, e.g. "Move your cursor". */
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card/50 p-5 md:p-6",
        className,
      )}
    >
      <header className="max-w-xl">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-4">{children}</div>
      {hint ? (
        <p className="text-xs text-muted-foreground">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
          {hint}
        </p>
      ) : null}
    </article>
  );
}
