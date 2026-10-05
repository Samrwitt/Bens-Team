import { mountAssignmentAnalysis } from "../components/assignment-analysis.js";
import {
  escapeHtml,
  formatAssignmentId,
  owner,
  statusBadge,
} from "../utils/format.js";
import { shell, heading } from "../components/layout.js";
import { api } from "../services/backend.js";
import { toast } from "../components/toast.js";
import { dialog } from "../components/modal.js";
import { attachmentPicker, bindAttachmentPickers } from "../components/attachment-picker.js";
export function createAssignmentDetailPage({ state, refresh, render }) {
  function processingLabel(file) {
    const record = (state.data.attachment_processing || []).find(item=>item.attachment_id === file.id);
    const status = record?.status || "queued";
    const labels = {queued:"Processing for AI…",processing:"Processing for AI…",ready:"Ready for AI",failed:"Could not read for AI",unsupported:"Not supported for AI"};
    return `<small class="attachment-processing muted" data-processing="${file.id}" title="${escapeHtml(record?.error || "")}">${labels[status]}</small>`;
  }
  function thread(items) {
    return [...items].sort((a, b) => new Date(a.created) - new Date(b.created) || a.id - b.id).map((message) => {
      const author = state.data.people.find((person) => person.auth_user_id === message.author_id)?.name || "Workspace member";
      const parent = items.find((item) => item.id === message.parent_id);
      const own = message.author_id === state.data.profile.auth_user_id;
      return `<article class="chat-message ${own ? "own-message" : ""} ${parent ? "reply" : ""}" data-message="${message.id}">
        <div class="message-meta"><strong>${escapeHtml(author)}</strong><time>${escapeHtml(new Date(message.created).toLocaleString())}</time></div>
        <button type="button" class="message-content" aria-label="Message from ${escapeHtml(author)}: ${escapeHtml(message.body.slice(0, 90))}" aria-expanded="false">
          ${parent ? `<span class="message-quote">${escapeHtml(parent.body.slice(0, 120))}</span>` : ""}
          <span class="message-text">${escapeHtml(message.body)}</span>
        </button>
        ${(state.data.feedback_attachments || []).filter((file) => file.feedback_id === message.id).map((file) => file.content_type?.startsWith("image/")
          ? `<figure class="attachment-preview" data-image-attachment="${file.id}"><p class="muted" role="status">Loading ${escapeHtml(file.name)}…</p><button type="button" class="image-thumbnail" aria-label="Enlarge ${escapeHtml(file.name)}" hidden><img alt="${escapeHtml(file.name)}"></button><figcaption>${escapeHtml(file.name)}${processingLabel(file)}</figcaption></figure>`
          : `<button type="button" class="textbutton" data-attachment="${file.id}">Download ${escapeHtml(file.name)} (${Math.ceil(file.size / 1024)} KB)</button>${processingLabel(file)}`).join(" ")}
        <div class="message-actions" hidden><button type="button" class="textbutton" data-reply="${message.id}">↩ Reply</button></div>
      </article>`;
    }).join("");
  }
  function detail(id) {
    const a = state.data.assignments.find((x) => x.id === id);
    if (!a) {
      shell("assignments", '<p class="empty">Assignment not found.</p>');
      return;
    }
    const manager = state.data.profile.role === "manager";
    const feedback = state.data.feedback.filter((f) => f.assignment_id === id);
    shell(
      "assignments",
      /* HTML */ `<div style="margin-top:28px"><a class="back" href="#assignments">← All assignments</a></div>` +
        heading(
          escapeHtml(a.title),
          formatAssignmentId(a.id),
          statusBadge(a.status),
        ) +
        /* HTML */ `<div class="detail">
          <section>
            <div class="panel">
              <h2>Assignment brief</h2>
              <p class="description">${escapeHtml(a.description)}</p>
            </div>
            <div class="panel">
              <div class="chat-heading"><h2>
                Feedback
                <span class="feedback-count"
                  >(${feedback.length})</span
                >
              </h2>
                  ${manager ? '<button type="button" class="secondary attachment-button" id="open-analysis" aria-label="Ask AI" title="Ask AI"><svg class="ai-sparkle" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z"/></svg></button>' : ""}
              </div>
              <div class="chat-conversation" aria-label="Assignment conversation">${thread(feedback) ||
              '<p class="muted">No feedback yet. Start the conversation below.</p>'}</div>
              <form class="composer" id="feedback">
                <div id="reply-context" class="reply-context" hidden><div><strong id="reply-author"></strong><p id="reply-preview"></p></div><button type="button" class="textbutton" id="cancel-reply" aria-label="Cancel reply">×</button></div>
                <label for="body">Add feedback</label
                ><div class="feedback-input"><textarea
                  id="body"
                  name="body"
                  placeholder="Write a message…"
                  rows="1"
                  required
                ></textarea>
                <div class="composer-actions">
                  ${attachmentPicker("feedback-files")}
                  <button type="submit" class="post-feedback">Post feedback</button>
                </div></div>
                <div class="error" role="alert"></div>
              </form>
            </div>
          </section>
          <section>
            <div class="panel">
              <h2>Details</h2>
              <div class="meta">
                <small>Assignment ID</small>${formatAssignmentId(id)}
              </div>
              <div class="meta">
                <small>Assigned to · ${a.team_id ? "Team" : "Employee"}</small
                >${escapeHtml(owner(a, state.data))}
              </div>
              <div class="meta">
                <small>Due date</small>${escapeHtml(a.due)}
              </div>
              <div class="meta">
                ${manager
                  ? /* HTML */ `
                      <label for="status">Status</label>
                      <select class="full" id="status">
                        ${["Open", "In progress", "Done"]
                          .map(
                            (status) =>
                              /* HTML */ `<option
                                ${a.status === status ? "selected" : ""}
                              >
                                ${status}
                              </option>`,
                          )
                          .join("")}
                      </select>
                    `
                  : /* HTML */ `<small>Status</small>${statusBadge(a.status)}`}
              </div>
            </div>
          </section>
        </div>`,
    );
    bindAttachmentPickers(document.querySelector("#feedback"));
    const processingNodes = [...document.querySelectorAll("[data-processing]")];
    let statusPolls = 0;
    async function pollProcessing() {
      if (!processingNodes.some(node=>node.isConnected) || statusPolls++ >= 60) return;
      const pending = processingNodes.filter(node=>!['ready','failed','unsupported'].includes((state.data.attachment_processing || []).find(item=>item.attachment_id === Number(node.dataset.processing))?.status));
      if (!pending.length) return;
      try {
        const ids = pending.map(node=>Number(node.dataset.processing));
        const records = [];
        for (let start=0;start<ids.length;start+=100) records.push(...await api("attachment-status",{ids:ids.slice(start,start+100)}));
        if (!processingNodes.some(node=>node.isConnected)) return;
        state.data.attachment_processing ||= [];
        for (const record of records) {
          const index = state.data.attachment_processing.findIndex(item=>item.attachment_id === record.attachment_id);
          if (index>=0) state.data.attachment_processing[index]=record; else state.data.attachment_processing.push(record);
          const node = processingNodes.find(item=>Number(item.dataset.processing) === record.attachment_id);
          if (node) { const file = state.data.feedback_attachments.find(item=>item.id === record.attachment_id); const template = document.createElement("template"); template.innerHTML = processingLabel(file); node.textContent = template.content.firstChild.textContent; node.title = record.error || ""; }
        }
      } catch { /* Keep current status; extraction is independent of this page. */ }
      if (processingNodes.some(node=>node.isConnected)) setTimeout(pollProcessing,5000);
    }
    setTimeout(pollProcessing,5000);

    if (manager) {
      const workspace = state.data;
      const employeeIds = new Set(workspace.employees.map((person) => person.auth_user_id));
      const readIds = new Set((workspace.feedback_reads || []).map((item) => item.feedback_id));
      const ids = feedback.filter((message) => employeeIds.has(message.author_id) && !readIds.has(message.id)).map((message) => message.id);
      if (ids.length) api("read-feedback", { ids }).then(() => {
        workspace.feedback_reads ||= [];
        workspace.feedback_reads.push(...ids.map((feedback_id) => ({ feedback_id, manager_id: workspace.profile.auth_user_id })));
      }).catch((error) => toast(error.message));
    }
    let replyTo = null;
    const conversation = document.querySelector(".chat-conversation");
    conversation.scrollTop = conversation.scrollHeight;
    const hideActions = () => {
      conversation.querySelectorAll(".message-actions").forEach((actions) => { actions.hidden = true; });
      conversation.querySelectorAll(".message-content").forEach((button) => button.setAttribute("aria-expanded", "false"));
    };
    conversation.querySelectorAll(".message-content").forEach((button) => {
      button.onclick = () => {
        const actions = button.closest("[data-message]").querySelector(".message-actions");
        const show = actions.hidden;
        hideActions();
        actions.hidden = !show;
        button.setAttribute("aria-expanded", String(show));
      };
    });
    conversation.querySelectorAll("[data-reply]").forEach((button) => {
      button.onclick = () => {
        replyTo = Number(button.dataset.reply);
        const message = feedback.find((item) => item.id === replyTo);
        const author = state.data.people.find((person) => person.auth_user_id === message.author_id)?.name || "Workspace member";
        document.querySelector("#reply-author").textContent = `Replying to ${author}`;
        document.querySelector("#reply-preview").textContent = message.body;
        document.querySelector("#reply-context").hidden = false;
        document.querySelector('label[for="body"]').textContent = "Your reply";
        document.querySelector(".post-feedback").textContent = "Post reply";
        hideActions();
        document.querySelector("#body").focus();
      };
    });
    document.querySelector("#cancel-reply").onclick = () => {
      replyTo = null;
      document.querySelector("#reply-context").hidden = true;
      document.querySelector('label[for="body"]').textContent = "Add feedback";
      document.querySelector(".post-feedback").textContent = "Post feedback";
    };
    document.querySelectorAll("[data-image-attachment]").forEach(async (figure) => {
      const file = state.data.feedback_attachments.find((item) => item.id === Number(figure.dataset.imageAttachment));
      const message = figure.querySelector("p");
      const img = figure.querySelector("img");
      const thumbnail = figure.querySelector(".image-thumbnail");
      thumbnail.onclick = () => {
        const viewer = document.createElement("dialog");
        viewer.className = "image-viewer";
        viewer.setAttribute("aria-label", file.name);
        viewer.innerHTML = '<button type="button" class="popup-close" aria-label="Close image">×</button><img><p></p>';
        viewer.querySelector("img").src = img.src;
        viewer.querySelector("img").alt = file.name;
        viewer.querySelector("p").textContent = file.name;
        viewer.querySelector("button").onclick = () => viewer.close();
        viewer.onclose = () => viewer.remove();
        viewer.onclick = (event) => { if (event.target === viewer) viewer.close(); };
        document.body.append(viewer);
        viewer.showModal();
      };
      const failed = () => {
        if (!figure.isConnected) return;
        message.textContent = "Image could not load. ";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "textbutton";
        retry.textContent = "Try again";
        retry.onclick = () => detail(id);
        message.append(retry);
        message.hidden = false;
        thumbnail.hidden = true;
      };
      try {
        const { signedUrl } = await api("attachment", { ...file, preview: true });
        if (!figure.isConnected) return;
        img.onload = () => { message.hidden = true; thumbnail.hidden = false; };
        img.onerror = failed;
        img.src = signedUrl;
      } catch { failed(); }
    });
    document.querySelector("#feedback").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await api("feedback", {
          assignment_id: id,
          parent_id: replyTo,
          files: Array.from(e.target.elements.files.files),
          body: new FormData(e.target).get("body"),
        });
        await refresh();
      } catch (err) {
        e.target.querySelector(".error").textContent = err.message;
      } finally {
        button.disabled = false;
      }
    };
    document.querySelectorAll("[data-attachment]").forEach((button) => {
      button.onclick = async () => {
        button.disabled = true;
        try {
          const file = state.data.feedback_attachments.find((item) => item.id === Number(button.dataset.attachment));
          const { signedUrl } = await api("attachment", file);
          const link = document.createElement("a");
          link.href = signedUrl;
          link.download = file.name;
          link.click();
        } catch (error) { toast(error.message); }
        finally { button.disabled = false; }
      };
    });
    if (manager) {
      document.querySelector("#open-analysis").onclick = () => {
        dialog.innerHTML = `<button type="button" class="popup-close" id="close-analysis" aria-label="Close" title="Close">×</button><div id="assignment-analysis"></div>`;
        dialog.setAttribute("aria-label", `Ask AI · ${a.title}`);
        dialog.showModal();
        let posted = false;
        const close = () => { if (posted) refresh().catch((error) => toast(error.message)); dialog.close(); dialog.innerHTML = ""; dialog.removeAttribute("aria-label"); dialog.oncancel = null; };
        dialog.querySelector("#close-analysis").onclick = close;
        dialog.oncancel = (event) => { event.preventDefault(); close(); };
        mountAssignmentAnalysis(dialog.querySelector("#assignment-analysis"), id, () => {
          posted = true;
          if (!dialog.open) refresh().catch((error) => toast(error.message));
        });
      };
      document.querySelector("#status").onchange = async (e) => {
        try {
          await api("status", {
            id,
            status: e.target.value,
          });
          await refresh();
          toast("Status updated");
        } catch (err) {
          toast(err.message);
          render();
        }
      };
    }
  }
  return {
    detail,
  };
}
