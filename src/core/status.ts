import { openDb } from "./db";
import { paths } from "./paths";
import { detectTools } from "./tools";

export async function status() {
  const db = await openDb();
  const skillCount = (db.query("SELECT COUNT(*) AS count FROM skills").get() as { count: number }).count;
  const presetCount = (db.query("SELECT COUNT(*) AS count FROM presets").get() as { count: number }).count;
  const mcpCount = (db.query("SELECT COUNT(*) AS count FROM mcp_servers").get() as { count: number }).count;
  return {
    root: paths().root,
    skillsDir: paths().skillsDir,
    dbPath: paths().dbPath,
    configPath: paths().configPath,
    skillCount,
    presetCount,
    mcpCount,
    tools: await detectTools(),
  };
}
