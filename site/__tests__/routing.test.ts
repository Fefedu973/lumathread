import { describe, expect, test } from "bun:test";
import { resolveSiteRoute, siteHref } from "../routing";

describe("static site routing", () => {
  test("resolves local routes", () => {
    expect(resolveSiteRoute("/", "/")).toBe("/");
    expect(resolveSiteRoute("/lab", "/")).toBe("/lab");
    expect(resolveSiteRoute("/lab/", "/")).toBe("/lab");
    expect(resolveSiteRoute("/unknown", "/")).toBe("/");
  });

  test("keeps the lab's legacy address working", () => {
    expect(resolveSiteRoute("/dev/hero-background", "/")).toBe("/lab");
    expect(resolveSiteRoute("/dev/hero-background/", "/")).toBe("/lab");
  });

  test("strips the GitHub Pages repository base", () => {
    expect(resolveSiteRoute("/lumathread/", "/lumathread/")).toBe("/");
    expect(resolveSiteRoute("/lumathread/lab/", "/lumathread/")).toBe("/lab");
    expect(
      resolveSiteRoute("/lumathread/dev/hero-background/", "/lumathread/"),
    ).toBe("/lab");
  });

  test("builds links for local and Pages deployments", () => {
    expect(siteHref("/lab", "/")).toBe("/lab");
    expect(siteHref("/", "/lumathread/")).toBe("/lumathread/");
    expect(siteHref("/lab", "/lumathread/")).toBe("/lumathread/lab");
  });
});
