import { expect, test } from "@playwright/test";

// Deliberately failing: this branch exists to prove the browser job is a required
// check, and is closed without merging.
test("gate probe fails on purpose", async () => {
  expect(true).toBe(false);
});
