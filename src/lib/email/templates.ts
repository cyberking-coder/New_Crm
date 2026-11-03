// Minimal, safe variable interpolation for {{snake_case}} tokens.
// HTML values are escaped unless the token name ends in `_raw`.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TemplateVariables = Record<string, string | number | null | undefined>;

export function renderTemplate(
  input: string,
  variables: TemplateVariables,
  { html = false }: { html?: boolean } = {},
): string {
  return input.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, nameRaw: string) => {
    const name = nameRaw.toLowerCase();
    const raw = name.endsWith("_raw");
    const value = variables[raw ? name.slice(0, -4) : name];
    if (value === null || value === undefined) return "";
    const str = String(value);
    return html && !raw ? escapeHtml(str) : str;
  });
}

export function extractVariables(input: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const name = m[1]!.toLowerCase();
    const key = name.endsWith("_raw") ? name.slice(0, -4) : name;
    found.add(key);
  }
  return [...found].sort();
}
