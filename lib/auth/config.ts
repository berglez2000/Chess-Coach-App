export function readAuthConfig(env: Record<string, string | undefined>) {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.");
  let url: URL;
  try { url = new URL(env.BETTER_AUTH_URL ?? ""); }
  catch { throw new Error("Set BETTER_AUTH_URL to the app's exact origin."); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Plain HTTP is only safe on a link nobody else can observe: loopback, or a private VPN/LAN the operator vouches for.
  const allowHttp = loopback || env.BETTER_AUTH_ALLOW_HTTP?.trim() === "true";
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && allowHttp))) {
    throw new Error("BETTER_AUTH_URL must be an HTTPS origin (HTTP is allowed on localhost, or anywhere with BETTER_AUTH_ALLOW_HTTP=true).");
  }
  return { secret, baseURL: url.origin };
}
