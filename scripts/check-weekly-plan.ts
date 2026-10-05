import { loadEnvConfig } from "@next/env";
import { createPlanClient, planProviderAvailable, PLAN_TIMEOUT_MS } from "../lib/weekly-plan/ai-client";
import { DEFAULT_PROVIDER, PROVIDERS, providerSchema } from "../lib/coaching/providers";
import { validatePlan } from "../lib/weekly-plan/contract";
import { fixtureInputs } from "../tests/support/weekly-plan-fixtures";

async function main() {
// One explicit live request using synthetic inputs; no account data or database writes.
loadEnvConfig(process.cwd());
const provider = providerSchema.parse(process.argv[2] ?? DEFAULT_PROVIDER);
if (!planProviderAvailable(provider)) {
  console.log(JSON.stringify({ status: "NOT_CONFIGURED", provider, model: PROVIDERS[provider].model }));
} else {
  const startedAt = Date.now();
  const outcome = await createPlanClient(provider).generate(fixtureInputs, AbortSignal.timeout(PLAN_TIMEOUT_MS));
  if (outcome.status === "OK") {
    const plan = validatePlan(outcome.definition, fixtureInputs);
    console.log(JSON.stringify({ status: "OK", provider, requestedModel: PROVIDERS[provider].model, model: outcome.model,
      elapsedMs: Date.now() - startedAt, sessions: plan.sessions.length, minutes: plan.sessions.reduce((n, session) => n + session.minutes, 0), plan }, null, 2));
  } else {
    console.log(JSON.stringify({ status: "FAILED", provider, message: outcome.message, elapsedMs: Date.now() - startedAt }));
    process.exitCode = 1;
  }
}

}
main().catch(() => { console.error("Weekly-plan smoke check failed before receiving a valid response."); process.exitCode = 1; });
