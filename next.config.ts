import type { NextConfig } from "next";
import { resolve } from "node:path";
import { e2eEnabled } from "./tests/support/e2e-environment";

export default function config(phase: string): NextConfig {
  if (!e2eEnabled(process.env, phase)) return { serverExternalPackages: ["pdfjs-dist"] };
  console.warn("E2E ONLY: deterministic engine/coaching/weekly-plan adapters; isolated test database.");
  return {
    serverExternalPackages: ["pdfjs-dist"],
    distDir: ".next-e2e",
    webpack(config, { webpack }) {
      // Replace before Next's tsconfig-path resolver consumes the @/ alias.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^@\/lib\/(engine\/stockfish|coaching\/ai-client|weekly-plan\/ai-client)$/,
        (resource: { request: string }) => {
          resource.request = resolve(resource.request.endsWith("stockfish")
            ? "tests/support/e2e-engine.ts" : resource.request.includes("weekly-plan") ? "tests/support/e2e-weekly-plan.ts" : "tests/support/e2e-coaching.ts");
        },
      ));
      return config;
    },
  };
}
