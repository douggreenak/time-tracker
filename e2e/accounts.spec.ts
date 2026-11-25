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

test("accountants can add people and change rates; only admins change roles, passwords or remove people", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/team");
  await expect(page.getByLabel("New person name")).toBeVisible();
  await expect(page.getByLabel(/Set password for/)).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: "Hours" })).toHaveCount(0);
  // Add someone (starting as an engineer; accountants can't create admins).
  const email = `acct${Date.now()}@example.com`;
  const made = await page.request.post("/api/users", { data: { name: "Added By Accountant", email, role: "engineer", password: "longenough1", defaultHourlyRate: 90 } });
  expect(made.status()).toBe(201);
  const id = (await made.json()).data.id;
  expect((await page.request.post("/api/users", { data: { name: "Sneaky Admin", email: `s${Date.now()}@example.com`, role: "admin", password: "longenough1" } })).status()).toBe(403);
  // Rate, name and email are theirs to change.
  const upd = await (await page.request.put(`/api/users/${id}`, { data: { defaultHourlyRate: 140, name: "Renamed Person", email: "NEW.Mail@Example.com" } })).json();
  expect(Number(upd.data.defaultHourlyRate)).toBe(140);
  expect(upd.data.email).toBe("new.mail@example.com");
  // ...but not roles, passwords or removal.
  expect((await page.request.put(`/api/users/${id}`, { data: { role: "admin" } })).status()).toBe(403);
  expect((await page.request.put(`/api/users/${id}`, { data: { password: "hijacked-pass-1" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/users/${id}`)).status()).toBe(403);
  expect((await page.request.delete("/api/demo")).status()).toBe(403);
  // The rate edit works in the UI too.
  await page.reload();
  const rate = page.locator("tr", { has: page.locator('input[value="Renamed Person"]') }).getByLabel("Rate");
  await rate.fill("150");
  await rate.press("Enter");
  await expect.poll(async () => Number((await (await page.request.get("/api/users")).json()).data.find((u: { id: string }) => u.id === id).defaultHourlyRate)).toBe(150);
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
  expect((await page.request.put(`/api/users/${me.id}`, { data: { defaultHourlyRate: 999 } })).status()).toBe(403);
  const others = (await (await page.request.get("/api/users")).json()).data.filter((u: { id: string }) => u.id !== me.id);
  expect((await page.request.put(`/api/users/${others[0].id}`, { data: { name: "Hacked" } })).status()).toBe(403);
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
  page.once("dialog", (d) => d.dismiss());
  await field.fill("replacement-pass-1");
  await field.press("Enter");
  await page.waitForTimeout(600);
  const { ctx, p } = await signInFresh(browser, name, "original-pass-1");
  await expect(p.getByLabel("New entry hours")).toBeVisible(); // still the old password
  await ctx.close();
  page.once("dialog", (d) => d.accept());
  await page.getByLabel(`Set password for ${name}`).fill("replacement-pass-1");
  await page.getByLabel(`Set password for ${name}`).press("Enter");
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
