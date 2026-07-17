import { describe, expect, test } from "bun:test";
import { demoHref, resolveDemoRoute } from "../demo/routing";

describe("static demo routing", () => {
  test("resolves local routes", () => {
    expect(resolveDemoRoute("/", "/")).toBe("/");
    expect(resolveDemoRoute("/dev/hero-background", "/")).toBe(
      "/dev/hero-background",
    );
    expect(resolveDemoRoute("/dev/benchmark/", "/")).toBe("/dev/benchmark");
  });

  test("strips the GitHub Pages repository base", () => {
    expect(resolveDemoRoute("/lumathread/", "/lumathread/")).toBe("/");
    expect(
      resolveDemoRoute("/lumathread/dev/hero-background/", "/lumathread/"),
    ).toBe("/dev/hero-background");
  });

  test("builds links for local and Pages deployments", () => {
    expect(demoHref("/dev/benchmark", "/")).toBe("/dev/benchmark");
    expect(demoHref("/", "/lumathread/")).toBe("/lumathread/");
    expect(demoHref("/dev/hero-background", "/lumathread/")).toBe(
      "/lumathread/dev/hero-background",
    );
  });
});
