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
                ><textarea
                  id="body"
                  name="body"
                  placeholder="Share guidance or ask for an update…"
                  required
                ></textarea>
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
                <label for="status">Status</label
                ><select class="full" id="status">
                  ${["Open", "In progress", "Done"]
                    .map(
                      (s) =>
                        /* HTML */ `<option ${a.status === s ? "selected" : ""}>
                          ${s}
                        </option>`,
                    )
                    .join("")}
                </select>
              </div>
            </div>
      
          </section>
        </div>`,
    );
    document.querySelector("#feedback").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("feedback", {
          assignment_id: id,
          body: new FormData(e.target).get("body"),
        });
        await refresh();
        toast("Feedback added");
      } catch (err) {
        e.target.querySelector(".error").textContent = err.message;
      }
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
  return {
    detail,
  };
}
