export type SiteRoute = "/" | "/lab";

function normalizeBase(baseUrl: string) {
  const normalized = `/${baseUrl}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? "" : normalized.replace(/\/$/, "");
}

export function resolveSiteRoute(pathname: string, baseUrl: string): SiteRoute {
  const base = normalizeBase(baseUrl);
  const withoutBase =
    base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const route = `/${withoutBase}`.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  if (route === "/lab") return "/lab";
  // Legacy address of the lab, kept so old links keep working.
  if (route === "/dev/hero-background") return "/lab";
  return "/";
}

export function siteHref(route: SiteRoute, baseUrl: string) {
  const base = normalizeBase(baseUrl);
  return route === "/" ? `${base}/` || "/" : `${base}${route}`;
}
