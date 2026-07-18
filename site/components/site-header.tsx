import { AudioWaveform, FlaskConical } from "lucide-react";
import { Button } from "@site/components/ui/button";
import { siteHref } from "../routing";
import { ModeToggle } from "./mode-toggle";

export const GITHUB_URL = "https://github.com/Fefedu973/lumathread";

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.04 11.04 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.26 5.68.41.35.78 1.05.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "#showcase", label: "Showcase" },
  { href: "#features", label: "Features" },
  { href: "#lab", label: "Lab" },
  { href: "#api", label: "API" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 md:px-6">
        <a
          href="#top"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <AudioWaveform className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">LumaThread</span>
        </a>
        <nav
          className="hidden items-center gap-1 text-sm md:flex"
          aria-label="Sections"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            nativeButton={false}
            render={<a href={siteHref("/lab", import.meta.env.BASE_URL)} />}
          >
            <FlaskConical className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Open the Lab</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            nativeButton={false}
            render={
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub repository"
              />
            }
          >
            <GithubIcon className="size-4" />
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
