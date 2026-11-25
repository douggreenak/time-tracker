import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = "demo1234";

/** Signs in through the real API (cookie lands in the browser context). */
export async function loginAs(page: Page, name: string, path = "/engineer") {
  const users = await (await page.request.get("/api/auth/users")).json();
  const person = users.data.users.find((u: { name: string }) => u.name === name);
  expect(person, `demo user ${name}`).toBeTruthy();
  const res = await page.request.post("/api/auth/login", { data: { userId: person.id, password: DEMO_PASSWORD } });
  expect(res.ok()).toBeTruthy();
  await page.goto(path);
}

export const ENGINEER = "Jeff Green";
export const ACCOUNTANT = "Molly Green";
export const ADMIN = "Doug Green";

/** Older weeks start collapsed; open them all so sample rows are reachable. */
export async function expandAllWeeks(page: Page) {
  const btn = page.getByTestId("weeks-toggle-all");
  await expect(btn).toBeVisible();
  if (/expand/i.test((await btn.textContent()) ?? "")) await btn.click();
}

/** Picks an option from one of the app's own dropdowns (they aren't native <select>s). */
export async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("listbox", { name: label }).getByRole("option", { name: option }).first().click(); // string = substring match
}
