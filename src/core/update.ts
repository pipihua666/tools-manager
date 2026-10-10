export async function updateCli(): Promise<void> {
  const npm = Bun.which("npm");
  if (!npm) throw new Error("npm is required to update Tools Manager. Install npm and try again.");

  const child = Bun.spawn([npm, "install", "--global", "tools-manager@latest"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) {
    const details = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
    throw new Error(`Failed to update Tools Manager (npm exited with code ${exitCode}).${details ? `\n${details}` : ""}`);
  }
}
