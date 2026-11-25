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
  await expect(page.locator(`input[aria-label="Customer name"][value^="Northern Pacific"]`)).toHaveCount(1);
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
  await loginAs(page, ADMIN, "/billing");
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("clear-demo").click();

  // Everyone is gone, so the app asks for a first admin.
  await expect(page.getByRole("heading", { name: "Create the first admin account" })).toBeVisible();
  await shot(page, "x-setup");
  await page.getByLabel("Your name").fill("Pat Owner");
  await page.getByLabel("Email").fill("pat@example.com");
  await page.getByLabel("Password", { exact: true }).fill("a-long-password");
  await page.getByRole("button", { name: /Create admin/ }).click();

  await expect(page.getByLabel("New entry hours")).toBeVisible();
  await expect(page.getByText("No time logged yet", { exact: false })).toBeVisible();
  await shot(page, "x-empty-timesheet");

  for (const [path, text, name] of [
    ["/billing", "No billable time in this range.", "x-empty-billing"],
    ["/customers", "No customers match.", "x-empty-customers"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByText(text)).toBeVisible();
    await shot(page, name);
  }

  // The very first entry works from a blank database via create-on-type, and bills at the default $250.
  await page.goto("/engineer");
  await page.getByLabel("New entry customer").fill("First Client");
  await page.getByLabel("New entry customer").press("Enter");
  await page.getByLabel("New entry description").fill("Site visit");
  await page.getByLabel("New entry hours").fill("1.5");
  await page.getByLabel("New entry hours").press("Enter");
  await expect(page.locator('input[aria-label="Hours"][value="1.5"]')).toHaveCount(1);
  await expect(page.getByTestId("clear-demo")).toHaveCount(0);

  await page.goto("/billing");
  await page.getByLabel("From date").fill("2000-01-01");
  await page.getByLabel("To date").fill("2099-12-31");
  await page.getByTestId("create-invoices").click();
  await expect(page.getByTestId("amount-due")).toHaveText("$375.00"); // 1.5 h x $250
});

test("Delete data: only the ticked parts are deleted", async ({ page }) => {
  const users = (await (await page.request.get("/api/auth/users")).json()).data.users as { id: string; name: string }[];
  const pat = users.find((u) => u.name === "Pat Owner")!;
  await page.request.post("/api/auth/login", { data: { userId: pat.id, password: "a-long-password" } });
  const entries = async () => ((await (await page.request.get("/api/time-entries")).json()).data as unknown[]).length;
  expect(await entries()).toBeGreaterThan(0);
  await page.request.post("/api/billing-items", { data: { kind: "other", customer: "X", description: "keep me", amount: 5 } });

  await page.goto("/admin");
  await page.getByTestId("clear-all-open").click();
  const dialog = page.getByRole("dialog", { name: "Delete data" });
  const go = dialog.getByTestId("clear-all-confirm");
  await dialog.getByLabel("Type DELETE DATA to confirm").fill("DELETE DATA");
  await dialog.getByLabel("Your admin password").fill("a-long-password");
  await expect(go).toContainText("delete all"); // everything is ticked by default

  await dialog.getByRole("button", { name: "Select none" }).click();
  await expect(go).toBeDisabled(); // nothing chosen
  // choosing Customers also chooses (and locks) Time entries, because their time goes with them
  await dialog.getByLabel("Customers", { exact: true }).check();
  await expect(dialog.getByLabel("Time entries")).toBeChecked();
  await expect(dialog.getByLabel("Time entries")).toBeDisabled();
  await dialog.getByLabel("Customers", { exact: true }).uncheck();
  await expect(dialog.getByLabel("Time entries")).toBeEnabled();

  await dialog.getByLabel("Time entries").check();
  await expect(go).toContainText("delete selected");
  await Promise.all([page.waitForEvent("download"), go.click()]);
  await expect.poll(entries).toBe(0);
  // the rest is untouched, and you are still signed in
  expect(((await (await page.request.get("/api/customers")).json()).data as unknown[]).length).toBeGreaterThan(0);
  expect(((await (await page.request.get("/api/billing-items?kind=other")).json()).data as any[]).some((i) => i.description === "keep me")).toBe(true);
  expect((await page.request.get("/api/auth/me")).ok()).toBe(true);
  const saved = (await (await page.request.get("/api/snapshots")).json()).data as { kind: string }[];
  expect(saved.some((s) => s.kind === "cleared")).toBe(true);

  // the API refuses an empty or unknown selection
  const bad = (parts: unknown) => page.request.post("/api/admin/clear", { data: { confirm: "DELETE DATA", password: "a-long-password", parts } });
  expect((await bad([])).status()).toBe(400);
  expect((await bad(["everything"])).status()).toBe(400);
});

test("admin 'Delete data' needs the phrase and password, and saves an export first", async ({ page }) => {
  // (runs after the test above: the app holds Pat Owner and one entry, nothing from the demo)
  const users = (await (await page.request.get("/api/auth/users")).json()).data.users as { id: string; name: string }[];
  const pat = users.find((u) => u.name === "Pat Owner")!;
  await page.request.post("/api/auth/login", { data: { userId: pat.id, password: "a-long-password" } });
  await page.request.post("/api/time-entries", { data: { userId: pat.id, date: "2026-11-24", durationMinutes: 60 } });
  await page.goto("/admin");
  await page.getByTestId("clear-all-open").click();
  const dialog = page.getByRole("dialog", { name: "Delete data" });
  const go = dialog.getByTestId("clear-all-confirm");
  await expect(go).toBeDisabled(); // needs both the phrase and a password

  await dialog.getByLabel("Type DELETE DATA to confirm").fill("delete everything");
  await dialog.getByLabel("Your admin password").fill("a-long-password");
  await expect(go).toBeDisabled(); // wrong phrase

  await dialog.getByLabel("Type DELETE DATA to confirm").fill("DELETE DATA");
  await dialog.getByLabel("Your admin password").fill("not-my-password");
  const [dl0] = await Promise.all([page.waitForEvent("download"), go.click()]);
  expect(dl0.suggestedFilename()).toMatch(/before_clearing.*\.json$/);
  await expect(dialog.getByRole("alert")).toContainText("Wrong password");
  // still there
  expect(((await (await page.request.get("/api/time-entries")).json()).data as unknown[]).length).toBeGreaterThan(0);

  await dialog.getByLabel("Your admin password").fill("a-long-password");
  const [dl] = await Promise.all([page.waitForEvent("download"), go.click()]);
  expect(dl.suggestedFilename()).toMatch(/before_clearing.*\.json$/);
  await expect(page.getByRole("heading", { name: "Create the first admin account" })).toBeVisible();

  // everything is gone, but the safety spreadsheet was kept
  const users2 = (await (await page.request.get("/api/auth/users")).json()).data;
  expect(users2.users).toHaveLength(0);
  await page.getByLabel("Your name").fill("Next Admin");
  await page.getByLabel("Email").fill("next@example.com");
  await page.getByLabel("Password", { exact: true }).fill("another-long-password");
  await page.getByRole("button", { name: /Create admin/ }).click();
  await expect(page.getByLabel("New entry hours")).toBeVisible();
  expect(((await (await page.request.get("/api/time-entries")).json()).data as unknown[]).length).toBe(0);
  const saved = (await (await page.request.get("/api/snapshots")).json()).data as { kind: string; fileName: string }[];
  expect(saved.some((s) => s.kind === "cleared" && /before_clearing/.test(s.fileName))).toBe(true);
});
