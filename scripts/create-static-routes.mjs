import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("site-dist");
const entry = resolve(outputDirectory, "index.html");
const routes = ["dev/hero-background", "dev/benchmark"];

await copyFile(entry, resolve(outputDirectory, "404.html"));

for (const route of routes) {
  const routeDirectory = resolve(outputDirectory, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(entry, resolve(routeDirectory, "index.html"));
}
