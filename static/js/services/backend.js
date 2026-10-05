import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
const client = configured ? createClient(url, key) : null;
async function result(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function allRows(table) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    let query = client
      .from(table)
      .select("*")
      .order(table === "members" ? "team_id" : "id");
    if (table === "members") query = query.order("employee_id");
    const page = await result(query.range(start, start + 499));
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
async function invokeFunction(name, body) {
  const { data, error } = await client.functions.invoke(name, {
    body,
  });
  if (error) {
    let message = error.message;
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
export async function api(path, body) {
  if (!client) throw new Error("Supabase is not configured.");
  if (path === "login") return result(client.auth.signInWithPassword(body));
  if (path === "logout") return result(client.auth.signOut());
  const {
    data: { session },
    error,
  } = await client.auth.getSession();
  if (error) throw error;
  if (!session)
    throw Object.assign(new Error("Please sign in."), {
      code: "SIGNED_OUT",
    });
  if (path === "data") {
    const profile = await result(
      client
        .from("employees")
        .select("*")
        .eq("auth_user_id", session.user.id)
        .maybeSingle(),
    );
    if (!profile || !["manager", "employee"].includes(profile.role)) {
      throw Object.assign(
        new Error(
          "Your account is not linked to this workspace. Contact your manager.",
        ),
        { code: "PROFILE_REQUIRED" },
      );
    }
    const tables = ["employees", "teams", "members", "assignments", "feedback", "feedback_attachments"];
    const values = await Promise.all(tables.map(allRows));
    const data = Object.fromEntries(
      tables.map((table, i) => [table, values[i]]),
    );
    data.profile = profile;
    data.people = data.employees;
    if (profile.role === "employee") {
      const authors = await result(client.rpc("feedback_authors"));
      data.people = [
        ...data.people,
        ...authors.filter(
          (author) => author.auth_user_id !== profile.auth_user_id,
        ),
      ];
    }
    data.employees = data.employees.filter(
      (person) => person.role === "employee",
    );
    return data;
  }
  if (path === "analysis") return invokeFunction("analyze-assignment", body);
  if (path === "employees")
    return invokeFunction("manage-employee", {
      ...body,
      action: "create",
    });
  if (path === "password")
    return invokeFunction("manage-employee", {
      ...body,
      action: "reset-password",
    });
  if (path === "teams")
    return result(
      client.rpc("save_team", {
        team_name: body.name,
        member_ids: body.members,
        target_id: body.id || null,
      }),
    );
  if (path === "assignments") {
    const [kind, value] = body.owner.split(":");
    if (
      !["team", "employee"].includes(kind) ||
      !Number.isSafeInteger(Number(value))
    )
      throw new Error("Select an employee or team.");
    return result(
      client.from("assignments").insert({
        title: body.title,
        description: body.description,
        due: body.due,
        employee_id: kind === "employee" ? Number(value) : null,
        team_id: kind === "team" ? Number(value) : null,
      }),
    );
  }
  if (path === "status")
    return result(
      client
        .from("assignments")
        .update({
          status: body.status,
        })
        .eq("id", body.id)
        .select("id")
        .single(),
    );
  if (path === "attachment")
    return result(client.storage.from("feedback-files").createSignedUrl(body.path, 3600, body.preview ? {} : { download: body.name }));
  if (path === "feedback") {
    const files = (body.files || []).filter((file) => file.size > 0);
    if (files.length > 10 || files.some((file) => file.size > 20 * 1024 * 1024))
      throw new Error("Attach up to 10 files, each no larger than 20 MB.");
    const uploaded = [];
    try {
      for (const file of files) {
        const path = `${session.user.id}/${body.assignment_id}/${crypto.randomUUID()}`;
        await result(client.storage.from("feedback-files").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        }));
        uploaded.push({ path, name: file.name, size: file.size, content_type: file.type || "application/octet-stream" });
      }
      return await result(client.rpc("post_feedback", {
        target_assignment: body.assignment_id,
        feedback_body: body.body,
        reply_to: body.parent_id || null,
        files: uploaded,
      }));
    } catch (error) {
      if (uploaded.length) await client.storage.from("feedback-files").remove(uploaded.map((file) => file.path));
      throw error;
    }
  }
  throw new Error("Unknown action");
}
export function onSignedOut(callback) {
  if (client)
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") callback();
    });
}
