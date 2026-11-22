import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Skip the local PIN gate by seeding the app's own stored auth flag.
  await page.addInitScript(() =>
    localStorage.setItem("timetracker_auth_state_v1", "authenticated")
  );
  await page.goto("/engineer");
  await expect(page.getByLabel("New entry hours")).toBeVisible();
});

test("adds a row from the entry row with Enter and keeps the customer", async ({ page }) => {
  const hours = page.getByLabel("New entry hours");
  const notes = `e2e-${Date.now()}`;
  await page.getByLabel("New entry notes").fill(notes);
  await hours.fill("1:30");
  await hours.press("Enter");

  const row = page.locator("tr", { has: page.locator(`input[value="${notes}"]`) });
  await expect(row).toHaveCount(1);
  await expect(row.getByLabel("Hours")).toHaveValue("1.50");
  await expect(hours).toHaveValue("");
});

test("edits hours inline and rejects invalid input", async ({ page }) => {
  const hours = page.getByLabel("New entry hours");
  await hours.fill("2h");
  await hours.press("Enter");

  const first = page.getByLabel("Hours", { exact: true }).first();
  await expect(first).toHaveValue("2.00");
  await first.fill("45m");
  await first.press("Tab");
  await expect(first).toHaveValue("0.75");

  await first.fill("nonsense");
  await first.press("Tab");
  await expect(page.getByRole("status")).toContainText("isn't a valid duration");
});

test("arrow keys move between rows and filter narrows the grid", async ({ page }) => {
  const hours = page.getByLabel("New entry hours");
  await hours.fill("1");
  await hours.press("Enter");
  await expect(page.getByLabel("Hours", { exact: true }).first()).toBeVisible();

  await hours.press("ArrowDown");
  await expect(page.getByLabel("Hours", { exact: true }).first()).toBeFocused();

  await page.getByLabel("Filter timesheet rows").fill("zzz-no-match");
  await expect(page.getByText("No rows match your filter.")).toBeVisible();
});
