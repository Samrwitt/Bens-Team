import { test, expect } from "@playwright/test";

test("manager signs in and uses Supabase-backed UI actions", async ({
  page,
}) => {
  const user = {
    id: "00000000-0000-0000-0000-000000000001",
    email: "manager@example.com",
    aud: "authenticated",
    role: "authenticated",
  };
  const profiles = [
    {
      id: 1,
      auth_user_id: user.id,
      name: "Manager",
      email: user.email,
      role: "manager",
    },
    {
      id: 2,
      auth_user_id: "00000000-0000-0000-0000-000000000002",
      name: "Employee",
      email: "employee@example.com",
      role: "employee",
    },
  ];
  const assignments = [
    {
      id: 1,
      title: "Welcome guide",
      description: "Prepare the guide",
      employee_id: 2,
      team_id: null,
      due: "2026-10-01",
      status: "Open",
    },
  ];
  const writes = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://workroom-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body;
    if (url.pathname === "/auth/v1/token")
      body = {
        access_token: "test-session-token",
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    else if (url.pathname === "/auth/v1/logout") body = {};
    else if (url.pathname === "/auth/v1/user") body = user;
    else if (url.pathname === "/functions/v1/analyze-assignment")
      body = {
        configured: false,
        assignment_id: 1,
        feedback_count: feedback.length,
        sources: [
          {
            reference: "A1",
            label: "Welcome guide",
            text: "Prepare the guide",
          },
        ],
      };
    else if (req.method() === "POST" || req.method() === "PATCH") {
      const data = req.postDataJSON();
      writes.push({ path: url.pathname, data });
      if (url.pathname === "/rest/v1/feedback")
        feedback.push({
          id: feedback.length + 1,
          parent_id: null,
          created: new Date().toISOString(),
          ...data,
        });
      if (url.pathname === "/rest/v1/assignments" && req.method() === "PATCH") {
        assignments[0].status = data.status;
        body = { id: 1 };
      } else body = url.pathname.includes("/functions/") ? { ok: true } : null;
    } else if (url.pathname === "/rest/v1/employees")
      body = url.searchParams.has("auth_user_id") ? profiles[0] : profiles;
    else if (url.pathname === "/rest/v1/assignments") body = assignments;
    else if (url.pathname === "/rest/v1/feedback") body = feedback;
    else body = [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  const feedback = [];
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("manager-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Assignments" }),
  ).toBeVisible();
  await page.getByLabel("Search assignments").fill("missing");
  await expect(
    page.getByText("No assignments found.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Search assignments").fill("ASG-0001");
  await page.getByText("Welcome guide", { exact: true }).click();
  await page.getByLabel("Add feedback").fill("Please review");
  await page.getByRole("button", { name: "Post feedback" }).click();
  await expect(page.getByText("Please review", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page.getByLabel("Your reply").fill("Follow-up");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Follow-up", { exact: true })).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("Done");
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("Done");
  await page.getByRole("link", { name: "Employees" }).click();
  await page.getByRole("button", { name: "Add employee" }).click();
  await page.getByLabel("Full name").fill("New employee");
  await page.getByLabel("Email / sign-in").fill("new@example.com");
  await page.getByLabel("Initial password").fill("new-password-123");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(
    writes.find((w) => w.path === "/functions/v1/manage-employee").data.action,
  ).toBe("create");
  expect(
    writes.filter((w) => w.path === "/rest/v1/feedback")[1].data.parent_id,
  ).toBe(1);
  await page.getByRole("button", { name: "Reset password" }).click();
  await page.getByLabel("New password").fill("replacement-password-123");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(
    writes.filter((w) => w.path === "/functions/v1/manage-employee").at(-1).data
      .action,
  ).toBe("reset-password");
  await page.getByRole("link", { name: "Teams" }).click();
  await page.getByRole("button", { name: "Create team" }).click();
  await page.getByLabel("Team name").fill("Design");
  await page.getByLabel("Employee", { exact: true }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(
    writes.find((w) => w.path === "/rest/v1/rpc/save_team").data,
  ).toMatchObject({ team_name: "Design", member_ids: [2] });
  await page.getByRole("link", { name: "Assignments" }).click();
  await page.getByLabel("Filter status").selectOption("Open");
  await expect(
    page.getByText("No assignments found.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Filter status").selectOption("Done");
  await expect(page.getByText("Welcome guide", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New assignment" }).click();
  await page.getByLabel("Assignment title").fill("Second assignment");
  await page.getByLabel("Brief", { exact: true }).fill("Write another guide");
  await page
    .getByLabel("Assign to", { exact: true })
    .selectOption("employee:2");
  await page.getByLabel("Due date").fill("2026-10-15");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  expect(
    writes.find((w) => w.path === "/rest/v1/assignments" && w.data.title).data,
  ).toMatchObject({
    title: "Second assignment",
    employee_id: 2,
    team_id: null,
  });
  await page.getByRole("button", { name: "New assignment" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(errors).toEqual([]);
});
