import { test, expect } from "@playwright/test";
import { ACCOUNTANT, ADMIN, ENGINEER, loginAs } from "./helpers";

// Phone-sized viewport: nothing may spill sideways, and the key controls must still be reachable.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const noSidewaysScroll = async (page: import("@playwright/test").Page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page is wider than the screen").toBeLessThanOrEqual(1);
};

const SHOTS = process.env.SHOT_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test("login screen fits", async ({ page }) => {
  await page.goto("/engineer");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, "m-login");
});

test("timesheet: entry card works on a phone", async ({ page }) => {
  await loginAs(page, ENGINEER);
  await expect(page.getByLabel("New entry hours")).toBeVisible();
  await noSidewaysScroll(page);
  await shot(page, "m-timesheet");
  await page.getByLabel("New entry notes").fill("phone entry");
  await page.getByLabel("New entry hours").fill("1.25");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.locator('input[value="phone entry"]')).toHaveCount(1);
  await noSidewaysScroll(page);
});

test("manager pages fit", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/accountant");
  await expect(page.getByRole("heading", { name: "Review & export" })).toBeVisible();
  await page.getByRole("button", { name: "All time" }).click();
  await noSidewaysScroll(page);
  await shot(page, "m-review");
  for (const [path, name] of [["/customers", "m-customers"], ["/tasks", "m-tasks"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await noSidewaysScroll(page);
    await shot(page, name);
  }
});

test("admin pages fit (team, account)", async ({ page }) => {
  await loginAs(page, ADMIN, "/team");
  for (const [path, name] of [["/team", "m-team"], ["/account", "m-account"]] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await noSidewaysScroll(page);
    await shot(page, name);
  }
});
