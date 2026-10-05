import { api } from "../services/backend.js";
import { escapeHtml } from "../utils/format.js";

// Each mounted panel owns its requests. A late response cannot update another page.
export async function mountAssignmentAnalysis(container, assignmentId) {
  container.innerHTML =
    '<h2>Ask AI</h2><p class="muted" role="status">Loading assignment sources…</p>';
  let context;
  try {
    context = await api("analysis", { assignment_id: assignmentId });
  } catch {
    if (!container.isConnected) return;
    container.innerHTML =
      '<h2>Ask AI</h2><p class="muted">Assignment analysis is not available right now.</p><button class="secondary" type="button">Try again</button>';
    container.querySelector("button").onclick = () =>
      mountAssignmentAnalysis(container, assignmentId);
    return;
  }
  if (!container.isConnected) return;

  container.innerHTML = /* HTML */ `
    <h2>Ask AI</h2>
    <p class="analysis-status" role="status" ${context.configured ? "hidden" : ""}>
      ${context.configured
        ? ""
        : "AI is not connected yet."}
    </p>
    <form id="analysis-form">
      <label for="analysis-question">Your question</label>
      <textarea
        id="analysis-question"
        name="question"
        maxlength="2000"
        required
        placeholder="What is blocking progress, and what should we do next?"
        ${context.configured ? "" : "disabled"}
      ></textarea>
      <div class="error" role="alert"></div>
      <button ${context.configured ? "" : "disabled"}>Ask AI</button>
    </form>
    <div class="analysis-result" aria-live="polite"></div>
    <details class="analysis-sources">
      <summary></summary>
      <div class="source-list"></div>
    </details>
  `;
  const sources = container.querySelector(".source-list");
  function showSources(result) {
    container.querySelector("summary").textContent =
      "Sources";
    sources.innerHTML = result.sources
      .map(
        (source) => /* HTML */ `
          <article class="analysis-source">
            <strong
              >[${escapeHtml(source.reference)}]
              ${escapeHtml(source.label)}</strong
            >
            <p>${escapeHtml(source.text)}</p>
          </article>
        `,
      )
      .join("");
  }
  showSources(context);
  const form = container.querySelector("form");
  const button = form.querySelector("button");
  const error = form.querySelector(".error");
  const result = container.querySelector(".analysis-result");
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const question = form.elements.question.value.trim();
    if (!question) {
      error.textContent = "Enter a question about this assignment.";
      return;
    }
    button.disabled = true;
    button.textContent = "Thinking…";
    error.textContent = "";
    result.textContent = "";
    try {
      const answer = await api("analysis", {
        assignment_id: assignmentId,
        question,
      });
      if (!container.isConnected) return;
      showSources(answer);
      if (!answer.configured) {
        context.configured = false;
        form.elements.question.disabled = true;
        container.querySelector(".analysis-status").textContent =
          "AI is not connected yet.";
        container.querySelector(".analysis-status").hidden = false;
      } else {
        // Plain text rendering prevents model output from executing HTML or scripts.
        result.innerHTML =
          '<p class="analysis-answer"></p>';
        result.querySelector(".analysis-answer").textContent = answer.answer;
      }
    } catch (failure) {
      if (container.isConnected) error.textContent = failure.message;
    } finally {
      button.disabled = !context.configured;
      button.textContent = "Ask AI";
    }
  };
}
