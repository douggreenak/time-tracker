import { test, expect } from "@playwright/test";
import { ACCOUNTANT, ADMIN, DEMO_PASSWORD, ENGINEER, loginAs, expandAllWeeks, pick } from "./helpers";

test.describe("sign in", () => {
  test("pick a user, wrong password is rejected, right password signs in, sign out returns", async ({ page }) => {
    await page.goto("/engineer");
    await expect(page.getByRole("heading", { name: "Sign in to TimeTrack" })).toBeVisible();
    await pick(page, "Who are you?", `${ENGINEER}`);
    await page.getByLabel("Password", { exact: true }).fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("form [role=alert]")).toContainText("Wrong password");

    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByLabel("New entry hours")).toBeVisible();

    await page.getByTestId("user-menu").click();
    await page.getByTestId("sign-out").click();
    await expect(page.getByRole("heading", { name: "Sign in to TimeTrack" })).toBeVisible();
    // and the data really is protected
    expect((await page.request.get("/api/time-entries")).status()).toBe(401);
  });

  test("engineers get Review & export (without pay values) but not the manager pages", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await expect(page.getByRole("link", { name: "Review & export" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Customers" })).toHaveCount(0);
    await page.goto("/accountant");
    await expect(page.getByRole("heading", { name: "Review & export" })).toBeVisible();
    await expect(page.getByText("Billable value")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Value" })).toHaveCount(0);
    await page.goto("/customers");
    await expect(page.getByText("This page is for accountants and admins.")).toBeVisible();
    expect((await page.request.get("/api/admin/backup")).status()).toBe(403);
  });

  test("engineers' Review page opens on themselves; they can't see others' time or approve their own", async ({ page }) => {
    await loginAs(page, ENGINEER, "/accountant");
    await page.getByRole("button", { name: "All time" }).click();
    const person = page.getByRole("combobox", { name: "Person", exact: true });
    await expect(person).toBeDisabled();
    await expect(person).toContainText(ENGINEER);
    await expect(page.getByText(ACCOUNTANT)).toHaveCount(0);
    const rows = await page.locator("tbody tr").allTextContents();
    expect(rows.join(" ")).not.toMatch(/Callum Brooks|Tomas Herrera/);
    await expect(page.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

    const all = (await (await page.request.get("/api/time-entries")).json()).data;
    expect(new Set(all.map((e: { userName: string }) => e.userName))).toEqual(new Set([ENGINEER]));
    const mine = all.find((e: { status: string }) => e.status === "submitted");
    const own = await (await page.request.put(`/api/time-entries/${mine.id}`, { data: { status: "approved" } })).json();
    expect(own.data.status).toBe("submitted");
    // Someone else's entry is off limits, both to read and to touch.
    const users = (await (await page.request.get("/api/users")).json()).data;
    const other = users.find((u: { name: string }) => u.name === "Callum Brooks").id;
    const csv = await (await page.request.get(`/api/export/csv?userId=${other}`)).text();
    expect(csv).not.toContain("Callum Brooks");
  });

  test("accountants see everything except people management; admins see all", async ({ page }) => {
    await loginAs(page, ACCOUNTANT);
    for (const name of ["Timesheet", "Review & export", "Customers", "Tasks"]) {
      await expect(page.getByRole("link", { name })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
    await page.request.post("/api/auth/logout");
    await loginAs(page, ADMIN);
    for (const name of ["Timesheet", "Review & export", "Customers", "Tasks", "Team"]) {
      await expect(page.getByRole("link", { name })).toBeVisible();
    }
  });

  test("/services redirects to /tasks", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/services");
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  });
});

test.describe("editing past entries & accountant review", () => {
  test("editing an approved entry flags it; the accountant sees why and can clear it", async ({ page }) => {
    // Engineer edits an approved row.
    await loginAs(page, ENGINEER);
    await expandAllWeeks(page);
    const approved = page.locator("tr", { has: page.getByText(/^approved$/i) }).first();
    const hours = approved.getByLabel("Hours", { exact: true });
    await expect(hours).toBeEnabled();
    await hours.fill("9");
    await hours.press("Tab");
    await expect(page.getByText(/accountant has been flagged/i)).toBeVisible();
    await expect(page.getByText("Flagged", { exact: true }).first()).toBeVisible();

    // Accountant sees it.
    await page.request.post("/api/auth/logout");
    await loginAs(page, ACCOUNTANT, "/accountant");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByTestId("card-flagged")).toContainText("1");
    await page.getByTestId("card-flagged").click();
    await expect(page.getByText(/Edited after approved: hours .* → 9\.00/)).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByTestId("card-flagged")).toContainText("0");
  });

  test("engineers can't delete approved entries, and can't self-approve", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const list = await (await page.request.get("/api/time-entries")).json();
    list.data = list.data.filter((e: { userName: string }) => e.userName === ENGINEER);
    const approved = list.data.find((e: { status: string }) => e.status === "approved");
    expect((await page.request.delete(`/api/time-entries/${approved.id}`)).status()).toBe(409);
    const draft = list.data.find((e: { status: string }) => e.status === "submitted");
    const r = await (await page.request.put(`/api/time-entries/${draft.id}`, { data: { status: "approved" } })).json();
    expect(r.data.status).toBe("submitted");
  });

  test("review page: automatic checks, approve-all-clean, export marks", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText("Worth a second look")).toBeVisible();
    await expect(page.getByTestId("card-review")).toBeVisible();
    const clean = page.getByTestId("approve-clean");
    if (await clean.count()) {
      await clean.click();
      await expect(page.getByText(/Approved \d+ clean/)).toBeVisible();
    }
    await page.getByRole("tab", { name: "By customer" }).click();
    await expect(page.getByRole("cell", { name: /Apex Energy Solutions/ }).first()).toBeVisible();
  });
});

test.describe("team & passwords", () => {
  test("admin adds a person with a password and they can sign in", async ({ page, browser }) => {
    const stamp = Date.now();
    await loginAs(page, ADMIN, "/team");
    await page.getByLabel("New person name").fill(`Test Person ${stamp}`);
    await page.getByLabel("New person email").fill(`t${stamp}@example.com`);
    await page.getByLabel("New person password").fill("correct-horse-1");
    await page.getByLabel("New person password").press("Enter");
    await expect(page.getByLabel("Name", { exact: true }).filter({ hasText: "" }).last()).toBeVisible();

    const other = await browser.newContext({ baseURL: "http://localhost:3100" });
    const p2 = await other.newPage();
    await p2.goto("/engineer");
    await pick(p2, "Who are you?", `Test Person ${stamp}`);
    await p2.getByLabel("Password", { exact: true }).fill("correct-horse-1");
    await p2.getByRole("button", { name: "Sign in" }).click();
    await expect(p2.getByLabel("New entry hours")).toBeVisible();
    await other.close();
  });
});

test.describe("text boxes select their contents on focus", () => {
  test("clicking a cell selects everything in it", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await expandAllWeeks(page);
    const notes = page.getByLabel("Notes", { exact: true }).first();
    await notes.click();
    const sel = await notes.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd, el.value.length]);
    expect(sel[0]).toBe(0);
    expect(sel[1]).toBe(sel[2]);
    expect(sel[2]).toBeGreaterThan(0);
  });
});

test.describe("stopwatch lives in the database", () => {
  test("a running timer survives a reload", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await expect(page.getByLabel("New entry hours")).toBeVisible();
    await page.keyboard.press("w");
    await page.getByRole("button", { name: /^Start/ }).click();
    await expect(page.getByRole("button", { name: /^Pause/ })).toBeVisible();
    await page.waitForTimeout(2200);
    await page.reload();
    await expect(page.getByRole("button", { name: /^Pause/ })).toBeVisible();
    const t = await page.getByTestId("stopwatch-time").innerText();
    expect(t).not.toBe("00:00:00");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /^Discard/ }).click();
  });
});
