import { expect, it } from "vitest";
import { checkNodeVersion } from "../../scripts/check-node.mjs";

it("rejects unsupported runtimes with instructions before the app starts", () => {
  for (const version of ["20.19.4", "22.13.0", "23.10.0", "24.14.0", "25.0.0"]) {
    expect(() => checkNodeVersion(version)).toThrow(`currently running Node ${version}`);
    expect(() => checkNodeVersion(version)).toThrow("nvm install and nvm use");
  }
  for (const version of ["24.15.0", "24.21.0"]) expect(() => checkNodeVersion(version)).not.toThrow();
});
