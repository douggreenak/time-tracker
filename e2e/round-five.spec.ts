import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTANT, ADMIN, ENGINEER, loginAs, pick } from "./helpers";

type Entry = { id: string; userId: string; userName: string; status: string; date: string; durationMinutes: number; isBillable: boolean; notes: string; dismissedIssues?: string[]; customerId: string; serviceItemId: string };
const api = async (page: Page): Promise<Entry[]> => (await (await page.request.get("/api/time-entries")).json()).data;
const me = async (page: Page) => (await (await page.request.get("/api/auth/me")).json()).data;

test.describe("access & errors", () => {
  test("an engineer on an admin-only page sees 'Something went wrong' with a way back", async ({ page }) => {
    await loginAs(page, ENGINEER, "/admin");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Backup" })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to timesheet" }).click();
    await expect(page).toHaveURL(/\/engineer$/);
    await expect(page.getByLabel("New entry hours")).toBeVisible();
  });

  test("unknown pages get the same friendly screen", async ({ page }) => {
    await loginAs(page, ENGINEER, "/definitely-not-a-page");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to timesheet" })).toBeVisible();
  });

  test("the data page works for admins and has a styled file button", async ({ page }) => {
    await loginAs(page, ADMIN, "/admin");
    await expect(page.getByRole("heading", { name: "Backup", exact: true })).toBeVisible();
    const choose = page.getByTestId("backup-choose");
    await expect(choose).toBeVisible();
    // The ugly native file input is hidden; the button opens the chooser.
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), choose.click()]);
    expect(chooser.isMultiple()).toBe(false);
    await expect(page.getByLabel("Backup file")).toHaveClass(/sr-only/);
  });
});

test.describe("PWA", () => {
  test("manifest, icons, service worker and offline page are served", async ({ page }) => {
    const m = await page.request.get("/manifest.webmanifest");
    expect(m.status()).toBe(200);
    const manifest = await m.json();
    expect(manifest.name).toBe("TimeTrack");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/engineer");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) {
      const r = await page.request.get(icon.src);
      expect(r.status()).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
    const sw = await page.request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(await sw.text()).toContain("fetch");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    expect((await page.request.get("/offline.html")).status()).toBe(200);
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});

test.describe("review page", () => {
  test("accountants and admins can approve their own time (engineers can't)", async ({ page }) => {
    await loginAs(page, ACCOUNTANT);
    const mine = await me(page);
    const made = await (await page.request.post("/api/time-entries", { data: { userId: mine.id, date: "2026-02-10", durationMinutes: 90, notes: "own-time-marker" } })).json();
    expect(made.data.status).toBe("draft");
    await page.goto("/accountant");
    const row = page.locator("tr", { hasText: "own-time-marker" });
    await expect(row).toBeVisible(); // their own drafts are reviewable
    await row.getByRole("button", { name: "Approve" }).click();
    await expect.poll(async () => (await api(page)).find((e) => e.id === made.data.id)?.status).toBe("approved");
    // The same entry is untouchable by an engineer.
    await page.request.post("/api/auth/logout");
    await loginAs(page, ENGINEER);
    expect((await page.request.put(`/api/time-entries/${made.data.id}`, { data: { status: "approved" } })).status()).toBe(403);
  });

  test("submitted time is never silently hidden: chips show what's active, a notice counts what's hidden, Clear all restores it", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    // Default view is all time, so nothing submitted is hidden.
    await expect(page.getByTestId("hidden-submitted")).toHaveCount(0);
    const submitted = (await api(page)).filter((e) => e.status === "submitted");
    expect(submitted.length).toBeGreaterThan(0);
    await pick(page, "Person", "Tomas Herrera");
    const others = submitted.filter((e) => e.userName !== "Tomas Herrera").length;
    if (others) await expect(page.getByTestId("hidden-submitted")).toContainText(String(others));
    const chips = page.getByTestId("active-filters");
    await expect(chips).toContainText("Tomas Herrera");
    await pick(page, "Period", "Last month");
    await expect(chips).toContainText("Last month");
    await page.getByRole("button", { name: "Remove filter Last month" }).click();
    await expect(chips).not.toContainText("Last month");
    await page.getByTestId("clear-all-filters").click();
    await expect(page.getByTestId("active-filters")).toHaveCount(0);
    await expect(page.getByTestId("hidden-submitted")).toHaveCount(0);
    await expect.poll(() => page.locator("tbody tr").count()).toBe((await api(page)).filter((e) => e.status !== "draft").length);
  });

  test("a check can be dismissed for one entry, and brought back", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    // A Saturday entry reliably triggers the "Weekend" check.
    const all = await api(page);
    const target = all.find((e) => e.status === "submitted" && e.userName !== ACCOUNTANT && new Date(`${e.date}T00:00:00`).getDay() % 6 === 0);
    expect(target, "a weekend submitted entry in the sample data").toBeTruthy();
    const row = page.locator("tr", { has: page.getByLabel(new RegExp(`Dismiss Weekend for ${target!.userName} ${target!.date}`)) });
    const countBefore = Number((await page.getByRole("button", { name: /^Weekend work/ }).locator("span").textContent()) ?? "0");
    await page.getByLabel(`Dismiss Weekend for ${target!.userName} ${target!.date}`).click();
    await expect(page.getByLabel(`Restore Weekend for ${target!.userName} ${target!.date}`)).toBeVisible();
    // Saved on the server, only for that entry.
    expect((await api(page)).find((e) => e.id === target!.id)!.dismissedIssues).toContain("weekend");
    const others = (await api(page)).filter((e) => e.id !== target!.id && (e.dismissedIssues ?? []).includes("weekend"));
    expect(others.length).toBe(0);
    // The "worth a second look" count drops by one.
    if (countBefore > 1) await expect(page.getByRole("button", { name: /^Weekend work/ }).locator("span")).toHaveText(String(countBefore - 1));
    else await expect(page.getByRole("button", { name: /^Weekend work/ })).toHaveCount(0);
    // It survives a reload, then comes back on request.
    await page.reload();
    await expect(page.getByLabel(`Restore Weekend for ${target!.userName} ${target!.date}`)).toBeVisible();
    await page.getByLabel(`Restore Weekend for ${target!.userName} ${target!.date}`).click();
    await expect(page.getByLabel(`Dismiss Weekend for ${target!.userName} ${target!.date}`)).toBeVisible();
    expect((await api(page)).find((e) => e.id === target!.id)!.dismissedIssues).not.toContain("weekend");
    void row;
  });

  test("engineers can't dismiss checks through the API", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const mine = (await api(page))[0];
    const r = await (await page.request.put(`/api/time-entries/${mine.id}`, { data: { dismissedIssues: ["weekend"] } })).json();
    expect(r.data.dismissedIssues ?? []).toEqual([]);
  });

  test("printing produces a clean report instead of the screen", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(3);
    await expect(page.getByTestId("print-sheet")).toHaveCount(0); // not in the page until printing
    await pick(page, "Person", "Tomas Herrera");
    await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
    await page.emulateMedia({ media: "print" });
    const sheet = page.getByTestId("print-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Time review");
    await expect(sheet).toContainText("Filters: Tomas Herrera");
    await expect(sheet.getByRole("columnheader", { name: "Hours" }).first()).toBeVisible();
    await expect(sheet).not.toContainText("Callum Brooks");
    // Everything else on screen is gone from the printout.
    await expect(page.getByRole("tab", { name: "By project" })).toBeHidden();
    await expect(page.getByTestId("export-iif")).toBeHidden();
    await expect(page.locator("header")).toBeHidden();
    const entries = (await api(page)).filter((e) => e.userName === "Tomas Herrera" && e.status !== "draft");
    await expect(sheet.locator("table.print-table").last().locator("tbody tr")).toHaveCount(entries.length);
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.getByTestId("print-sheet")).toHaveCount(0);
  });
});

test.describe("tasks, team and loading", () => {
  test("task rows have no hours or billable columns", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/tasks");
    await expect(page.getByLabel("Task name", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Billable|Hours/ })).toHaveCount(0);
    await expect(page.getByLabel("New item billable")).toHaveCount(0);
    // New tasks still default to billable for timesheet entries.
    await page.getByLabel("New task name").fill(`Default billable ${Date.now()}`);
    await page.getByLabel("New task name").press("Enter");
    const items = (await (await page.request.get("/api/service-items")).json()).data;
    expect(items.at(-1).defaultBillable).toBe(true);
  });

  test("pages show a loading spinner, not an empty state, while data loads", async ({ page }) => {
    await loginAs(page, ACCOUNTANT);
    let slow = true;
    for (const api of ["**/api/customers", "**/api/service-items", "**/api/users", "**/api/time-entries**"]) {
      await page.route(api, async (route) => {
        if (slow) await new Promise((r) => setTimeout(r, 1500));
        await route.fallback();
      });
    }
    for (const [path, label] of [["/customers", "Loading customers"], ["/tasks", "Loading tasks"], ["/team", "Loading team"]] as const) {
      slow = true;
      await page.goto(path);
      await expect(page.getByRole("status").filter({ hasText: label })).toBeVisible();
      await expect(page.getByText(/Add a customer to get started|No one yet/)).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: label })).toHaveCount(0, { timeout: 8000 });
    }
    slow = true;
    // Timesheet and review too.
    await page.goto("/engineer");
    await expect(page.getByRole("status").filter({ hasText: "Loading your timesheet" })).toBeVisible();
    await expect(page.getByText("No time logged yet")).toHaveCount(0);
    await page.goto("/accountant");
    await expect(page.getByRole("status").filter({ hasText: "Loading entries" })).toBeVisible();
  });
});

test.describe("Enter submits", () => {
  test("Enter in a stand-alone box commits it and leaves the box", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    const search = page.getByLabel("Search entries");
    await search.fill("tomas");
    await search.press("Enter");
    await expect(search).not.toBeFocused();
    await expect(page.getByTestId("active-filters")).toContainText("tomas");
    // Settings-like boxes: team rate cell, account details.
    await page.goto("/team");
    const rate = page.getByLabel("Rate", { exact: true }).first();
    await rate.click();
    await rate.press("Enter");
    await expect(rate).not.toBeFocused();
    await page.goto("/account");
    const name = page.getByLabel("Your name");
    await name.fill("Marguerite O. Okafor");
    await name.press("Enter"); // inside a form: submits it
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.getByLabel("Your name").fill("Marguerite Okafor");
    await page.getByLabel("Your name").press("Enter");
    await expect(page.getByText("Saved.")).toBeVisible();
  });

  test("Enter on the new-row boxes still adds the row", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/customers");
    const name = `Enter Co ${Date.now()}`;
    await page.getByLabel("New customer name").fill(name);
    await page.getByLabel("New customer name").press("Enter");
    await expect(page.getByRole("option", { name: new RegExp(name) })).toBeVisible();
  });
});

test.describe("login flow", () => {
  test("pick a name, the password box is focused, Enter signs in", async ({ page }) => {
    await page.goto("/engineer");
    await expect(page.getByRole("combobox", { name: "Who are you?" })).toBeFocused();
    await pick(page, "Who are you?", ENGINEER);
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.keyboard.type("demo1234");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("New entry hours")).toBeVisible();
  });
});
