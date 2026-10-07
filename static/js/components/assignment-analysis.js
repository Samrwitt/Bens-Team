import { api } from "../services/backend.js";
import { state } from "../state.js";

export function mountAssignmentAnalysis(container, assignmentId, onFeedbackSent = () => {}) {
  const chats = state.analysisChats;
  const messages = chats[assignmentId] ||= [];
  container.innerHTML = `<h2>Search or ask AI</h2>
    <div class="ai-chat analysis-result" role="log" aria-label="AI conversation" aria-live="polite"></div>
    <p class="analysis-status muted" role="status" hidden>AI is not connected yet.</p>
    <form id="analysis-form">
      <label for="analysis-mode">Response mode</label>
      <select id="analysis-mode" name="mode">
        <option value="local">Local vector search</option>
        <option value="api">API LLM</option>
      </select>
      <p class="analysis-mode-note muted">Local search returns matching excerpts inside Workroom. API LLM sends this assignment’s sources and AI conversation to Gemini or Groq to write an answer. File recognition may use external APIs during upload processing.</p>
      <label for="analysis-question">Your question</label>
      <div class="ai-chat-composer"><textarea id="analysis-question" name="question" maxlength="2000" rows="2" required placeholder="Ask about this assignment…" ></textarea>
      <button >Send</button></div>
      <div class="error" role="alert"></div>
    </form>`;
  const log = container.querySelector(".ai-chat");
  const form = container.querySelector("form");
  const button = form.querySelector("button");
  const input = form.elements.question;
  const error = form.querySelector(".error");
  function addMessage(role, content, message = {}) {
    const bubble = document.createElement("article");
    bubble.className = `ai-chat-message ${role === "user" ? "ai-user" : "ai-assistant"}`;
    const label = document.createElement("small");
    label.textContent = role === "user" ? "You" : message.mode === "local" ? "Local search" : "AI";
    const text = document.createElement("p");
    text.className = role === "assistant" ? "analysis-answer" : "ai-question";
    text.textContent = content;
    bubble.append(label, text);
    for (const match of message.matches || []) {
      const source = document.createElement("section");
      source.className = "analysis-source";
      const title = document.createElement("strong");
      title.textContent = match.label;
      const excerpt = document.createElement("p");
      excerpt.textContent = match.excerpt;
      source.append(title, excerpt);
      bubble.append(source);
    }
    if (message.attachment_status?.pending || message.attachment_status?.failed) {
      const note = document.createElement("small");
      note.textContent = [message.attachment_status.pending ? `${message.attachment_status.pending} attachment(s) still processing` : "", message.attachment_status.failed ? `${message.attachment_status.failed} attachment(s) could not be read` : ""].filter(Boolean).join(" · ");
      bubble.append(note);
    }
    if (role === "assistant" && message.suggested_feedback) {
      const draft = document.createElement("textarea");
      draft.className = "ai-feedback-draft";
      draft.setAttribute("aria-label", "Suggested feedback question");
      draft.maxLength = 2000;
      draft.rows = 2;
      draft.value = message.draft ?? message.suggested_feedback;
      const fitDraft = () => { draft.style.height = "auto"; draft.style.height = `${draft.scrollHeight}px`; };
      draft.oninput = () => { message.draft = draft.value; fitDraft(); };
      requestAnimationFrame(fitDraft);
      const send = document.createElement("button");
      send.type = "button";
      send.className = "secondary ai-feedback-send";
      const failure = document.createElement("p");
      failure.className = "error";
      failure.setAttribute("role", "alert");
      const confirmation = document.createElement("p");
      confirmation.className = "ai-send-confirmation";
      confirmation.setAttribute("role", "status");
      const update = () => {
        confirmation.hidden = !message.sent;
        confirmation.textContent = message.sent ? "Your question has been posted to feedback." : "";
        send.setAttribute("aria-label", message.sent ? "Sent" : message.sending ? "Sending" : "Send to feedback");
        send.title = message.sent ? "Sent" : "Send to feedback";
        send.innerHTML = message.sent ? "✓" : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>';
        send.disabled = draft.disabled = Boolean(message.sent || message.sending);
      };
      update();
      send.onclick = async () => {
        if (message.sent || message.sending) return;
        const body = draft.value.trim();
        if (!body) { failure.textContent = "Enter a question to send."; return; }
        message.sending = true;
        update();
        failure.textContent = "";
        try {
          await api("feedback", { assignment_id: assignmentId, body, files: [] });
          message.sent = true;
          onFeedbackSent();
        } catch (error) { failure.textContent = error.message; }
        finally { message.sending = false; update(); }
      };
      const composer = document.createElement("div");
      composer.className = "ai-feedback-composer";
      composer.append(draft, send);
      bubble.append(composer, confirmation, failure);
    }
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }
  messages.forEach((message) => addMessage(message.role, message.content, message));
  function recentHistory() {
    const history = [];
    const apiMessages = messages.filter(message => message.mode !== "local");
    for (let index = apiMessages.length - 2; index >= 0 && history.length < 8; index -= 2) {
      const pair = apiMessages.slice(index, index + 2).map(({ role, content }) => ({ role, content }));
      if (JSON.stringify([...pair, ...history]).length > 24_000) break;
      history.unshift(...pair);
    }
    return history;
  }
  let pending;
  let thinking;
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const question = input.value.trim();
    if (!question) return;
    const mode = form.elements.mode.value;
    if (pending) pending.remove();
    pending = addMessage("user", question);
    thinking?.remove();
    thinking = addMessage("assistant", mode === "local" ? "Searching…" : "Thinking…");
    thinking.classList.add("ai-thinking");
    thinking.querySelector("p").className = "ai-thinking-text";
    button.disabled = true;
    input.disabled = true;
    button.textContent = mode === "local" ? "Searching…" : "Thinking…";
    error.textContent = "";
    try {
      const answer = await api("analysis", { assignment_id: assignmentId, question, mode, history: mode === "api" ? recentHistory() : [] });
      if (!container.isConnected) return;
      if (!answer.configured) {
        pending.remove();
        pending = null;

        container.querySelector(".analysis-status").hidden = false;
      } else {
        const message = { role: "assistant", content: answer.answer, mode, matches: answer.matches, suggested_feedback: answer.suggested_feedback };
        message.attachment_status = answer.attachment_status;
        messages.push({ role: "user", content: question, mode }, message);
        container.querySelector(".analysis-status").hidden = true;
        pending = null;
        addMessage("assistant", answer.answer, message);
        input.value = "";
      }
    } catch (failure) {
      if (container.isConnected) error.textContent = failure.message;
    } finally {
      thinking?.remove();
      thinking = null;
      button.disabled = false;
      input.disabled = false;
      button.textContent = "Send";
      if (container.isConnected) input.focus();
    }
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  };
}
