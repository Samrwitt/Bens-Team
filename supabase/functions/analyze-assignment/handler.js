import { searchSources, progressOverview } from "./search.js";
import { generateAnswer } from "./providers.js";
import {
  AnalysisError,
  retrieveContext,
} from "./context.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const response = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

// Dependencies are injected so authentication and provider failures can be tested without keys.
export function createAnalysisHandler({
  createClient,
  getEnv,
  fetchImpl = fetch,
}) {
  let nextProvider = 0;
  return async (request) => {
    if (request.method === "OPTIONS")
      return new Response("ok", { headers: cors });
    if (request.method !== "POST")
      return response({ error: "Method not allowed." }, 405);
    try {
      const authorization = request.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer "))
        return response({ error: "Sign in required." }, 401);
      const database = createClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const {
        data: { user },
        error: authError,
      } = await database.auth.getUser(authorization.slice(7));
      if (authError || !user)
        return response({ error: "Sign in required." }, 401);
      const { data: profile, error: profileError } = await database
        .from("employees")
        .select("role")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (profileError)
        throw new AnalysisError(
          "Unable to verify workspace access. Please try again.",
          503,
        );
      if (profile?.role !== "manager")
        return response({ error: "Manager access required." }, 403);

      const text = await request.text();
      if (text.length > 64_000)
        throw new AnalysisError("Request is too large.", 413);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new AnalysisError("Enter a valid assignment and question.");
      }
      if (
        !body ||
        typeof body !== "object" ||
        !Number.isSafeInteger(body.assignment_id) ||
        body.assignment_id < 1
      ) {
        throw new AnalysisError("Select a valid assignment.");
      }
      const mode = body.mode ?? "api";
      if (!["local", "api"].includes(mode)) throw new AnalysisError("Choose local vector search or API LLM.");
      const hasQuestion = Object.hasOwn(body, "question");
      if (
        hasQuestion &&
        (typeof body.question !== "string" ||
          !body.question.trim() ||
          body.question.length > 2000)
      ) {
        throw new AnalysisError(
          "Enter a question between 1 and 2,000 characters.",
        );
      }
      const history = body.history ?? [];
      if (!Array.isArray(history) || history.length > 8 || history.length % 2 !== 0 ||
        history.some((message, index) => !message || message.role !== (index % 2 === 0 ? "user" : "assistant") || typeof message.content !== "string" || !message.content.trim() || message.content.length > (message.role === "user" ? 2000 : 30_000)) ||
        JSON.stringify(history).length > 24_000) {
        throw new AnalysisError("The conversation is too long or invalid. Start a new chat.");
      }
      const context = await retrieveContext(database, body.assignment_id, { localOnly: mode === "local" });
      if (mode === "local") {
        const overview = hasQuestion ? progressOverview(context, body.question) : null;
        if (overview) return response({ ...context, mode, configured: true, ...overview });
        const matches = hasQuestion ? searchSources(context.sources, body.question) : [];
        return response({ ...context, mode, configured: true, matches,
          answer: matches.length ? `Found ${matches.length} matching excerpt(s). These are saved source text, not an AI answer.` : "No matching excerpts. Try specific words used in the assignment or feedback.",
          suggested_feedback: null });
      }
      const providers = [
        { name: "gemini", key: getEnv("GEMINI_API_KEY")?.trim(), model: getEnv("GEMINI_MODEL")?.trim() || "gemini-3.8-flash" },
        { name: "groq", key: getEnv("GROQ_API_KEY")?.trim(), model: getEnv("GROQ_MODEL")?.trim() || "openai/gpt-oss-120b" },
      ].filter((provider) => provider.key);
      if (!providers.length || !hasQuestion)
        return response({ ...context, configured: Boolean(providers.length) });
      // Alternate the first provider within each worker; try the other on failure.
      const first = nextProvider++ % providers.length;
      let failure;
      for (let offset = 0; offset < providers.length; offset++) {
        const provider = providers[(first + offset) % providers.length];
        try {
          const answer = await generateAnswer(provider, context, body.question, fetchImpl, history);
          return response({ ...context, configured: true, ...answer });
        } catch (error) {
          if (!(error instanceof AnalysisError)) throw error;
          failure = error;
        }
      }
      throw failure;
    } catch (error) {
      if (error instanceof AnalysisError)
        return response({ error: error.message }, error.status);
      // Do not expose provider responses, credentials, or assignment text in errors/logs.
      return response(
        { error: "Unable to analyze this assignment. Please try again." },
        500,
      );
    }
  };
}
