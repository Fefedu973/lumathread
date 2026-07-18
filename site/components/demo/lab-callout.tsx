import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@site/components/ui/button";
import { siteHref } from "../../routing";

const LAB_POINTS = [
  "Every renderer option as a live control, across nine panels",
  "Draggable path points and dot-mask editors on the stage",
  "Randomize, presets, deterministic time scrubbing",
  "Copy any configuration as ready-to-paste TSX",
];

export function LabCallout() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card/50 p-6 md:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_80%_20%,--alpha(var(--color-primary)/6%),transparent)]"
      />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <FlaskConical className="size-3.5" aria-hidden />
            The Lab
          </p>
          <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
            A full playground for the entire engine.
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {LAB_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <Button
          size="lg"
          className="shrink-0 self-start md:self-center"
          nativeButton={false}
          render={<a href={siteHref("/lab", import.meta.env.BASE_URL)} />}
        >
          Open the Lab
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
