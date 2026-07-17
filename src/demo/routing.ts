export type DemoRoute = "/" | "/dev/hero-background" | "/dev/benchmark";

function normalizeBase(baseUrl: string) {
  const normalized = `/${baseUrl}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? "" : normalized.replace(/\/$/, "");
}

export function resolveDemoRoute(pathname: string, baseUrl: string): DemoRoute {
  const base = normalizeBase(baseUrl);
  const withoutBase =
    base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const route = `/${withoutBase}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  if (route === "/dev/hero-background") return route;
  if (route === "/dev/benchmark") return route;
  return "/";
}

export function demoHref(route: DemoRoute, baseUrl: string) {
  const base = normalizeBase(baseUrl);
  return route === "/" ? `${base}/` || "/" : `${base}${route}`;
}
