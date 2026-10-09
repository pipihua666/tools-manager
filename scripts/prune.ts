import { previewSessionPrune, pruneSessions, SESSION_PRUNE_RULES } from "../src/core/session-prune";

const preview = await previewSessionPrune();
console.log(SESSION_PRUNE_RULES);
console.log(`${preview.candidates.length} eligible sessions; ${(preview.estimatedBytes / 1024 / 1024).toFixed(2)} MiB to release; ${preview.skippedCount} unreadable sessions skipped.`);
if (process.argv.includes("--yes")) {
  const result = await pruneSessions(preview);
  console.log(`Deleted ${result.deletedCount} sessions. Released ${result.freedBytes} bytes (${(result.freedBytes / 1024 / 1024).toFixed(2)} MiB). Kept ${result.skippedCount} changed sessions.`);
  for (const error of result.errors) console.error(error);
  if (result.errors.length) process.exitCode = 1;
} else {
  console.log("Preview only. Run npm run prune -- --yes to permanently delete these sessions.");
}
