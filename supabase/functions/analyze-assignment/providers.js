import { AnalysisError, SYSTEM_INSTRUCTION } from "./context.js";

// Both providers receive the same server-retrieved assignment context.
export async function generateAnswer(provider, context, question, fetchImpl, history = []) {
  if (!/^[a-zA-Z0-9._/-]+$/.test(provider.model))
    throw new AnalysisError("The AI connection needs attention. Check its model setting.", 503);
  const prompt = JSON.stringify({ question: question.trim(), current_date: new Date().toISOString().slice(0, 10), assignment_id: context.assignment_id, conversation: history, sources: context.sources });
  const gemini = provider.name === "gemini";
  let generated, payload;
  try {
    generated = await fetchImpl(gemini
      ? `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent`
      : "https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: gemini
        ? { "Content-Type": "application/json", "x-goog-api-key": provider.key }
        : { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify(gemini ? {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096, responseMimeType: "application/json" },
      } : {
        model: provider.model,
        messages: [{ role: "system", content: SYSTEM_INSTRUCTION }, { role: "user", content: prompt }],
        max_completion_tokens: 4096,
        response_format: { type: "json_object" },
      }),
    });
    if (generated.ok) payload = await generated.json();
  } catch (error) {
    if (["TimeoutError", "AbortError"].includes(error.name))
      throw new AnalysisError("AI took too long to respond. Please try again.", 504);
    throw new AnalysisError("AI could not be reached. Please try again.", 503);
  }
  if (!generated.ok) {
    if (generated.status === 429)
      throw new AnalysisError("AI is busy or its quota is used up. Please try again later.", 429);
    if ([400, 401, 403, 404].includes(generated.status))
      throw new AnalysisError("The AI connection needs attention. Check its key and model settings.", 503);
    throw new AnalysisError("AI is busy right now. Please try again shortly.", 502);
  }
  const candidate = gemini ? payload?.candidates?.[0] : payload?.choices?.[0];
  if ((gemini ? candidate?.finishReason : candidate?.finish_reason) !== (gemini ? "STOP" : "stop"))
    throw new AnalysisError("AI could not complete an answer. Try a shorter or more specific question.", 502);
  const raw = gemini
    ? (Array.isArray(candidate.content?.parts) ? candidate.content.parts.filter((part) => part && !part.thought && typeof part.text === "string").map((part) => part.text).join("\n").trim() : "")
    : (typeof candidate.message?.content === "string" ? candidate.message.content.trim() : "");
  let result;
  try { result = JSON.parse(raw); } catch {
    // Support older provider responses during rollout.
    if (raw.startsWith("{")) throw new AnalysisError("AI returned no usable answer. Please try again.", 502);
    result = { answer: raw, suggested_feedback: null };
  }
  const answer = result?.answer;
  const suggestion = result?.suggested_feedback ?? null;
  if (suggestion !== null && (typeof suggestion !== "string" || !suggestion.trim() || suggestion.length > 2000))
    throw new AnalysisError("AI returned an invalid suggested question. Please try again.", 502);
  if (typeof answer !== "string" || !answer.trim() || answer.length > 30_000)
    throw new AnalysisError("AI returned no usable answer. Please try again.", 502);
  const references = new Set(context.sources.map((source) => source.reference));
  const citationGroups = /[\[(]\s*[AFT]\d+(?:[\s,;]+[AFT]\d+)*\s*[\])]/g;
  const cited = [...`${answer} ${suggestion || ""}`.matchAll(citationGroups)].flatMap((match) => match[0].match(/[AFT]\d+/g));
  if (cited.some((reference) => !references.has(reference)))
    throw new AnalysisError("AI returned an invalid source reference. Please try again.", 502);
  const clean = (text) => text.replace(citationGroups, "").replace(/[^\S\r\n]+([.,;:!?])/g, "$1").replace(/[^\S\r\n]{2,}/g, " ").trim();
  return { answer: clean(answer), suggested_feedback: suggestion ? clean(suggestion) : null };
}
