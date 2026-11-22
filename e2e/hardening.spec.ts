import { test, expect } from "@playwright/test";
import { ACCOUNTANT, ENGINEER, loginAs } from "./helpers";

async function base(page: import("@playwright/test").Page) {
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  const dir = (await (await page.request.get("/api/customers")).json()).data;
  const tasks = (await (await page.request.get("/api/service-items")).json()).data;
  return { userId: me.id, customerId: dir[0].id, serviceItemId: tasks[0].id };
}

test("health endpoint reports the database", async ({ request }) => {
  const j = await (await request.get("/api/health")).json();
  expect(j.ok).toBe(true);
});

test("engineers can't create pre-approved entries and bad input is rejected", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  const ok = await page.request.post("/api/time-entries", { data: { ...b, date: "2026-01-05", durationMinutes: 60, status: "approved" } });
  expect((await ok.json()).data.status).toBe("submitted");

  for (const bad of [
    { date: "2026-13-40", durationMinutes: 60 },
    { date: "yesterday", durationMinutes: 60 },
    { date: "2026-01-05", durationMinutes: -5 },
    { date: "2026-01-05", durationMinutes: 99999 },
    { date: "2026-01-05", durationMinutes: "abc" },
  ]) {
    const r = await page.request.post("/api/time-entries", { data: { ...b, ...bad } });
    expect(r.status(), JSON.stringify(bad)).toBe(400);
  }
  const id = (await ok.json()).data.id;
  expect((await page.request.put(`/api/time-entries/${id}`, { data: { durationMinutes: 0 } })).status()).toBe(400);
  expect((await page.request.put(`/api/time-entries/${id}`, { data: { customerId: "nope" } })).status()).toBe(400);
});

test("CSV export: engineers get only their own time, and formulas are defused", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  await page.request.post("/api/time-entries", { data: { ...b, date: "2026-01-06", durationMinutes: 30, notes: "=HYPERLINK(\"http://x\")" } });
  const res = await page.request.get("/api/export/csv?userId=someone-else");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("'=HYPERLINK");
  expect(text).not.toMatch(/"=HYPERLINK/);
  expect(text).not.toContain("Sarah Jenkins");
});

test("accountant can send an entry back with a note the engineer sees", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  const id = (await (await page.request.post("/api/time-entries", { data: { ...b, date: "2026-01-07", durationMinutes: 45, notes: "query-me" } })).json()).data.id;
  await page.request.post("/api/auth/logout");

  await loginAs(page, ACCOUNTANT, "/accountant");
  await page.getByRole("button", { name: "All time" }).click();
  const row = page.getByRole("row").filter({ hasText: "query-me" });
  await row.getByRole("button", { name: "Query" }).click();
  await page.getByLabel("Question for the engineer").fill("Was this on site?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Sent back with your note")).toBeVisible();
  await page.request.post("/api/auth/logout");

  await loginAs(page, ENGINEER);
  const e = (await (await page.request.get(`/api/time-entries/${id}`)).json()).data;
  expect(e.flagged).toBe(true);
  expect(e.flagReason).toContain("Was this on site?");
});
