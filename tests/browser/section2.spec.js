import { test, expect } from "@playwright/test";

async function workspace(
  page,
  {
    role = "employee",
    configured = false,
    empty = false,
    failFirst = false,
  } = {},
) {
  const user = {
    id: "00000000-0000-0000-0000-000000000002",
    email: "alex@example.com",
    aud: "authenticated",
    role: "authenticated",
  };
  const profile = {
    id: 2,
    auth_user_id: user.id,
    name: "Alex",
    email: user.email,
    role,
  };
  const assignments = empty
    ? []
    : [
        {
          id: 1,
          title: "Prepare the client guide",
          description: "Create a welcome guide with an onboarding checklist.",
          employee_id: role === "manager" ? 3 : 2,
          team_id: null,
          due: "2026-10-05",
          status: "In progress",
        },
        {
          id: 2,
          title: "Team review",
          description: "Review the shared project plan.",
          employee_id: null,
          team_id: 1,
          due: "2026-10-08",
          status: "Open",
        },
      ];
  const feedback = [
    {
      id: 1,
      assignment_id: 1,
      parent_id: null,
      author_id: "manager",
      body: "Please include a checklist.",
      created: "2026-09-30T09:00:00Z",
    },
  ];
  const questions = [],
    writes = [],
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const sources = [
    {
      reference: "A1",
      label: "ASG-0001 — Prepare the client guide",
      text: "Create a welcome guide with an onboarding checklist.",
    },
    {
      reference: "F1",
      label: "Feedback · Manager",
      text: "Please include a checklist.",
    },
  ];
  await page.route("https://workroom-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let body,
      status = 200;
    if (url.pathname === "/auth/v1/token")
      body = {
        access_token: "section2-session",
        refresh_token: "section2-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      };
    else if (url.pathname === "/auth/v1/user") body = user;
    else if (url.pathname === "/auth/v1/logout") body = {};
    else if (url.pathname === "/functions/v1/analyze-assignment") {
      const input = request.postDataJSON();
      questions.push(input);
      if (role !== "manager") {
        status = 403;
        body = { error: "Manager access required." };
      } else if (input.question && failFirst) {
        failFirst = false;
        status = 503;
        body = { error: "AI could not be reached. Please try again." };
      } else
        body = {
          configured,
          sources,
          feedback_count: 1,
          assignment_id: input.assignment_id,
          ...(input.question && configured
            ? {
                answer:
                  "The checklist is still needed [F1]. Draft it next [A1]. <img src=x onerror=alert(1)>",
              }
            : {}),
        };
    } else if (url.pathname === "/rest/v1/rpc/feedback_authors")
      body = [{ auth_user_id: "manager", name: "Manager" }];
    else if (
      url.pathname === "/rest/v1/feedback" &&
      request.method() === "POST"
    ) {
      const input = request.postDataJSON();
      writes.push(input);
      feedback.push({
        id: feedback.length + 1,
        parent_id: null,
        created: "2026-09-30T10:00:00Z",
        ...input,
      });
      body = null;
    } else if (url.pathname === "/rest/v1/employees")
      body = url.searchParams.has("auth_user_id") ? profile : role === 'manager'
        ? [profile, { id: 3, auth_user_id: 'employee', name: 'Sara Ahmed', email: 'sara@example.com', role: 'employee' }, { id: 1, auth_user_id: 'manager', name: 'Manager', email: 'manager@example.com', role: 'manager' }]
        : [profile];
    else if (url.pathname === "/rest/v1/assignments") body = assignments;
    else if (url.pathname === "/rest/v1/feedback") body = empty ? [] : feedback;
    else if (url.pathname === "/rest/v1/teams")
      body = [{ id: 1, name: "Design" }];
    else if (url.pathname === "/rest/v1/members")
      body = [{ team_id: 1, employee_id: 2 }];
    else body = [];
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("preview-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "manager" ? "Assignments" : "My assignments",
      exact: true,
    }),
  ).toBeVisible();
  return { user, questions, writes, errors };
}

test("employee sees personal and team work, adds feedback and replies, without manager controls", async ({
  page,
}) => {
  const { user, questions, writes, errors } = await workspace(page);
  await expect(
    page.getByText("Prepare the client guide", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Team review", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Employees" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Teams" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New assignment" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    location.hash = "employees";
  });
  await expect(
    page.getByRole("heading", { name: "My assignments", exact: true }),
  ).toBeVisible();
  await page.getByText("Prepare the client guide", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Assignment brief" }),
  ).toBeVisible();
  await expect(page.getByText("Manager", { exact: true })).toBeVisible();
  await expect(page.locator("#status")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ask AI" })).toHaveCount(0);
  await page.getByLabel("Add feedback").fill("My draft is ready.");
  await page.getByRole("button", { name: "Post feedback" }).click();
  await expect(
    page.getByText("My draft is ready.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reply", exact: true })
    .first()
    .click();
  await page.getByLabel("Your reply").fill("The checklist is included.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("The checklist is included.", { exact: true }),
  ).toBeVisible();
  expect(writes[0]).toMatchObject({ assignment_id: 1, author_id: user.id });
  expect(writes[1]).toMatchObject({
    assignment_id: 1,
    parent_id: 1,
    author_id: user.id,
  });
  expect(questions).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Add feedback")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    location.hash = "assignment/999";
  });
  await expect(
    page.getByText("Assignment not found.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("employee empty state does not suggest creating assignments", async ({
  page,
}) => {
  await workspace(page, { empty: true });
  await expect(
    page.getByText("No assignments found.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Create one to get started.", { exact: false }),
  ).toHaveCount(0);
});

test("manager can inspect sources before Gemini is connected", async ({
  page,
}) => {
  const { questions, errors } = await workspace(page, { role: "manager" });
  await page.getByText("Prepare the client guide", { exact: true }).click();
  await expect(
    page.getByText("AI is not connected yet.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Your question")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Ask AI", exact: true }),
  ).toBeDisabled();
  await page
    .getByText("Sources: assignment + 1 feedback and replies", { exact: true })
    .click();
  await expect(page.locator(".analysis-source")).toHaveCount(2);
  await expect(page.locator(".analysis-result")).toBeEmpty();
  expect(questions).toEqual([{ assignment_id: 1 }]);
  expect(errors).toEqual([]);
});

test("manager asks about one assignment, recovers from errors, and gets safely rendered answers", async ({
  page,
}) => {
  const { questions, errors } = await workspace(page, {
    role: "manager",
    configured: true,
    failFirst: true,
  });
  await page.getByText("Prepare the client guide", { exact: true }).click();
  const question = page.getByLabel("Your question");
  await expect(question).toBeEnabled();
  await question.fill("What should happen next?");
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await expect(
    page.getByText("AI could not be reached. Please try again.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask AI", exact: true }).click();
  await expect(page.locator(".analysis-answer")).toContainText(
    "The checklist is still needed [F1]",
  );
  await expect(page.locator(".analysis-result img")).toHaveCount(0);
  expect(questions.at(-1)).toEqual({
    assignment_id: 1,
    question: "What should happen next?",
  });
  await page.locator("nav").getByRole("link", { name: "Assignments" }).click();
  await page.getByText("Team review", { exact: true }).click();
  await expect(page.getByLabel("Your question")).toBeEmpty();
  await expect(page.locator(".analysis-result")).toBeEmpty();
  expect(questions.at(-1)).toEqual({ assignment_id: 2 });
  expect(errors).toEqual([]);
});
