import "server-only";
import OpenAI from "openai";
import { PROVIDER_MAX_RETRIES, PROVIDER_TIMEOUT_MS } from "./providers";

/** DeepSeek supports the Responses API, including JSON schema output. */
export function createDeepSeekClient(timeout = PROVIDER_TIMEOUT_MS): OpenAI {
  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY?.trim() ?? "",
    baseURL: "https://api.deepseek.com",
    organization: null,
    project: null,
    timeout,
    maxRetries: PROVIDER_MAX_RETRIES,
  });
}
