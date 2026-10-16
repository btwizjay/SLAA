import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 900 } });

test("staff review pages work with the current database schema", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/admin/duplicates", "Possible duplicates"],
    ["/admin/coach-requests", "Coach requests"],
    ["/admin/confirmations", "Coach confirmations"],
    ["/admin/overview", "Register overview"],
    ["/admin/verification", "Verification & calls"],
    ["/admin/coaches", "Add and import coaches"],
    ["/admin/audit", "Audit log"],
    ["/admin/exports", "Exports"],
    ["/admin/staff", "Staff accounts"],
    ["/admin/account", "Your account"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", {
        name: heading === "Audit log" ? /^Audit log \(\d+\)$/ : heading,
        exact: true,
      }),
    ).toBeVisible();
  }
});

test("staff can correct a coach profile and see the audited change", async ({
  page,
}) => {
  await page.goto("/admin?type=coach&q=Saman");
  await page.locator("tbody a").first().click();
  await page
    .getByText("Edit member details and events", { exact: true })
    .click();
  await page.getByLabel("Mobile number", { exact: true }).fill("0772223333");
  await page
    .getByLabel("Reason for correction")
    .fill("Phone confirmed by coach");
  await page.getByRole("button", { name: "Save member changes" }).click();
  await expect(page.getByText(/Member details saved/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("+94772223333", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("edit_profile", { exact: true })).toBeVisible();
});

test("staff can preview and import a coach CSV, then export the filtered result", async ({
  page,
}) => {
  await page.goto("/admin/coaches");
  const importer = page
    .getByRole("heading", { name: "Import coach CSV" })
    .locator("..");
  await importer.getByLabel("Coach CSV file").setInputFiles({
    name: "coaches.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "full_name,nic,district,events\nBrowser CSV Coach,196512300987,Kandy,100m;200m\n",
    ),
  });
  await importer.getByRole("button", { name: "Preview CSV" }).click();
  await expect(
    importer.getByRole("cell", { name: "Browser CSV Coach", exact: true }),
  ).toBeVisible();
  await importer
    .getByLabel("Source or reason")
    .fill("Reviewed browser test source");
  await importer.getByLabel(/These coaches authorized/).check();
  await importer.getByRole("button", { name: "Import reviewed CSV" }).click();
  await expect(
    importer.getByText(/Import complete: 1 new coaches/),
  ).toBeVisible();
  await page.goto("/admin?type=coach&q=Browser+CSV");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  const href = await page
    .getByRole("link", { name: "Export filtered CSV" })
    .getAttribute("href");
  const csv = await (await page.request.get(href!)).text();
  expect(csv).toContain("Browser CSV Coach");
  expect(csv).not.toContain("Saman Kumara Perera");
});

test("owner can create a staff account that requires a password change", async ({
  page,
}) => {
  await page.goto("/admin/staff");
  const creator = page
    .getByRole("heading", { name: "Add staff account" })
    .locator("..");
  await creator.getByLabel("Staff email").fill("browser-staff@example.com");
  await creator
    .getByLabel("Temporary password", { exact: true })
    .fill("Browser-Test-Password-12345");
  await creator.getByRole("button", { name: "Create staff account" }).click();
  await expect(creator.getByText(/Staff account created/)).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByRole("heading", {
      name: "browser-staff@example.com",
      exact: true,
    }),
  ).toBeVisible();
});

test("admin ticks accounts on the members list and deletes them", async ({
  page,
}) => {
  await page.goto("/admin?q=Bulk+Test");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);

  // no delete bar until something is ticked
  await expect(
    page.getByRole("button", { name: "Delete selected" }),
  ).toHaveCount(0);
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
