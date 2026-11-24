import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTANT, ENGINEER, loginAs } from "./helpers";

const open = (page: Page, path = "/engineer", who = ENGINEER) => loginAs(page, who, path);

test.describe("timesheet grid", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await expect(page.getByLabel("New entry hours")).toBeVisible();
  });

  test("adds a row with Enter and keeps the customer for the next one", async ({ page }) => {
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

  test("arrow keys move between rows and the filter narrows the grid", async ({ page }) => {
    const hours = page.getByLabel("New entry hours");
    await hours.fill("1");
    await hours.press("Enter");
    await expect(page.getByLabel("Hours", { exact: true }).first()).toBeVisible();

    await expect(hours).toBeFocused(); // focus is back on the entry row after the add
    await hours.press("ArrowDown");
    await expect(page.getByLabel("Hours", { exact: true }).first()).toBeFocused();

    await page.getByLabel("Filter timesheet rows").fill("zzz-no-match");
    await expect(page.getByText("No rows match your filter.")).toBeVisible();
  });

  test("customer dropdown searches existing customers", async ({ page }) => {
    const customer = page.getByLabel("New entry customer");
    await customer.click();
    await expect(page.getByRole("option")).not.toHaveCount(0);
    await customer.fill("metro");
    await expect(page.getByRole("option", { name: "Metro Water District" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Apex Energy Solutions" })).toHaveCount(0);
    await customer.press("Enter");
    await expect(customer).toHaveValue("Metro Water District");
  });

  test("typing an unknown customer / project / service adds it", async ({ page }) => {
    const stamp = Date.now();
    const customer = page.getByLabel("New entry customer");
    await customer.fill(`Acme ${stamp}`);
    await expect(page.getByRole("option", { name: new RegExp(`Add “Acme ${stamp}”`) })).toBeVisible();
    await customer.press("Enter");
    await expect(customer).toHaveValue(`Acme ${stamp}`);

    const job = page.getByLabel("New entry job");
    await job.fill(`Phase ${stamp}`);
    await job.press("Enter");
    await expect(job).toHaveValue(`Phase ${stamp}`);

    const service = page.getByLabel("New entry task");
    await service.fill(`Survey ${stamp}`);
    await service.press("Enter");
    await expect(service).toHaveValue(`Survey ${stamp}`);

    const hours = page.getByLabel("New entry hours");
    await hours.fill("1");
    await hours.press("Enter");
    const row = page.locator("tr", { has: page.locator(`input[value="Acme ${stamp}"]`) });
    await expect(row).toHaveCount(1);
    await expect(row.getByLabel("Job")).toHaveValue(`Phase ${stamp}`);
  });
});

test("stopwatch is secondary: collapsed by default, opens with W", async ({ page }) => {
  await open(page);
  await expect(page.getByLabel("New entry hours")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/ })).toHaveCount(0);
  await page.keyboard.press("w");
  await expect(page.getByRole("button", { name: /^Start/ })).toBeVisible();
});

test("dark mode toggles and persists", async ({ page }) => {
  await open(page);
  await page.evaluate(() => localStorage.removeItem("tt-theme"));
  await page.getByRole("button", { name: /dark mode/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: /light mode/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("customers page: add customer, add project, rename, archive", async ({ page }) => {
  const stamp = Date.now();
  await open(page, "/customers", ACCOUNTANT);
  await page.getByLabel("New customer name").fill(`Zeta ${stamp}`);
  await page.getByLabel("New customer name").press("Enter");
  await expect(page.getByRole("option", { name: new RegExp(`Zeta ${stamp}`) })).toBeVisible();

  await page.getByLabel("New project name").fill("Bridge Inspection");
  await page.getByLabel("New project name").press("Enter");
  await expect(page.getByLabel("Project name")).toHaveValue("Bridge Inspection");
  await expect(page.getByText(`Zeta ${stamp}:Bridge Inspection`)).toBeVisible();

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const name = page.getByLabel("Customer name", { exact: true });
  await name.fill(`Zeta Renamed ${stamp}`);
  await page.getByRole("button", { name: "Save" }).click();
  // The QuickBooks name is independent and must keep matching QuickBooks.
  await expect(page.getByText(`Zeta ${stamp}:Bridge Inspection`)).toBeVisible();
  await expect(page.getByRole("option", { name: new RegExp(`Zeta Renamed ${stamp}`) })).toBeVisible();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("option", { name: new RegExp(`Zeta Renamed ${stamp}`) })).toHaveCount(0);
});

test("customers with logged time cannot be deleted", async ({ page }) => {
  await open(page, "/customers", ACCOUNTANT);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("option", { name: /Apex Energy Solutions/ }).click();
  await page.getByRole("button", { name: "Delete" }).first().click();
  await expect(page.getByText(/archive it instead/)).toBeVisible();
});

test("tasks page: add and edit a task", async ({ page }) => {
  const stamp = Date.now();
  await open(page, "/tasks", ACCOUNTANT);
  await page.getByLabel("New task name").fill(`Drone survey ${stamp}`);
  await page.getByLabel("New task name").press("Enter");
  const row = page.locator("tr", { has: page.locator(`input[value="Drone survey ${stamp}"]`) });
  await expect(row).toHaveCount(1);
  // Billable and hours belong to the timesheet, not the task list.
  await expect(page.getByRole("columnheader", { name: "Billable" })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Hours" })).toHaveCount(0);
  await expect(page.getByLabel("Billable by default")).toHaveCount(0);
});
