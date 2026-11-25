import { test, expect, type Page, type Browser } from "@playwright/test";
import { ACCOUNTANT, ADMIN, ENGINEER, loginAs, pick } from "./helpers";

async function addPerson(page: Page, name: string, password: string, role = "engineer") {
  const res = await page.request.post("/api/users", { data: { name, email: `${name.replace(/\W/g, "").toLowerCase()}@example.com`, role, password } });
  expect(res.status()).toBe(201);
  return (await res.json()).data.id as string;
}

async function signInFresh(browser: Browser, name: string, password: string) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const p = await ctx.newPage();
  await p.goto("/engineer");
  await pick(p, "Who are you?", `${name}`);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Sign in" }).click();
  return { ctx, p };
}

test("anyone can change their own password from the Account page", async ({ page, browser }) => {
  const name = `Pw Tester ${Date.now()}`;
  await loginAs(page, ADMIN);
  await addPerson(page, name, "starting-pass-1");
  await page.request.post("/api/auth/logout");

  const { ctx, p } = await signInFresh(browser, name, "starting-pass-1");
  await expect(p.getByLabel("New entry hours")).toBeVisible();
  await p.getByTestId("user-menu").click();
  await p.getByTestId("account-link").click();
  await expect(p.getByRole("heading", { name: "Account" })).toBeVisible();

  // wrong current password, mismatched repeat, too short — all rejected with a clear message
  await p.getByLabel("Current password").fill("not-it");
  await p.getByLabel("New password", { exact: true }).fill("brand-new-pass-2");
  await p.getByLabel("Repeat new password").fill("brand-new-pass-2");
  await p.getByRole("button", { name: "Save new password" }).click();
  await expect(p.locator("main form [role=alert]")).toContainText("current password is wrong");
  await p.getByLabel("Repeat new password").fill("different");
  await p.getByRole("button", { name: "Save new password" }).click();
  await expect(p.locator("main form [role=alert]")).toContainText("don't match");

  await p.getByLabel("Current password").fill("starting-pass-1");
  await p.getByLabel("Repeat new password").fill("brand-new-pass-2");
  await p.getByRole("button", { name: "Save new password" }).click();
  await expect(p.locator("main form [role=alert]")).toContainText("Password changed");
  await ctx.close();

  // old password no longer works, new one does
  const old = await signInFresh(browser, name, "starting-pass-1");
  await expect(old.p.locator("form [role=alert]")).toContainText("Wrong password");
  await old.ctx.close();
  const fresh = await signInFresh(browser, name, "brand-new-pass-2");
  await expect(fresh.p.getByLabel("New entry hours")).toBeVisible();
  await fresh.ctx.close();
});

test("admin can reset anyone's password with a one-time temporary password", async ({ page, browser }) => {
  const name = `Reset Me ${Date.now()}`;
  await loginAs(page, ADMIN, "/team");
  await addPerson(page, name, "forgotten-pass-1");
  await page.reload();
  page.once("dialog", async (d) => {
    expect(d.message()).toMatch(/Are you sure/);
    await d.accept();
  });
  await page.getByRole("button", { name: `Generate a temporary password for ${name}` }).click();
  const temp = (await page.getByTestId("temp-password").textContent())!.trim();
  expect(temp.length).toBeGreaterThanOrEqual(10);

  const { ctx, p } = await signInFresh(browser, name, temp);
  await expect(p.getByLabel("New entry hours")).toBeVisible();
  await ctx.close();
});

test("admin can change their own password too", async ({ page, browser }) => {
  const name = `Second Admin ${Date.now()}`;
  await loginAs(page, ADMIN);
  const id = await addPerson(page, name, "admin-pass-one-1", "admin");
  expect(id).toBeTruthy();
  await page.request.post("/api/auth/logout");

  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const p = await ctx.newPage();
  await p.goto("/engineer");
  await pick(p, "Who are you?", `${name}`);
  await p.getByLabel("Password", { exact: true }).fill("admin-pass-one-1");
  await p.getByRole("button", { name: "Sign in" }).click();
  await expect(p.getByTestId("user-menu")).toBeVisible(); // signed in before we navigate away
  await p.goto("/account");
  await p.getByLabel("Current password").fill("admin-pass-one-1");
  await p.getByLabel("New password", { exact: true }).fill("admin-pass-two-2");
  await p.getByLabel("Repeat new password").fill("admin-pass-two-2");
  await p.getByRole("button", { name: "Save new password" }).click();
  await expect(p.locator("main form [role=alert]")).toContainText("Password changed");
  await ctx.close();
});

test("anyone can add and remove people and change rates; only admins change roles, passwords or remove admins", async ({ page }) => {
  await loginAs(page, ENGINEER, "/team");
  await expect(page.getByLabel("New person name")).toBeVisible(); // engineers get the full Team table
  await expect(page.getByLabel(/Set password for/)).toHaveCount(0); // ...but not password controls
  const email = `eng${Date.now()}@example.com`;
  const made = await page.request.post("/api/users", { data: { name: "Added By Engineer", email, role: "engineer", password: "longenough1", defaultHourlyRate: 90 } });
  expect(made.status()).toBe(201);
  const id = (await made.json()).data.id;
  expect((await page.request.post("/api/users", { data: { name: "Sneaky Admin", email: `s${Date.now()}@example.com`, role: "admin", password: "longenough1" } })).status()).toBe(403);
  const upd = await (await page.request.put(`/api/users/${id}`, { data: { defaultHourlyRate: 140, name: "Renamed Person", email: "NEW.Mail@Example.com" } })).json();
  expect(Number(upd.data.defaultHourlyRate)).toBe(140);
  expect(upd.data.email).toBe("new.mail@example.com");
  expect((await page.request.put(`/api/users/${id}`, { data: { role: "admin" } })).status()).toBe(403);
  expect((await page.request.put(`/api/users/${id}`, { data: { password: "hijacked-pass-1" } })).status()).toBe(403);
  expect((await page.request.delete("/api/demo")).status()).toBe(403);
  // the rate edit works in the UI, and nothing saves until Save is pressed
  await page.reload();
  const row = page.locator("tr", { has: page.locator('input[value="Renamed Person"]') });
  await row.getByLabel("Rate").fill("150");
  await row.getByLabel("Rate").press("Enter");
  await row.getByLabel("Rate").blur();
  await page.waitForTimeout(500);
  expect(Number((await (await page.request.get("/api/users")).json()).data.find((u: { id: string }) => u.id === id).defaultHourlyRate)).toBe(140); // no autosave
  await expect(row.getByRole("button", { name: /^Save / })).toBeEnabled();
  await row.getByRole("button", { name: /^Save / }).click();
  await page.getByTestId("rate-confirm").click();
  await expect.poll(async () => Number((await (await page.request.get("/api/users")).json()).data.find((u: { id: string }) => u.id === id).defaultHourlyRate)).toBe(150);
  // removing: people can be removed from the table; admins only by admins; never yourself
  page.once("dialog", (d) => d.accept());
  await page.locator("tr", { has: page.locator('input[value="Renamed Person"]') }).getByRole("button", { name: /^Remove / }).click();
  await expect.poll(async () => ((await (await page.request.get("/api/users")).json()).data as { id: string }[]).some((u) => u.id === id)).toBe(false);
  const users = (await (await page.request.get("/api/users")).json()).data as { id: string; role: string }[];
  expect((await page.request.delete(`/api/users/${users.find((u) => u.role === "admin")!.id}`)).status()).toBe(403);
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  expect((await page.request.delete(`/api/users/${me.id}`)).status()).toBe(400);
});

test("a rate change asks whether it is retroactive or only from today on", async ({ page }) => {
  await loginAs(page, ADMIN, "/team");
  const name = `Rate Person ${Date.now()}`;
  const made = await (await page.request.post("/api/users", { data: { name, email: `rate${Date.now()}@example.com`, password: "longenough1", defaultHourlyRate: 100 } })).json();
  const id = made.data.id as string;
  const cust = ((await (await page.request.get("/api/customers")).json()).data as { id: string; name: string }[]).find((c) => c.name === "HARBOR WTP")!;
  const e = await page.request.post("/api/time-entries", { data: { userId: id, customerId: cust.id, date: "2026-01-12", durationMinutes: 120, notes: "old work" } });
  expect(e.status()).toBe(201);
  const lineRate = async () => {
    const inv = (await (await page.request.post("/api/billing/preview", { data: { from: "2026-01-12", to: "2026-01-12", includeInvoiced: true, customers: [{ id: cust.id, parts: [] }] } })).json()).data[0];
    return (inv.lines as { personnel: string; rate: number }[]).find((l) => l.personnel === name.toUpperCase())!.rate;
  };
  expect(await lineRate()).toBe(100);

  await page.reload();
  const row = () => page.locator("tr", { has: page.locator(`input[value="${name}"]`) });
  // 1) from today on only: the January entry keeps $100
  await row().getByLabel("Rate", { exact: true }).fill("180");
  await row().getByRole("button", { name: /^Save / }).click();
  const dialog = page.getByRole("dialog", { name: "Change billing rate" });
  await expect(dialog).toContainText("Are you sure?");
  await expect(dialog).toContainText("$100");
  await expect(dialog).toContainText("$180");
  await dialog.getByLabel("From today on only").check();
  await dialog.getByTestId("rate-confirm").click();
  await expect.poll(async () => Number((await (await page.request.get("/api/users")).json()).data.find((u: { id: string }) => u.id === id).defaultHourlyRate)).toBe(180);
  expect(await lineRate()).toBe(100);
  // 2) cancelling changes nothing
  await row().getByLabel("Rate", { exact: true }).fill("200");
  await row().getByRole("button", { name: /^Save / }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(Number((await (await page.request.get("/api/users")).json()).data.find((u: { id: string }) => u.id === id).defaultHourlyRate)).toBe(180);
  // 3) retroactive: everything is re-priced
  await row().getByRole("button", { name: /^Save / }).click();
  await dialog.getByLabel(/^Retroactive/).check();
  await dialog.getByTestId("rate-confirm").click();
  await expect.poll(lineRate).toBe(200);
});

test("light/dark mode: the toggle can be removed in favour of always light or always dark", async ({ page }) => {
  await loginAs(page, ENGINEER, "/team");
  const toggle = page.getByRole("button", { name: /Switch to (light|dark) mode/ });
  await expect(toggle).toBeVisible();
  await page.getByRole("radio", { name: "Always dark" }).click();
  await expect(toggle).toHaveCount(0);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(toggle).toHaveCount(0);
  await page.getByRole("radio", { name: "Always light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Show the toggle" }).click();
  await expect(toggle).toBeVisible();
});

test("everyone can edit their own name and email, but not their role", async ({ page }) => {
  await loginAs(page, ENGINEER, "/account");
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  await page.getByLabel("Your name").fill("Priya N. Nair");
  await page.getByLabel("Your email").fill("Priya.Nair@Engineering.com");
  await page.getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const after = (await (await page.request.get("/api/auth/me")).json()).data;
  expect(after.name).toBe("Priya N. Nair");
  expect(after.email).toBe("priya.nair@engineering.com");
  expect(after.role).toBe("engineer");
  expect((await page.request.put(`/api/users/${me.id}`, { data: { role: "admin" } })).status()).toBe(403);
  // put it back
  await page.request.put(`/api/users/${me.id}`, { data: { name: me.name, email: me.email } });
});

test("the show-password eye sits inside the password box", async ({ page }) => {
  await loginAs(page, ENGINEER, "/account");
  const input = page.getByLabel("New password", { exact: true });
  const eye = page.getByRole("button", { name: "Show passwords" }).nth(1); // the New password box's own eye
  const [ib, eb] = await Promise.all([input.boundingBox(), eye.boundingBox()]);
  expect(eb!.x).toBeGreaterThan(ib!.x);
  expect(eb!.x + eb!.width).toBeLessThanOrEqual(ib!.x + ib!.width + 1);
  expect(eb!.y).toBeGreaterThanOrEqual(ib!.y - 1);
  expect(eb!.y + eb!.height).toBeLessThanOrEqual(ib!.y + ib!.height + 1);
  await eye.click();
  await expect(input).toHaveAttribute("type", "text");
});

test("overwriting a password asks first; saying no changes nothing", async ({ page, browser }) => {
  const name = `Confirm Me ${Date.now()}`;
  await loginAs(page, ADMIN, "/team");
  await addPerson(page, name, "original-pass-1");
  await page.reload();
  const field = page.getByLabel(`Set password for ${name}`);
  await field.fill("replacement-pass-1");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: `Save password for ${name}` }).click();
  await page.waitForTimeout(600);
  const { ctx, p } = await signInFresh(browser, name, "original-pass-1");
  await expect(p.getByLabel("New entry hours")).toBeVisible(); // still the old password
  await ctx.close();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Save password for ${name}` }).click();
  await expect(page.getByLabel(`Set password for ${name}`)).toHaveAttribute("placeholder", /updated/);
});

test("admin can't demote or remove themselves, and role values are validated", async ({ page }) => {
  await loginAs(page, ADMIN);
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  expect((await page.request.put(`/api/users/${me.id}`, { data: { role: "engineer" } })).status()).toBe(400);
  expect((await page.request.delete(`/api/users/${me.id}`)).status()).toBe(400);
  expect((await page.request.put(`/api/users/${me.id}`, { data: { role: "superuser" } })).status()).toBe(400);
});

test("passwords only need 4 characters", async ({ page }) => {
  await loginAs(page, ADMIN);
  const mk = (pw: string, n: string) => page.request.post("/api/users", { data: { name: `Short ${n}`, email: `short${n}${Date.now()}@example.com`, password: pw } });
  expect((await mk("abc", "a")).status()).toBe(400);
  expect((await mk("abcd", "b")).status()).toBe(201);
});
