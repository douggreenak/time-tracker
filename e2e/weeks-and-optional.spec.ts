import { expect, test } from "@playwright/test";
import { ACCOUNTANT, ADMIN, ENGINEER, expandAllWeeks, loginAs } from "./helpers";

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

test.describe("submitting, week approval, locations and wording", () => {
  test("new time is a draft; engineer submits selected rows and a whole week; cannot self-approve", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const mk = (date: string, n: string) =>
      page.request.post("/api/time-entries", { data: { userId: "", date, durationMinutes: 30, notes: n } });
    const me = await (await page.request.get("/api/auth/me")).json().catch(() => null);
    const users = (await (await page.request.get("/api/auth/users")).json()).data.users;
    const uid = me?.data?.id ?? users.find((u: { name: string }) => u.name === ENGINEER).id;
    const post = async (date: string, n: string) =>
      (await (await page.request.post("/api/time-entries", { data: { userId: uid, date, durationMinutes: 30, notes: n, status: "approved" } })).json()).data;
    void mk;
    const a = await post("2026-03-02", "wk-a1");
    const b = await post("2026-03-03", "wk-a2");
    const c = await post("2026-03-09", "wk-b1");
    for (const e of [a, b, c]) expect(e.status).toBe("draft");
    const self = await page.request.put(`/api/time-entries/${a.id}`, { data: { status: "approved" } });
    expect((await self.json()).data.status).toBe("draft"); // approval is ignored for engineers

    await page.goto("/engineer");
    await expandAllWeeks(page);
    // Select one row and submit it.
    await page.getByLabel("Select 2026-03-09 entry to submit").check();
    await page.getByTestId("submit-selected").click();
    await expect(page.getByText(/Submitted the selected time/)).toBeVisible();
    expect((await (await page.request.get(`/api/time-entries/${c.id}`)).json()).data.status).toBe("submitted");
    expect((await (await page.request.get(`/api/time-entries/${a.id}`)).json()).data.status).toBe("draft");
    // Submit the whole week of Mar 1 – Mar 7.
    await page.getByRole("button", { name: /Submit week of Mar 1/ }).click();
    await expect(page.getByText(/Submitted the week of Mar 1/)).toBeVisible();
    for (const e of [a, b]) expect((await (await page.request.get(`/api/time-entries/${e.id}`)).json()).data.status).toBe("submitted");
  });

  test("accountant approves a whole week at once; drafts are not in the review", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const users = (await (await page.request.get("/api/auth/users")).json()).data.users;
    const uid = users.find((u: { name: string }) => u.name === ENGINEER).id;
    const mk = async (date: string, n: string, status: string) =>
      (await (await page.request.post("/api/time-entries", { data: { userId: uid, date, durationMinutes: 60, notes: n, status: "draft" } })).json()).data.id as string;
    const s1 = await mk("2026-02-02", "ap-1", "draft");
    const s2 = await mk("2026-02-03", "ap-2", "draft");
    const d1 = await mk("2026-02-04", "ap-draft", "draft");
    for (const id of [s1, s2]) await page.request.put(`/api/time-entries/${id}`, { data: { status: "submitted" } });
    await page.request.post("/api/auth/logout");

    await loginAs(page, ACCOUNTANT, "/accountant");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByText(/still a draft/)).toBeVisible();
    await page.getByRole("tab", { name: "By week" }).click();
    const week = page.locator('[data-week="2026-02-01"]');
    if ((await week.getByTestId("pay-week-toggle").getAttribute("aria-expanded")) === "false") await week.getByTestId("pay-week-toggle").click();
    await week.getByTestId("approve-whole-week").click();
    await expect(page.getByText(/Approved everyone/)).toBeVisible();
    const get = async (id: string) => (await (await page.request.get(`/api/time-entries/${id}`)).json()).data.status;
    expect(await get(s1)).toBe("approved");
    expect(await get(s2)).toBe("approved");
    expect(await get(d1)).toBe("draft"); // never submitted, never approved
  });

  test("Remote and Travel are gone from locations; headers say Billable; notes box has no Enter hint", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await page.getByLabel("New entry location").click();
    await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
    const opts = await page.getByRole("listbox").getByRole("option").allTextContents();
    expect(opts.join("|")).toMatch(/Office/);
    expect(opts.join("|")).toMatch(/On-site/);
    expect(opts.join("|")).not.toMatch(/Remote|Travel/);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("columnheader", { name: "Billable", exact: true })).toBeVisible();
    await expect(page.getByLabel("New entry notes")).toHaveAttribute("placeholder", "Notes");
  });

  test("QuickBooks .iif leaves out entries with no customer or task", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    const users = (await (await page.request.get("/api/users")).json()).data;
    const uid = users[0].id;
    const customers = (await (await page.request.get("/api/customers")).json()).data;
    const items = (await (await page.request.get("/api/service-items")).json()).data;
    const mk = async (extra: object, note: string) =>
      (await (await page.request.post("/api/time-entries", { data: { userId: uid, date: "2025-05-05", durationMinutes: 60, notes: note, status: "approved", ...extra } })).json()).data.id;
    await mk({ customerId: customers[0].id, serviceItemId: items[0].id }, "iif-complete");
    await mk({}, "iif-incomplete");
    const res = await page.request.get("/api/export/iif?startDate=2025-05-05&endDate=2025-05-05&status=approved");
    const text = await res.text();
    expect(text).toContain("iif-complete");
    expect(text).not.toContain("iif-incomplete");
    expect(res.headers()["x-skipped-entries"]).toBe("1");
    expect(text.split("\r\n")[0]).toBe("!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tNOTE\tBILLINGSTATUS");
  });
});

test.describe("Excel timesheet and data backup", () => {
  test("Excel timesheet needs a week, then fills the template", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const users = (await (await page.request.get("/api/auth/users")).json()).data.users;
    const uid = users.find((u: { name: string }) => u.name === ENGINEER).id;
    await page.request.post("/api/time-entries", { data: { userId: uid, date: "2026-04-14", durationMinutes: 90, notes: "xl-note" } });
    expect((await page.request.get("/api/export/excel")).status()).toBe(400); // no week picked
    expect((await page.request.get("/api/export/excel?week=2026-04-14")).status()).toBe(400); // not a Sunday
    const res = await page.request.get("/api/export/excel?week=2026-04-12");
    expect(res.status()).toBe(200);
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await res.body());
    expect(zip.file("xl/vbaProject.bin")).toBeTruthy(); // template macros kept
    const s1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(s1).toContain("xl-note");
    expect(s1).toContain("<v>1.5</v>");
    const s2 = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    expect(s2).toContain("PRIYA NAIR");
    // The UI: download stays disabled until a week is chosen.
    await page.goto("/engineer");
    await expect(page.getByLabel("Download Excel timesheet")).toHaveAttribute("aria-disabled", "true");
    await page.getByLabel("Excel timesheet week").selectOption({ index: 1 });
    await expect(page.getByLabel("Download Excel timesheet")).toHaveAttribute("aria-disabled", "false");
  });
});

test.describe("admin data export & import", () => {
  test("only admins; export then restore brings back deleted data; bad files are rejected", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/accountant");
    expect((await page.request.get("/api/admin/backup")).status()).toBe(403);
    await page.request.post("/api/auth/logout");

    await loginAs(page, ADMIN, "/team");
    await expect(page.getByTestId("backup-export")).toBeVisible();
    const users = (await (await page.request.get("/api/users")).json()).data;
    const uid = users[0].id;
    await page.request.post("/api/time-entries", { data: { userId: uid, date: "2025-06-06", durationMinutes: 75, notes: "backup-marker" } });
    const res = await page.request.get("/api/admin/backup");
    expect(res.status()).toBe(200);
    const backup = await res.json();
    expect(backup.format).toBe("timetrack-backup");
    const marker = backup.tables.timeEntries.find((e: { notes: string }) => e.notes === "backup-marker");
    expect(marker).toBeTruthy();

    // Remove the entry, then restore: it comes back.
    expect((await page.request.delete(`/api/time-entries/${marker.id}`)).ok()).toBeTruthy();
    expect((await page.request.get(`/api/time-entries/${marker.id}`)).status()).toBe(404);
    expect((await page.request.post("/api/admin/backup", { data: { backup } })).status()).toBe(400); // needs the typed confirmation
    expect((await page.request.post("/api/admin/backup", { data: { confirm: "RESTORE", backup: { format: "nope" } } })).status()).toBe(400);
    const noAdmin = { ...backup, tables: { ...backup.tables, users: backup.tables.users.map((u: object) => ({ ...u, role: "engineer" })) } };
    expect((await page.request.post("/api/admin/backup", { data: { confirm: "RESTORE", backup: noAdmin } })).status()).toBe(400);
    const ok = await page.request.post("/api/admin/backup", { data: { confirm: "RESTORE", backup } });
    expect(ok.status()).toBe(200);
    const back = (await (await page.request.get(`/api/time-entries/${marker.id}`)).json()).data;
    expect(back.notes).toBe("backup-marker");
    expect(back.durationMinutes).toBe(75);
    // Same people can still sign in (password hashes were restored).
    await page.request.post("/api/auth/logout");
    await loginAs(page, ENGINEER);
  });
});
