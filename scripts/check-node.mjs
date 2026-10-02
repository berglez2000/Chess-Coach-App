import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkNodeVersion(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  if (major !== 24 || minor < 15) {
    throw new Error(`Chess Coach requires Node 24.15.0 or later within Node 24; currently running Node ${version}. Run nvm install and nvm use in this project, then restart the app.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { checkNodeVersion(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
