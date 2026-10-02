import { mkdir, copyFile, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const { version } = require("pdfjs-dist/package.json");
await mkdir("public/pdfjs", { recursive: true });
await copyFile(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), `public/pdfjs/pdf.worker-${version}.mjs`);
// Compressed images and embedded fonts need resources in addition to the worker.
const packageRoot = dirname(require.resolve("pdfjs-dist/package.json"));
for (const directory of ["wasm", "cmaps", "standard_fonts"]) {
  await cp(join(packageRoot, directory), `public/pdfjs/${version}/${directory}`, { recursive: true });
}
