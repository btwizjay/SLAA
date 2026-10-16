import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
test("university caller can follow up and approve assigned applicants with restricted access", async ({
  page,
  context,
}) => {
  const state = JSON.parse(readFileSync("tests/e2e/.staff-state.json", "utf8"));
  await page.goto("/admin/verification/" + state.cases[0]);
  await page
    .getByRole("combobox", { name: "Assign to", exact: true })
    .selectOption(state.callerId);
  await page
    .getByLabel("Assignment reason")
    .fill("Assign applicant to university caller");
  await page
    .getByRole("button", { name: "Save assignment", exact: true })
    .click();
  await expect(
    page.getByText("Assigned 1 applicant.", { exact: true }),
  ).toBeVisible();
  await context.addCookies([
    {
      name: "slaa_admin",
      value: state.token,
      url: "http://localhost:3100",
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
  await page.goto("/admin/verification");
  await expect(
    page.getByRole("link", { name: /University Call Applicant/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Other Caller Applicant/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Staff", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Exports", exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/admin/export")).status()).toBe(401);
  expect(
    (await page.request.get("/admin/verification/" + state.cases[1])).status(),
  ).toBe(404);
  await page.getByRole("link", { name: /University Call Applicant/ }).click();
  await expect(
    page.getByRole("link", { name: "Call +94712345678", exact: true }),
  ).toBeVisible();
  expect(await page.content()).not.toContain("199512309999");
  await page
    .getByRole("combobox", { name: "Call outcome", exact: true })
    .selectOption("callback");
  await page.getByLabel("Who did you speak with?").selectOption("applicant");
  await page
    .getByLabel("Call notes", { exact: true })
    .fill("Applicant requested a callback to confirm coaching details");
  await page
    .getByLabel("Callback date and time (Sri Lanka time)")
    .fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16));
  await page
    .getByRole("button", { name: "Save call outcome", exact: true })
    .click();
  await expect(
    page.getByText("Call saved and follow-up status updated.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Applicant requested a callback to confirm coaching details",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Call outcome", exact: true })
    .selectOption("confirmed");
  await page
    .getByLabel("Call notes", { exact: true })
    .fill(
      "Callback complete. Identity, contact and athletics details confirmed",
    );
  for (const label of [
    "Name, identity and date of birth confirmed",
    "Contact details confirmed",
    "School / club, events and coaching information confirmed",
    "I spoke with the applicant or the required guardian",
    "Give final approval and mark this applicant verified",
  ])
    await page.getByLabel(label, { exact: true }).check();
  await page
    .getByRole("button", { name: "Save call outcome", exact: true })
    .click();
  await expect(
    page.getByText(/Verified by university-caller@example.com/),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Record verification call",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByText(/Final approval recorded/)).toBeVisible();
});
