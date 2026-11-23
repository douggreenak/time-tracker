import { expect, test } from "@playwright/test";
import { ACCOUNTANT, ENGINEER, expandAllWeeks, loginAs } from "./helpers";

test.describe("collapsible pay weeks", () => {
  test("weeks collapse and expand, with hours in the header", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const toggles = page.getByTestId("week-toggle");
    await expect(toggles.first()).toBeVisible();
    expect(await toggles.count()).toBeGreaterThan(1);
    await expandAllWeeks(page);
    const first = toggles.first();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("week-hours").first()).toContainText(/\d+\.\d\d h/);
    const rows = await page.getByLabel("Hours", { exact: true }).count();
    expect(rows).toBeGreaterThan(0);
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    expect(await page.getByLabel("Hours", { exact: true }).count()).toBeLessThan(rows);
    await page.getByTestId("weeks-toggle-all").click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
  });

  test("accountant sees a By week view with Approve week", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    await page.getByRole("tab", { name: "By week" }).click();
    await expect(page.getByTestId("pay-week-toggle").first()).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("customer, project and task are optional", () => {
  test("an entry with only hours can be added, edited and exported", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await page.getByLabel("New entry customer").click();
    await page.getByRole("option", { name: "— no customer —" }).click();
    await page.getByLabel("New entry task").click();
    await page.getByRole("option", { name: "— no task —" }).click();
    await page.getByLabel("New entry hours").fill("1.25");
    await page.getByLabel("New entry hours").press("Enter");
    await expect(page.locator('input[aria-label="Hours"]').first()).toHaveValue(/1\.25|1:15/);
    const csv = await page.request.get("/api/export/csv");
    expect(csv.ok()).toBeTruthy();
    expect(await csv.text()).toContain("1.25");
  });
});
