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

export const ENGINEER = "Doug Mitchell";
export const ACCOUNTANT = "Sarah Jenkins";
