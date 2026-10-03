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
            ${(state.data.feedback_attachments || []).filter((file) => file.feedback_id === f.id).map((file) => `<button type="button" class="textbutton" data-attachment="${file.id}">Download ${escapeHtml(file.name)} (${Math.ceil(file.size / 1024)} KB)</button>`).join(" ")}
            <button
              class="textbutton"
              onclick="feedbackForm(${f.assignment_id},${f.id})"
            >
              Reply</button
            >${thread(items, f.id)}
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
            ${manager
              ? '<div class="panel" id="assignment-analysis"></div>'
              : ""}
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
                ><textarea
                  id="body"
                  name="body"
                  placeholder="Share guidance or ask for an update…"
                  required
                ></textarea>
                <label for="feedback-files">Attachments</label>
                <input id="feedback-files" name="files" type="file" multiple>
                <small class="muted">Up to 10 files, 20 MB each. Images, PDFs, code, and other files.</small>
                <div class="error" role="alert"></div>
                <button>Post feedback</button>
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
    document.querySelector("#feedback").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button");
      button.disabled = true;
      try {
        await api("feedback", {
          assignment_id: id,
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
      mountAssignmentAnalysis(
        document.querySelector("#assignment-analysis"),
        id,
      );
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
