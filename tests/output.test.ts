import { expect, test } from "bun:test";
import { withLoading } from "../src/core/output";

test("loading helper preserves results when animation is disabled", async () => {
  const result = await withLoading("Working...", async () => "done", { enabled: false });

  expect(result).toBe("done");
});

test("loading helper preserves action errors when animation is disabled", async () => {
  const error = new Error("failed");

  await expect(withLoading("Working...", async () => { throw error; }, { enabled: false })).rejects.toBe(error);
});
