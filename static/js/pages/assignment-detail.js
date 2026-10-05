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
  function thread(items, parent = null) {
    return items
      .filter((f) => f.parent_id === parent)
      .map(
        (f) =>
          /* HTML */ `<div class="${parent ? "reply" : "feedback"}">
            <strong style="font-size:13px"
              >${escapeHtml(
                state.data.people.find((p) => p.auth_user_id === f.author_id)
                  ?.name || "Workspace member",
              )}</strong
            >
            <small>
              · ${escapeHtml(new Date(f.created).toLocaleString())}</small
            >
            <p>${escapeHtml(f.body)}</p>
            ${(state.data.feedback_attachments || []).filter((file) => file.feedback_id === f.id).map((file) => file.content_type?.startsWith("image/")
              ? `<figure class="attachment-preview" data-image-attachment="${file.id}"><p class="muted" role="status">Loading ${escapeHtml(file.name)}…</p><button type="button" class="image-thumbnail" aria-label="Enlarge ${escapeHtml(file.name)}" hidden><img alt="${escapeHtml(file.name)}"></button><figcaption>${escapeHtml(file.name)}</figcaption></figure>`
              : `<button type="button" class="textbutton" data-attachment="${file.id}">Download ${escapeHtml(file.name)} (${Math.ceil(file.size / 1024)} KB)</button>`).join(" ")}
            ${thread(items, f.id)}
          </div>`,
      )
      .join("");
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
              <h2>
                Feedback
                <span class="muted" style="font-size:13px"
                  >(${feedback.length})</span
                >
              </h2>
              <p class="muted" style="font-size:13px">
                Keep the conversation connected to ${formatAssignmentId(id)}.
              </p>
              ${thread(feedback) ||
              '<p class="muted">No feedback yet. Start the conversation below.</p>'}
              <form class="composer" id="feedback">
                <label for="body">Add feedback</label
                ><div class="feedback-input"><textarea
                  id="body"
                  name="body"
                  placeholder="Share guidance or ask for an update…"
                  required
                ></textarea>
                <div class="composer-actions">
                  ${attachmentPicker("feedback-files")}
                </div></div>
                <div class="error" role="alert"></div>
                <div class="feedback-footer">
                  ${feedback.length ? `<select id="reply-to" name="parent_id" aria-label="Reply to message"><option value="">New message</option>${feedback.map((message) => {
                    const author = state.data.people.find((person) => person.auth_user_id === message.author_id)?.name || "Workspace member";
                    return `<option value="${message.id}">${escapeHtml(author)}: ${escapeHtml(message.body.slice(0, 90))}</option>`;
                  }).join("")}</select>` : ""}
                  ${manager ? '<button type="button" class="secondary attachment-button" id="open-analysis" aria-label="Ask AI" title="Ask AI"><span aria-hidden="true">✨</span></button>' : ""}
                  <button type="submit" class="post-feedback">Post feedback</button>
                </div>
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
    const replyTo = document.querySelector("#reply-to");
    if (replyTo) replyTo.onchange = () => {
      const replying = Boolean(replyTo.value);
      document.querySelector('label[for="body"]').textContent = replying ? "Your reply" : "Add feedback";
      document.querySelector(".post-feedback").textContent = replying ? "Post reply" : "Post feedback";
      document.querySelector("#body").focus();
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
          parent_id: replyTo?.value ? Number(replyTo.value) : null,
          files: Array.from(e.target.elements.files.files),
          body: new FormData(e.target).get("body"),
        });
        await refresh();
        toast("Feedback added");
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
        const close = () => { dialog.close(); dialog.innerHTML = ""; dialog.removeAttribute("aria-label"); dialog.oncancel = null; };
        dialog.querySelector("#close-analysis").onclick = close;
        dialog.oncancel = (event) => { event.preventDefault(); close(); };
        mountAssignmentAnalysis(dialog.querySelector("#assignment-analysis"), id);
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
