import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTANT, ENGINEER, expandAllWeeks, loginAs, pick } from "./helpers";

type Entry = {
  id: string; userName: string; customerId: string; customerName: string; jobId: string | null; jobName: string | null;
  serviceItemId: string; serviceItemName: string; date: string; durationMinutes: number; isBillable: boolean;
  locationType: string; status: string; flagged?: boolean; flagHistory?: { by: string; kind: string; text: string }[];
};
const api = async (page: Page): Promise<Entry[]> => (await (await page.request.get("/api/time-entries")).json()).data;
const hours = (m: number) => (m / 60).toFixed(2);

async function reviewAllTime(page: Page) {
  await loginAs(page, ACCOUNTANT, "/accountant");
  await page.getByRole("button", { name: "All time" }).click();
  await expect.poll(async () => page.locator("tbody tr").count()).toBeGreaterThan(3);
}

test.describe("flag notes: ask, withdraw, history", () => {
  test("withdrawing a question clears the flag, greys the button and keeps every note", async ({ page, browser }) => {
    // Accountant asks a question.
    await loginAs(page, ACCOUNTANT, "/accountant");
    const target = (await api(page)).filter((e) => e.userName === ENGINEER && e.status !== "draft").at(-1)!;
    const q = "flagtest: was this on site?";
    await page.request.put(`/api/time-entries/${target.id}`, { data: { status: "submitted", flagged: true, flagReason: `Accountant asks: ${q}` } });

    // Withdraw it from the Review page.
    await page.reload();
    await page.getByRole("button", { name: "All time" }).click();
    const row = page.locator("tr", { hasText: q });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Withdraw question" }).click();
    await expect(page.getByText(/the flag is cleared/)).toBeVisible();
    await expect(page.locator("tr", { hasText: q }).getByRole("button", { name: "Withdraw question" })).toHaveCount(0);

    // The server kept both notes.
    const after = (await api(page)).find((e) => e.id === target.id)!;
    expect(after.flagged).toBe(false);
    const tail = after.flagHistory!.slice(-2);
    expect(tail.map((h) => h.kind)).toEqual(["question", "withdrawn"]);
    expect(tail[0].text).toBe(q);
    expect(tail[0].by).toBe(ACCOUNTANT);

    // The engineer sees a grey flag button that opens the full record.
    const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
    const p2 = await ctx.newPage();
    await loginAs(p2, ENGINEER);
    await expandAllWeeks(p2);
    const grey = p2.getByTestId("flag-badge-resolved").first();
    await expect(grey).toBeVisible();
    await expect(grey).toHaveClass(/text-muted-foreground/);
    await expect(grey).not.toHaveClass(/text-destructive/);
    await grey.click();
    const notes = p2.getByTestId("flag-history");
    await expect(notes).toContainText(q);
    await expect(notes).toContainText("Question withdrawn");
    await expect(p2.getByTestId("flag-message")).toHaveCount(0);
    await ctx.close();
  });

  test("a new question after a withdrawal appends to the history", async ({ page }) => {
    await loginAs(page, ACCOUNTANT);
    const target = (await api(page)).filter((e) => e.userName === ENGINEER && e.status !== "draft").at(-1)!;
    for (const t of ["first", "second"]) {
      await page.request.put(`/api/time-entries/${target.id}`, { data: { status: "submitted", flagged: true, flagReason: `Accountant asks: ${t}` } });
      await page.request.put(`/api/time-entries/${target.id}`, { data: { flagged: false } });
    }
    const e = (await api(page)).find((x) => x.id === target.id)!;
    const mine = e.flagHistory!.filter((h) => ["first", "second"].includes(h.text) || h.kind === "withdrawn");
    expect(mine.length).toBeGreaterThanOrEqual(4);
    // Approving a flagged entry records that the flag was resolved.
    await page.request.put(`/api/time-entries/${target.id}`, { data: { status: "submitted", flagged: true, flagReason: "Accountant asks: third" } });
    await page.request.put(`/api/time-entries/${target.id}`, { data: { status: "approved" } });
    const done = (await api(page)).find((x) => x.id === target.id)!;
    expect(done.flagged).toBe(false);
    expect(done.flagHistory!.at(-1)!.kind).toBe("cleared");
  });

  test("engineers can't withdraw or add flags", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const mine = (await api(page))[0];
    const r = await (await page.request.put(`/api/time-entries/${mine.id}`, { data: { flagged: true, flagReason: "sneaky" } })).json();
    expect(r.data.flagged).toBeFalsy();
    expect(r.data.flagHistory.some((h: { text: string }) => h.text === "sneaky")).toBe(false);
  });
});

test.describe("accountant reports", () => {
  test("time per project matches the entries, with optional task + code breakdown", async ({ page }) => {
    await reviewAllTime(page);
    const entries = (await api(page)).filter((e) => e.status !== "draft");
    await page.getByRole("tab", { name: "By project" }).click();
    const groups = new Set(entries.map((e) => `${e.customerId}|${e.jobId ?? ""}`));
    await expect(page.getByTestId("project-row")).toHaveCount(groups.size);
    await expect(page.getByTestId("project-total")).toHaveText(hours(entries.reduce((s, e) => s + e.durationMinutes, 0)));
    // One specific project adds up.
    const sample = entries.find((e) => e.jobName)!;
    const minutes = entries.filter((e) => e.customerId === sample.customerId && e.jobId === sample.jobId).reduce((s, e) => s + e.durationMinutes, 0);
    const row = page.getByTestId("project-row").filter({ hasText: sample.jobName! }).filter({ hasText: sample.customerName });
    await expect(row.locator("td").nth(2)).toHaveText(hours(minutes));

    // Task breakdown (with the QuickBooks code).
    await page.getByLabel("Break down by task").check();
    const taskKeys = new Set(entries.map((e) => `${e.customerId}|${e.jobId ?? ""}|${e.serviceItemId}`));
    await expect(page.getByTestId("task-row")).toHaveCount(taskKeys.size);
    await expect(page.getByRole("columnheader", { name: "Code" })).toBeVisible();
    const items = (await (await page.request.get("/api/service-items")).json()).data as { name: string; qbItemName: string }[];
    const task = items.find((i) => entries.some((e) => e.serviceItemName === i.name))!;
    await expect(page.getByTestId("task-row").filter({ hasText: task.name }).first()).toContainText(task.qbItemName);
    await expect(page.getByTestId("project-total")).toHaveText(hours(entries.reduce((s, e) => s + e.durationMinutes, 0)));

    // It follows the filters above it.
    await pick(page, "Customer", sample.customerName);
    const only = entries.filter((e) => e.customerId === sample.customerId);
    await expect(page.getByTestId("project-total")).toHaveText(hours(only.reduce((s, e) => s + e.durationMinutes, 0)));
  });

  test("project report downloads as CSV", async ({ page }) => {
    await reviewAllTime(page);
    await page.getByRole("tab", { name: "By project" }).click();
    await page.getByLabel("Break down by task").check();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download project report as CSV" }).click()]);
    expect(dl.suggestedFilename()).toBe("time-by-project-and-task.csv");
    const text = (await (await import("node:fs/promises")).readFile((await dl.path())!, "utf8")).split("\r\n");
    expect(text[0]).toBe("Customer,Project,Task,Code,Hours,Billable hours,Entries");
    expect(text.length).toBeGreaterThan(3);
  });

  test("time per person per day / week / month adds up", async ({ page }) => {
    await reviewAllTime(page);
    const entries = (await api(page)).filter((e) => e.status !== "draft");
    await page.getByRole("tab", { name: "Person × time" }).click();
    const report = page.getByTestId("person-time-report");
    const people = new Set(entries.map((e) => e.userName));
    await expect(report.getByTestId("person-row")).toHaveCount(people.size);
    await expect(report.getByTestId("person-grand-total")).toHaveText(hours(entries.reduce((s, e) => s + e.durationMinutes, 0)));

    // Each person's total, in every grouping.
    for (const [label, cols] of [["By week", null], ["By month", null], ["By day", null]] as const) {
      await pick(page, "Group time by", label);
      for (const name of Array.from(people)) {
        const m = entries.filter((e) => e.userName === name).reduce((s, e) => s + e.durationMinutes, 0);
        await expect(report.getByTestId("person-row").filter({ hasText: name }).locator("td").last()).toHaveText(hours(m));
      }
      void cols;
    }
    // Monthly cell check for one person.
    await pick(page, "Group time by", "By month");
    const who = entries[0].userName;
    const month = entries[0].date.slice(0, 7);
    const monthMin = entries.filter((e) => e.userName === who && e.date.startsWith(month)).reduce((s, e) => s + e.durationMinutes, 0);
    await expect(report.getByTestId("person-row").filter({ hasText: who }).locator(`td[data-col="${month}"]`)).toHaveText(hours(monthMin));
    // And it follows the person filter.
    await pick(page, "Person", who);
    await expect(report.getByTestId("person-row")).toHaveCount(1);
    const dl = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download person report as CSV" }).click()]);
    expect(dl[0].suggestedFilename()).toBe("hours-per-person-by-month.csv");
  });

  test("engineers can use the reports for their own time only", async ({ page }) => {
    await loginAs(page, ENGINEER, "/accountant");
    await page.getByRole("button", { name: "All time" }).click();
    await page.getByRole("tab", { name: "Person × time" }).click();
    await expect(page.getByTestId("person-row")).toHaveCount(1);
    await expect(page.getByTestId("person-row")).toContainText(ENGINEER);
    await page.getByRole("tab", { name: "By project" }).click();
    await expect(page.getByTestId("project-row").first()).toBeVisible();
  });
});

test.describe("filters", () => {
  test("Review: project, task, billable and location filters each narrow the list correctly", async ({ page }) => {
    await reviewAllTime(page);
    const all = (await api(page)).filter((e) => e.status !== "draft");
    const rows = () => page.locator("tbody tr");
    await expect.poll(() => rows().count()).toBe(all.length);

    // Project
    const proj = all.find((e) => e.jobId)!;
    await pick(page, "Filter project", proj.jobName!);
    await expect.poll(() => rows().count()).toBe(all.filter((e) => e.jobId === proj.jobId).length);
    await page.getByRole("button", { name: /Clear filters/ }).click();
    await expect.poll(() => rows().count()).toBe(all.length);

    // Task
    const task = all.find((e) => e.serviceItemId)!;
    await pick(page, "Filter task", task.serviceItemName);
    await expect.poll(() => rows().count()).toBe(all.filter((e) => e.serviceItemId === task.serviceItemId).length);
    await page.getByRole("button", { name: /Clear filters/ }).click();

    // Billable / non-billable
    await pick(page, "Filter billable", "Billable only");
    await expect.poll(() => rows().count()).toBe(all.filter((e) => e.isBillable).length);
    await pick(page, "Filter billable", "Non-billable only");
    await expect.poll(() => rows().count()).toBe(all.filter((e) => !e.isBillable).length);
    await page.getByRole("button", { name: /Clear filters/ }).click();

    // Location
    const loc = all[0].locationType;
    await page.getByRole("combobox", { name: "Filter location" }).click();
    await page.getByRole("listbox", { name: "Filter location" }).getByRole("option").nth(1).click();
    const picked = (await page.getByRole("combobox", { name: "Filter location" }).textContent())!.trim();
    const wantType = picked === "On site" ? "on_site" : picked.toLowerCase();
    await expect.poll(() => rows().count()).toBe(all.filter((e) => e.locationType === wantType).length);
    expect(loc).toBeTruthy();
    await page.getByRole("button", { name: /Clear filters/ }).click();

    // Combined with person + search: the intersection.
    await pick(page, "Person", "Tomas Herrera");
    await pick(page, "Filter billable", "Billable only");
    await expect.poll(() => rows().count()).toBe(all.filter((e) => e.userName === "Tomas Herrera" && e.isBillable).length);
  });

  test("Review: choosing a customer limits the project choices to it", async ({ page }) => {
    await reviewAllTime(page);
    const all = (await api(page)).filter((e) => e.status !== "draft");
    const c = all.find((e) => e.jobId)!;
    await pick(page, "Customer", c.customerName);
    await page.getByRole("combobox", { name: "Filter project" }).click();
    await expect(page.getByRole("listbox", { name: "Filter project" }).getByRole("option").first()).toBeVisible();
    const shown = await page.getByRole("listbox", { name: "Filter project" }).getByRole("option").allTextContents();
    const want = new Set(all.filter((e) => e.customerId === c.customerId && e.jobName).map((e) => e.jobName));
    expect(shown.filter((s) => !/^All projects/.test(s)).map((s) => s.trim()).sort()).toEqual(Array.from(want).sort() as string[]);
  });

  test("Timesheet: status, customer, billable and date filters (and they combine)", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const mine = await api(page);
    await page.getByTestId("filters-toggle").click();
    const rows = () => page.getByLabel("Hours", { exact: true });

    await pick(page, "Filter status", "Approved");
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.status === "approved").length);
    await pick(page, "Filter status", "Any status");
    await expandAllWeeks(page); // with no filter, older weeks fold up again
    await expect.poll(() => rows().count()).toBe(mine.length);

    const c = mine.find((e) => e.customerId)!;
    await pick(page, "Filter customer", c.customerName);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.customerId === c.customerId).length);

    await pick(page, "Filter billable", "Non-billable only");
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.customerId === c.customerId && !e.isBillable).length);
    await page.getByRole("button", { name: /Clear filters/ }).click();
    await expandAllWeeks(page);
    await expect.poll(() => rows().count()).toBe(mine.length);

    // Date range
    const dates = mine.map((e) => e.date).sort();
    const mid = dates[Math.floor(dates.length / 2)];
    await page.getByLabel("Filter from date").fill(mid);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.date >= mid).length);
    await page.getByLabel("Filter to date").fill(mid);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.date === mid).length);
    await expect(page.getByTestId("filters-toggle")).toContainText("(2)");

    // Text search still stacks on top.
    await page.getByRole("button", { name: /Clear filters/ }).click();
    await page.getByLabel("Filter timesheet rows").fill(c.customerName);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.customerName.toLowerCase().includes(c.customerName.toLowerCase())).length);
  });

  test("Timesheet: project and task filters", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const mine = await api(page);
    await page.getByTestId("filters-toggle").click();
    const rows = () => page.getByLabel("Hours", { exact: true });
    const p = mine.find((e) => e.jobId)!;
    await pick(page, "Filter project", p.jobName!);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.jobId === p.jobId).length);
    await page.getByRole("button", { name: /Clear filters/ }).click();
    const t = mine.find((e) => e.serviceItemId)!;
    await pick(page, "Filter task", t.serviceItemName);
    await expect.poll(() => rows().count()).toBe(mine.filter((e) => e.serviceItemId === t.serviceItemId).length);
  });

  test("Tasks and Team pages filter by search, billing, usage and role", async ({ page }) => {
    await loginAs(page, ACCOUNTANT, "/tasks");
    const items = (await (await page.request.get("/api/service-items")).json()).data as { name: string; qbItemName: string; defaultBillable: boolean }[];
    const rows = () => page.getByLabel("Task name", { exact: true });
    await expect.poll(() => rows().count()).toBe(items.length);
    await page.getByLabel("Search tasks").fill(items[0].name.slice(0, 6));
    await expect.poll(() => rows().count()).toBe(items.filter((i) => `${i.name} ${i.qbItemName}`.toLowerCase().includes(items[0].name.slice(0, 6).toLowerCase())).length);
    await page.getByLabel("Search tasks").fill("");
    await pick(page, "Filter task billing", "Non-billable");
    await expect.poll(() => rows().count()).toBe(items.filter((i) => !i.defaultBillable).length);
    await pick(page, "Filter task billing", "Billable & not");
    await pick(page, "Filter task usage", "No time yet");
    const used = new Set((await api(page)).map((e) => e.serviceItemId));
    await expect.poll(() => rows().count()).toBe((await (await page.request.get("/api/service-items")).json()).data.filter((i: { id: string }) => !used.has(i.id)).length);

    await page.goto("/team");
    const users = (await (await page.request.get("/api/users")).json()).data as { name: string; email: string; role: string }[];
    const trs = () => page.locator("tbody tr");
    await expect.poll(() => trs().count()).toBe(users.length);
    await pick(page, "Filter role", "engineer");
    await expect.poll(() => trs().count()).toBe(users.filter((u) => u.role === "engineer").length);
    await pick(page, "Filter role", "All roles");
    await page.getByLabel("Search team").fill("okafor");
    await expect.poll(() => trs().count()).toBe(users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes("okafor")).length);
  });

  test("Team (admin view) filters too", async ({ page }) => {
    await loginAs(page, "Ingrid Solberg", "/team");
    const users = (await (await page.request.get("/api/users")).json()).data as { name: string; email: string; role: string }[];
    const names = () => page.getByLabel("Name", { exact: true });
    await expect.poll(() => names().count()).toBe(users.length);
    await pick(page, "Filter role", "accountant");
    await expect.poll(() => names().count()).toBe(users.filter((u) => u.role === "accountant").length);
  });
});

test.describe("look and feel", () => {
  test("expand-all-weeks uses an unfold / fold icon", async ({ page }) => {
    await loginAs(page, ENGINEER);
    const btn = page.getByTestId("weeks-toggle-all");
    await expect(btn).toBeVisible();
    const open = /expand/i.test((await btn.textContent()) ?? "");
    await expect(btn.locator(open ? "svg.lucide-unfold-vertical" : "svg.lucide-fold-vertical")).toHaveCount(1);
    await btn.click();
    await expect(btn.locator(open ? "svg.lucide-fold-vertical" : "svg.lucide-unfold-vertical")).toHaveCount(1);
  });

  test("loading shows the morphing loader", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await new Promise((r) => setTimeout(r, 5000));
      await route.continue();
    });
    await page.goto("/engineer");
    await expect(page.getByRole("status").filter({ hasText: "Loading TimeTrack" })).toBeVisible();
    const loader = page.locator(".m3-loader").first();
    await expect(loader).toBeVisible();
    // It really animates (a different shape a moment later).
    const radius = () => loader.evaluate((el) => getComputedStyle(el).borderRadius);
    const a = await radius();
    await page.waitForTimeout(700);
    expect(await radius()).not.toBe(a);
  });

  test("weeks, days and entries are shaded as three distinct levels", async ({ page }) => {
    await loginAs(page, ENGINEER);
    await expandAllWeeks(page);
    const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const week = await bg("tr.week-row > td");
    const day = await bg("tr.day-row > td");
    const entry = await bg("tr.entry-row");
    expect(new Set([week, day, entry]).size).toBe(3);
    expect(week).not.toBe("rgba(0, 0, 0, 0)");
    expect(day).not.toBe("rgba(0, 0, 0, 0)");
  });
});
