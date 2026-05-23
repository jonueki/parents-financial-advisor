// Allow only same-origin paths in redirects driven by user-controlled
// `next` parameters. Allowlist approach: must start with a single "/", then
// only path-safe characters, with an optional query string. Blocks
// //evil.com, /\evil.com, /%2f%2fevil.com, CR/LF injection, JavaScript URIs,
// and absolute URLs.
const SAFE_PATH = /^\/[A-Za-z0-9._~\-/]*(\?[A-Za-z0-9._~\-/=&%]*)?$/;

export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) return "/";
  if (next.startsWith("//")) return "/";
  if (!SAFE_PATH.test(next)) return "/";
  return next;
}
