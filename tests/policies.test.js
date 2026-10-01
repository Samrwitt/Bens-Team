import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

test(
  "PostgreSQL enforces workspace authorization and reply integrity",
  { timeout: 60000 },
  async () => {
    const name = `workroom-policy-${process.pid}`;
    const docker = (...args) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    docker(
      "run",
      "-d",
      "--name",
      name,
      "--network",
      "none",
      "-e",
      "POSTGRES_PASSWORD=disposable-test-only",
      "postgres:16-alpine",
    );
    try {
      let ready = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        try {
          docker(
            "exec",
            name,
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            "postgres",
          );
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      assert.ok(ready, "Postgres did not start");
      const sql = [
        "tests/bootstrap.sql",
        ...readdirSync("supabase/migrations")
          .filter((name) => name.endsWith(".sql"))
          .sort()
          .map((name) => "supabase/migrations/" + name),
        "tests/policies.sql",
      ]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
      const output = execFileSync(
        "docker",
        ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
        { input: sql, encoding: "utf8" },
      );
      assert.match(
        output,
        /All authorization and relational integrity checks passed/,
      );
    } finally {
      docker("rm", "-f", "-v", name);
    }
  },
);
