import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("site-dist");
const entry = resolve(outputDirectory, "index.html");
// "dev/hero-background" is the lab's legacy address, kept so old links resolve.
const routes = ["lab", "dev/hero-background"];

await copyFile(entry, resolve(outputDirectory, "404.html"));

for (const route of routes) {
  const routeDirectory = resolve(outputDirectory, route);
  await mkdir(routeDirectory, { recursive: true });
  await copyFile(entry, resolve(routeDirectory, "index.html"));
}
