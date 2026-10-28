// Escape user-supplied strings before splicing them into HTML attributes or
// script-string literals. Every plugin that injects HTML MUST use this.

export function escapeHtmlAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Safe single-quoted JavaScript string literal: strip anything that could
// break out of a quoted string or close the enclosing <script> tag.
export function toJsString(s: string): string {
  return `'${String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/</g, "\\u003c")}'`;
}

// Whitelist helper — only allow a conservative shape for IDs that plugins
// paste into <script> contexts (GA measurement IDs, Meta pixel IDs, etc).
export function isSimpleId(s: unknown, maxLen = 64): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_\-.]{1,64}$/.test(s) && s.length <= maxLen;
}
