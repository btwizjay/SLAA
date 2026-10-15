import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test("staff review pages work with the current database schema", async ({ page }) => {
  for (const [path, heading] of [
    ["/admin/duplicates", "Possible duplicates"],
    ["/admin/coach-requests", "Coach requests"],
    ["/admin/confirmations", "Coach confirmations"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("admin ticks accounts on the members list and deletes them", async ({ page }) => {
  await page.goto("/admin?q=Bulk+Test");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);

  // no delete bar until something is ticked
  await expect(page.getByRole("button", { name: "Delete selected" })).toHaveCount(0);
  await page.getByLabel("Select all on this page").check();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByLabel("Select Bulk Test One").uncheck();
  await expect(page.getByText("1 selected")).toBeVisible();

  await page.getByLabel("Reason").fill("Test entry");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete selected" }).click();

  await expect(page.getByText("1 account was deleted.")).toBeVisible();
  await expect(page.getByText("Bulk Test Two")).toHaveCount(0);
  await expect(page.getByText("Bulk Test One")).toBeVisible();
});
