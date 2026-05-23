// Allow only same-origin paths in redirects driven by user-controlled
// `next` parameters. Blocks //evil.com, /\evil.com, and any absolute URL.
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length === 0) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.startsWith("/\\")) return "/";
  return next;
}
