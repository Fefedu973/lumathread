import { GITHUB_URL } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:px-6">
        <p>
          A composable WebGL luminous-filament renderer for React. Built on{" "}
          <a
            href="https://ui.shadcn.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            shadcn/ui
          </a>{" "}
          primitives.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          github.com/Fefedu973/lumathread
        </a>
      </div>
    </footer>
  );
}
