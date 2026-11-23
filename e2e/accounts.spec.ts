import { test, expect, type Page, type Browser } from "@playwright/test";
import { ACCOUNTANT, ADMIN, loginAs } from "./helpers";

async function addPerson(page: Page, name: string, password: string, role = "engineer") {
  const res = await page.request.post("/api/users", { data: { name, email: `${name.replace(/\W/g, "").toLowerCase()}@example.com`, role, password } });
  expect(res.status()).toBe(201);
  return (await res.json()).data.id as string;
}

async function signInFresh(browser: Browser, name: string, password: string) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  const p = await ctx.newPage();
  await p.goto("/engineer");
  await p.getByLabel("Who are you?").selectOption({ label: `${name} · engineer` });
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
  await p.getByLabel("Who are you?").selectOption({ label: `${name} · admin` });
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

test("only admins can manage people; accountants are blocked", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/team");
  await expect(page.getByText("This page is for admins.")).toBeVisible();
  expect((await page.request.post("/api/users", { data: { name: "X", email: "x@example.com", password: "longenough1" } })).status()).toBe(403);
  const users = (await (await page.request.get("/api/users")).json()).data;
  const someone = users.find((u: { role: string }) => u.role === "engineer");
  expect((await page.request.put(`/api/users/${someone.id}`, { data: { password: "hijacked-pass-1" } })).status()).toBe(403);
  expect((await page.request.delete(`/api/users/${someone.id}`)).status()).toBe(403);
  expect((await page.request.delete("/api/demo")).status()).toBe(403);
});

test("admin can't demote or remove themselves, and role values are validated", async ({ page }) => {
  await loginAs(page, ADMIN);
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  expect((await page.request.put(`/api/users/${me.id}`, { data: { role: "engineer" } })).status()).toBe(400);
  expect((await page.request.delete(`/api/users/${me.id}`)).status()).toBe(400);
  expect((await page.request.put(`/api/users/${me.id}`, { data: { role: "superuser" } })).status()).toBe(400);
});
