import { expect, test } from "@playwright/test";

test("recovers the existing SLAA ID when the registration response is lost", async ({ page }) => {
  const nic = "199415801234";
  await page.goto("/register/check");
  await page.getByLabel("NIC number").fill(nic);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your details" })).toBeVisible({ timeout: 45000 });
  await page.getByLabel("Full name", { exact: true }).fill("Recovery Test Person");
  await page.getByLabel("Name with initials").fill("R. T. Person");
  await page.getByLabel("District", { exact: true }).selectOption("Colombo");
  await page.getByLabel("Mobile number (athlete or guardian)").fill("0712345678");
  await page.getByLabel("School or club").fill("Recovery Test Club");
  await page.getByLabel("Event 1").selectOption("100m");
  await page.getByRole("button", { name: "I don't have a coach right now" }).click();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await page.getByRole("checkbox", { name: /agree/ }).check();

  let committedId = "";
  await page.route("**/api/register/athlete", async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    committedId = (await response.json()).slaaId;
    await route.abort("failed"); // Database committed; the browser receives no response.
  });
  await page.getByRole("button", { name: /Register and get my SLAA ID/ }).click();
  const recovery = page.getByRole("link", { name: "Check registration and recover my SLAA ID" });
  await expect(recovery).toBeVisible();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("Recovery Test Person");
  await recovery.click();
  await page.getByLabel("NIC number").fill(nic);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("already-registered")).toContainText(committedId);
});

test("can reload a failed CAPTCHA script without clearing the identity field", async ({ page }) => {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", route => route.abort());
  await page.goto("/register/check");
  await page.getByLabel("NIC number").fill("199215901234");
  await expect(page.getByText("The security check did not load. Check your connection and refresh the page.")).toBeVisible();
  await page.unroute("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  await page.getByRole("button", { name: "Reload security check" }).click();
  await expect(page.getByText("Security check complete.")).toBeVisible();
  await expect(page.getByLabel("NIC number")).toHaveValue("199215901234");
  // Widget fits a small phone and is above the sticky action bar.
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
