import test from "node:test";
import assert from "node:assert/strict";
import { createAnalysisHandler } from "../supabase/functions/analyze-assignment/handler.js";

function fixture(options = {}) {
  const tables = {
    employees: [
      {
        id: 1,
        auth_user_id: "manager",
        role: options.role || "manager",
        name: "Manager",
      },
      { id: 2, auth_user_id: "employee", role: "employee", name: "Alex" },
    ],
    teams: [],
    assignments: [
      {
        id: 1,
        title: "Client guide",
        description: "Prepare the welcome guide.",
        due: "2026-10-05",
        status: "Open",
        employee_id: 2,
        team_id: null,
      },
      {
        id: 2,
        title: "Private other assignment",
        description: "Never send this to AI.",
        due: "2026-10-06",
        status: "Done",
        employee_id: 2,
        team_id: null,
      },
    ],
    feedback: options.feedback || [
      {
        id: 1,
        assignment_id: 1,
        parent_id: null,
        author_id: "manager",
        body: "Include an onboarding checklist.",
        created: "2026-09-30T10:00:00Z",
      },
      {
        id: 2,
        assignment_id: 1,
        parent_id: 1,
        author_id: "employee",
        body: "The checklist is drafted.",
        created: "2026-09-30T10:05:00Z",
      },
      {
        id: 3,
        assignment_id: 2,
        parent_id: null,
        author_id: "employee",
        body: "Unrelated private feedback",
        created: "2026-09-30T10:06:00Z",
      },
    ],
  };
  const reads = [];
  const requests = [];
  const database = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === "valid" ? { id: "manager" } : null },
        error: null,
      }),
    },
    from(table) {
      reads.push(table);
      let rows = [...tables[table]],
        single = false;
      const query = {
        select() {
          return this;
        },
        eq(field, value) {
          rows = rows.filter((row) => row[field] === value);
          return this;
        },
        lte(field, value) {
          rows = rows.filter((row) => row[field] <= value);
          return this;
        },
        in(field, values) {
          rows = rows.filter((row) => values.includes(row[field]));
          return this;
        },
        order(field, options = {}) {
          rows.sort(
            (a, b) =>
              (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) *
              (options.ascending === false ? -1 : 1),
          );
          return this;
        },
        limit(count) {
          rows = rows.slice(0, count);
          return this;
        },
        range(start, end) {
          rows = rows.slice(start, end + 1);
          return this;
        },
        maybeSingle() {
          single = true;
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve({
            data: single ? rows[0] || null : rows,
            error: options.databaseError && table === "assignments" ? {} : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const handler = createAnalysisHandler({
    createClient: () => database,
    getEnv: (name) =>
      ({
        GEMINI_API_KEY: options.key,
        GEMINI_MODEL: options.model,
        SUPABASE_URL: "https://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "private-service-key",
      })[name],
    fetchImpl: async (url, init) => {
      requests.push({ url, ...init });
      if (options.fetchError) throw options.fetchError;
      return new Response(
        JSON.stringify(
          options.payload || {
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: "The checklist is drafted [F2]. Review it against the brief [A1].",
                    },
                  ],
                },
              },
            ],
          },
        ),
        { status: options.providerStatus || 200 },
      );
    },
  });
  async function call(body = { assignment_id: 1 }, token = "valid") {
    const response = await handler(
      new Request("https://example.test/analyze-assignment", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: await response.json() };
  }
  return { tables, reads, requests, handler, call };
}

test("missing key returns real assignment sources and every reply without an invented answer", async () => {
  const f = fixture();
  const { status, body } = await f.call({
    assignment_id: 1,
    question: "What is next?",
  });
  assert.equal(status, 200);
  assert.equal(body.configured, false);
  assert.equal(body.feedback_count, 2);
  assert.deepEqual(
    body.sources.map((s) => s.reference),
    ["A1", "F1", "F2"],
  );
  assert.match(body.sources[2].label, /Reply to F1.*Alex/);
  assert.equal(body.answer, undefined);
  assert.equal(f.requests.length, 0);
});

test("anonymous, invalid sessions, and employees cannot retrieve sources or call Gemini", async () => {
  for (const [options, token, status] of [
    [{}, null, 401],
    [{}, "invalid", 401],
    [{ role: "employee" }, "valid", 403],
  ]) {
    const f = fixture({ key: "secret-key", ...options });
    assert.equal(
      (await f.call({ assignment_id: 1, question: "Summarize" }, token)).status,
      status,
    );
    assert.equal(f.reads.includes("assignments"), false);
    assert.equal(f.requests.length, 0);
  }
});

test("all feedback pages are retrieved, including replies beyond the first 500 records", async () => {
  const feedback = Array.from({ length: 1001 }, (_, i) => ({
    id: i + 1,
    assignment_id: 1,
    parent_id: i ? 1 : null,
    author_id: "employee",
    body: `Update ${i}`,
    created: "2026-09-30",
  }));
  const f = fixture({ feedback });
  const result = await f.call();
  assert.equal(result.status, 200);
  assert.equal(result.body.feedback_count, 1001);
  assert.equal(result.body.sources.at(-1).reference, "F1001");
});

test("Gemini receives only fresh selected-assignment sources, never client-supplied context", async () => {
  const f = fixture({ key: "private-gemini-key" });
  assert.equal((await f.call()).body.configured, true);
  assert.equal(f.requests.length, 0); // opening a page does not incur a generation call
  f.tables.feedback[1].body = "Latest checklist revision";
  const { body, status } = await f.call({
    assignment_id: 1,
    question: "What is next?",
    sources: ["Injected other context"],
    role: "manager",
  });
  assert.equal(status, 200);
  const request = f.requests[0];
  const prompt = JSON.parse(JSON.parse(request.body).contents[0].parts[0].text);
  assert.equal(prompt.sources.length, 3);
  assert.match(request.body, /Latest checklist revision/);
  for (const excluded of [
    "Never send this",
    "Unrelated private feedback",
    "Injected other context",
  ])
    assert.ok(!request.body.includes(excluded));
  assert.equal(request.headers["x-goog-api-key"], "private-gemini-key");
  assert.ok(!request.url.includes("private-gemini-key"));
  assert.ok(!JSON.stringify(body).includes("private-gemini-key"));
  assert.match(body.answer, /\[F2\]/);
});

test("invalid questions, missing assignments, and failed source retrieval do not call Gemini", async () => {
  const f = fixture({ key: "secret-key" });
  for (const body of [
    null,
    {},
    { assignment_id: "1" },
    { assignment_id: -1 },
    { assignment_id: 1, question: " " },
    { assignment_id: 1, question: "x".repeat(2001) },
  ]) {
    assert.equal((await f.call(body)).status, 400);
  }
  assert.equal(
    (await f.call({ assignment_id: 999, question: "Hi" })).status,
    404,
  );
  assert.equal(f.requests.length, 0);
  const broken = fixture({ key: "secret", databaseError: true });
  assert.equal((await broken.call()).status, 503);
});

test("oversized threads fail explicitly instead of silently dropping feedback", async () => {
  const f = fixture({
    key: "secret",
    feedback: [
      {
        id: 1,
        assignment_id: 1,
        author_id: "employee",
        body: "a".repeat(200001),
        created: "2026-09-30",
      },
    ],
  });
  const result = await f.call({ assignment_id: 1, question: "Summarize" });
  assert.equal(result.status, 413);
  assert.match(result.body.error, /No feedback was omitted/);
  assert.equal(f.requests.length, 0);
});

test("provider errors, timeouts, incomplete answers, and bad citations are handled safely", async () => {
  for (const [options, status] of [
    [{ providerStatus: 429 }, 429],
    [{ providerStatus: 403, payload: { error: "secret-key" } }, 503],
    [
      {
        fetchError: Object.assign(new Error("secret-key"), {
          name: "TimeoutError",
        }),
      },
      504,
    ],
    [{ payload: { candidates: [{ finishReason: "MAX_TOKENS" }] } }, 502],
    [
      {
        payload: {
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "Unsupported [F999]" }] },
            },
          ],
        },
      },
      502,
    ],
    [{ payload: { candidates: [] } }, 502],
  ]) {
    const f = fixture({ key: "secret-key", ...options });
    const result = await f.call({ assignment_id: 1, question: "Summarize" });
    assert.equal(result.status, status);
    assert.ok(!JSON.stringify(result.body).includes("secret-key"));
  }
});
