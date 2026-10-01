import {
  AnalysisError,
  retrieveContext,
  SYSTEM_INSTRUCTION,
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

// Dependencies are injected so authentication and Gemini error paths can be tested without a key.
export function createAnalysisHandler({
  createClient,
  getEnv,
  fetchImpl = fetch,
}) {
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
      if (text.length > 12_000)
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
      const context = await retrieveContext(database, body.assignment_id);
      const key = getEnv("GEMINI_API_KEY")?.trim();
      // Source retrieval works before Gemini is connected; never fabricate an answer.
      if (!key || !hasQuestion)
        return response({ ...context, configured: Boolean(key) });
      const model = getEnv("GEMINI_MODEL")?.trim() || "gemini-3.8-flash";
      if (!/^[a-zA-Z0-9._-]+$/.test(model))
        throw new AnalysisError(
          "The AI connection needs attention. Check its model setting.",
          503,
        );
      let generated;
      try {
        generated = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            signal: AbortSignal.timeout(45_000),
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: JSON.stringify({
                        question: body.question.trim(),
                        current_date: new Date().toISOString().slice(0, 10),
                        assignment_id: context.assignment_id,
                        sources: context.sources,
                      }),
                    },
                  ],
                },
              ],
              generationConfig: { maxOutputTokens: 4096 },
            }),
          },
        );
      } catch (error) {
        if (error.name === "TimeoutError" || error.name === "AbortError")
          throw new AnalysisError(
            "AI took too long to respond. Please try again.",
            504,
          );
        throw new AnalysisError(
          "AI could not be reached. Please try again.",
          503,
        );
      }
      if (!generated.ok) {
        if (generated.status === 429)
          throw new AnalysisError(
            "AI is busy or its quota is used up. Please try again later.",
            429,
          );
        if ([400, 401, 403, 404].includes(generated.status))
          throw new AnalysisError(
            "The AI connection needs attention. Check the Gemini key and model settings.",
            503,
          );
        throw new AnalysisError(
          "AI could not answer right now. Please try again.",
          502,
        );
      }
      const payload = await generated.json();
      const candidate = payload.candidates?.[0];
      if (candidate?.finishReason !== "STOP")
        throw new AnalysisError(
          "AI could not complete an answer. Try a shorter or more specific question.",
          502,
        );
      const answer = candidate.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text || "")
        .join("\n")
        .trim();
      if (!answer || answer.length > 30_000)
        throw new AnalysisError(
          "AI returned no usable answer. Please try again.",
          502,
        );
      const references = new Set(
        context.sources.map((source) => source.reference),
      );
      const cited = [...answer.matchAll(/\[((?:A|F)\d+)\]/g)].map(
        (match) => match[1],
      );
      if (cited.some((reference) => !references.has(reference)))
        throw new AnalysisError(
          "AI returned an invalid source reference. Please try again.",
          502,
        );
      return response({ ...context, configured: true, answer });
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
