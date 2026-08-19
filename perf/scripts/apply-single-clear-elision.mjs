import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

const path = readArg("--path", "src/runtime/glass-terrain-renderer.ts");
const selectedIndex = Number(readArg("--index", "-1"));
const countOnly = args.includes("--count");
if (!Number.isInteger(selectedIndex) && !countOnly) {
  throw new Error("--index must be an integer.");
}

const source = await readFile(path, "utf8");
const pattern =
  /\b([A-Za-z_$][\w$]*)\.clearColor\([^;]*\);\s*\1\.clear\(\s*\1\.COLOR_BUFFER_BIT\s*\);/g;
const matches = [...source.matchAll(pattern)];

if (countOnly) {
  process.stdout.write(`${matches.length}\n`);
  process.exit(0);
}
if (selectedIndex < 0 || selectedIndex >= matches.length) {
  throw new Error(
    `Clear-pair index ${selectedIndex} is outside 0..${matches.length - 1} in ${path}.`,
  );
}

const selected = matches[selectedIndex];
const start = selected.index;
const end = start + selected[0].length;
const line = source.slice(0, start).split("\n").length;
const replacement = `/* LUMATHREAD_EXACT_CLEAR_ELISION_${selectedIndex}_LINE_${line} */`;
const transformed = source.slice(0, start) + replacement + source.slice(end);
await writeFile(path, transformed);

console.log(
  `Elided clear pair ${selectedIndex}/${matches.length - 1} at ${path}:${line}.`,
);
