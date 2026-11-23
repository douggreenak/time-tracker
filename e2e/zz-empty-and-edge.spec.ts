import { test, expect } from "@playwright/test";
import { ACCOUNTANT, ADMIN, loginAs } from "./helpers";

const SHOTS = process.env.SHOT_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const noSideways = async (page: import("@playwright/test").Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

// These tests run last (file name) because they wipe the sample data.
test("very long names don't break the layout (desktop + phone)", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/customers");
  const long = "Northern Pacific Interconnect & Subsea Cable Landing Authority of the Greater Aleutian Region";
  await page.getByLabel("New customer name").fill(long);
  await page.getByLabel("New customer name").press("Enter");
  await expect(page.getByLabel("Customer name", { exact: true })).toHaveValue(long); // wait until it's selected
  await page.getByLabel("New project name").fill("Phase 3 — Directional boring crossing under the Susitna River floodplain, including permitting");
  await page.getByLabel("New project name").press("Enter");
  await expect(page.locator('input[aria-label="Project name"][value*="Directional boring"]')).toHaveCount(1);
  await shot(page, "x-long-customers");
  await noSideways(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await noSideways(page);
  await shot(page, "x-long-customers-mobile");
  await page.goto("/engineer");
  await expect(page.getByLabel("New entry hours")).toBeVisible();
  await page.getByLabel("New entry customer").fill(long);
  await page.getByLabel("New entry customer").press("Enter");
  await page.getByLabel("New entry hours").fill("2");
  await page.getByLabel("New entry hours").press("Enter");
  await expect(page.locator(`input[value="${long}"]`).first()).toBeVisible();
  await noSideways(page);
  await shot(page, "x-long-timesheet-mobile");
});

test("clearing sample data leads to first-run setup and clean empty screens", async ({ page }) => {
  await loginAs(page, ADMIN, "/accountant");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("clear-demo").click();

  // Everyone is gone, so the app asks for a first admin.
  await expect(page.getByRole("heading", { name: "Set up TimeTrack" })).toBeVisible();
  await shot(page, "x-setup");
  await page.getByLabel("Your name").fill("Pat Owner");
  await page.getByLabel("Email").fill("pat@example.com");
  await page.getByLabel("Password", { exact: true }).fill("a-long-password");
  await page.getByRole("button", { name: /Create admin/ }).click();

  await expect(page.getByLabel("New entry hours")).toBeVisible();
  await expect(page.getByText("No time logged yet", { exact: false })).toBeVisible();
  await shot(page, "x-empty-timesheet");

  for (const [path, text, name] of [
    ["/accountant", "Nothing matches these filters.", "x-empty-review"],
    ["/customers", "Add a customer to get started.", "x-empty-customers"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(text)).toBeVisible();
    await shot(page, name);
  }
  await page.goto("/tasks");
  await shot(page, "x-empty-tasks");

  // The very first entry works from a blank database via create-on-type.
  await page.goto("/engineer");
  await page.getByLabel("New entry customer").fill("First Client");
  await page.getByLabel("New entry customer").press("Enter");
  await page.getByLabel("New entry task").fill("Site visit");
  await page.getByLabel("New entry task").press("Enter");
  await page.getByLabel("New entry hours").fill("1.5");
  await page.getByLabel("New entry hours").press("Enter");
  await expect(page.locator('input[value="1.50"]')).toHaveCount(1);
  await expect(page.getByTestId("clear-demo")).toHaveCount(0);
});
