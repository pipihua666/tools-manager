export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function heading(text: string): void {
  console.log(`\n${text}`);
  console.log("=".repeat(text.length));
}

export function note(text: string): void {
  console.log(text);
}

export function success(text: string): void {
  console.log(`OK  ${text}`);
}

export async function withLoading<T>(text: string, action: () => Promise<T>, options: { enabled?: boolean } = {}): Promise<T> {
  const enabled = options.enabled !== false && Boolean(process.stderr.isTTY) && process.env.TERM !== "dumb";
  if (!enabled) return action();

  const frames = ["|", "/", "-", "\\"];
  let frame = 0;
  const render = () => process.stderr.write(`\r\x1b[2K${frames[frame++ % frames.length]} ${text}`);
  render();
  const timer = setInterval(render, 80);
  try {
    return await action();
  } finally {
    clearInterval(timer);
    process.stderr.write("\r\x1b[2K");
  }
}

export function table(rows: Array<Record<string, unknown>>, options: { title?: string; empty?: string; maxWidth?: number } = {}): void {
  if (options.title) heading(options.title);
  if (rows.length === 0) {
    console.log(options.empty || "No rows.");
    return;
  }
  const maxWidth = options.maxWidth ?? 64;
  const columns = Object.keys(rows[0] || {});
  const widths = columns.map((column) =>
    Math.max(displayWidth(column), ...rows.map((row) => displayWidth(formatCell(row[column], maxWidth)))),
  );
  const border = `+-${widths.map((width) => "-".repeat(width)).join("-+-")}-+`;
  console.log(border);
  console.log(`| ${columns.map((column, index) => padCell(column, widths[index] || 0)).join(" | ")} |`);
  console.log(border);
  for (const row of rows) {
    console.log(`| ${columns.map((column, index) => padCell(formatCell(row[column], maxWidth), widths[index] || 0)).join(" | ")} |`);
  }
  console.log(border);
}

function formatCell(value: unknown, maxWidth: number): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (displayWidth(text) <= maxWidth) return text;
  return truncateCell(text, maxWidth);
}

function padCell(text: string, width: number): string {
  return `${text}${" ".repeat(Math.max(0, width - displayWidth(text)))}`;
}

function truncateCell(text: string, maxWidth: number): string {
  const suffix = "...";
  const target = Math.max(0, maxWidth - suffix.length);
  let result = "";
  let width = 0;
  for (const char of text) {
    const next = charWidth(char);
    if (width + next > target) break;
    result += char;
    width += next;
  }
  return `${result}${suffix}`;
}

function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

function charWidth(char: string): number {
  const code = char.codePointAt(0) || 0;
  if (code === 0) return 0;
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0;
  return code >= 0x1100 ? 2 : 1;
}
