import { expect, test, type Page } from "@playwright/test";

async function checkIdentity(page: Page, nic: string) {
  await page.goto("/");
  await page.getByRole("link", { name: /Register as an Athlete/ }).click();
  await page.getByLabel("NIC number").fill(nic);
  await expect(page.getByTestId("nic-decoded")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("there is no way to register as a coach", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Coach/ })).toHaveCount(0);
  const res = await page.goto("/register/coach");
  expect(res?.status()).toBe(404);
});

test("a registered person's NIC (other format) lands on 'already registered'", async ({ page }) => {
  await checkIdentity(page, "781231234V"); // seeded coach 197812301234
  await expect(page.getByTestId("already-registered")).toBeVisible();
  await expect(page.getByText("S. P*****")).toBeVisible();
  await expect(page.getByText("Colombo")).toBeVisible();
});

test("athlete registers with a listed coach and a past coach", async ({ page }) => {
  await checkIdentity(page, "201015501234"); // 2010, male, under 18
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Tharindu Lakshan Wijesinghe");
  await page.getByLabel("Name with initials").fill("T. L. Wijesinghe");
  await page.getByLabel("District", { exact: true }).selectOption("Colombo");
  await page.getByLabel("Mobile number (athlete or guardian)").fill("0712345678");
  await page.getByLabel("School or club").fill("Royal College");
  await page.getByRole("button", { name: "400 metres", exact: true }).click();

  // under 18, so the guardian section appears
  await expect(page.getByRole("heading", { name: "Parent or guardian" })).toBeVisible();
  await page.getByLabel("Guardian's full name").fill("Lakshman Wijesinghe");
  await page.getByLabel("Relationship to athlete").fill("Father");
  await page.getByLabel("Guardian's mobile number").fill("0779998887");

  // current coach
  await page.getByLabel("Search coaches").fill("perera");
  await page.getByRole("option", { name: /S\. K\. Perera/ }).click();
  // past coach
  await page.getByLabel("Search coaches").fill("fernando");
  await page.getByRole("option", { name: /D\. C\. Fernando/ }).click();
  const second = page.getByTestId("coach-link").nth(1);
  await second.getByLabel("Past coach").check();
  await second.getByLabel("From year").fill("2019");
  await second.getByLabel("To year").fill("2022");

  for (const box of await page.getByRole("checkbox", { name: /agree/ }).all()) await box.check();
  await page.getByRole("button", { name: /Register and get my SLAA ID/ }).click();

  await expect(page.getByTestId("slaa-id")).toHaveText(/^A\d{2}-\d{6}-\d$/);
  await expect(page.getByText(/coaches you listed must confirm/)).toBeVisible();
  // no horizontal scroll at phone width
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
