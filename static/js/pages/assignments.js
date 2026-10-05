import {
  escapeHtml,
  formatAssignmentId,
  owner,
  statusBadge,
} from "../utils/format.js";
import { shell, heading } from "../components/layout.js";
import { api } from "../services/backend.js";
import { toast } from "../components/toast.js";
export function createAssignmentsPage({ state, refresh }) {
  function assignments() {
    const manager = state.data.profile.role === "manager";
    shell(
      "assignments",
      heading(
        manager ? "Assignments" : "My assignments",
        manager
          ? "A clear view of what needs to get done."
          : "Work assigned to you and your teams.",
        manager
          ? '<div class="assignment-actions"><button class="secondary" onclick="refresh()">Refresh</button><button onclick="assignmentForm()">＋ New assignment</button></div>'
          : "",
      ) +
        /* HTML */ `<div class="stats">
            ${[
              ["Total assignments", state.data.assignments.length],
              [
                "In progress",
                state.data.assignments.filter((a) => a.status === "In progress")
                  .length,
              ],
              [
                "Completed",
                state.data.assignments.filter((a) => a.status === "Done")
                  .length,
              ],
            ]
              .map(
                ([n, v]) =>
                  /* HTML */ `<div class="stat">
                    <span>${n}</span><strong>${v}</strong>
                  </div>`,
              )
              .join("")}
          </div>
          <div class="table-panel">
            <div class="toolbar">
              <input
                aria-label="Search assignments"
                placeholder="Search title or assignment ID…"
                value="${escapeHtml(state.search)}"
                oninput="setSearch(this.value)"
              /><select
                aria-label="Filter status"
                onchange="setFilter(this.value)"
              >
                ${["All", "Open", "In progress", "Done"]
                  .map(
                    (s) =>
                      /* HTML */ `<option
                        ${s === state.filter ? "selected" : ""}
                      >
                        ${s}
                      </option>`,
                  )
                  .join("")}
              </select>
            </div>
            <table>
              <tbody id="rows"></tbody>
            </table>
          </div> `,
    );
    rows();
  }
  function rows() {
    const manager = state.data.profile.role === "manager";
    const employeeIds = new Set(state.data.employees.map((person) => person.auth_user_id));
    const readIds = new Set((state.data.feedback_reads || []).map((item) => item.feedback_id));
    function updates(assignment) {
      const messages = state.data.feedback
        .filter((item) => item.assignment_id === assignment.id && (!manager || (employeeIds.has(item.author_id) && !readIds.has(item.id))));
      if (!messages.length) return "";
      return `<a class="badge progress unread-count" href="#assignment/${assignment.id}" aria-label="${messages.length} ${manager ? "unread messages" : "messages"}">${messages.length}</a>`;
    }
    const items = state.data.assignments.filter(
      (a) =>
        (state.filter === "All" || a.status === state.filter) &&
        (a.title + " " + formatAssignmentId(a.id))
          .toLowerCase()
          .includes(state.search.toLowerCase()),
    );
    document.querySelector("#rows").innerHTML =
      items
        .map(
          (a) =>
            /* HTML */ `<tr class="assignment-row" data-assignment="${a.id}" tabindex="0" aria-label="Open ${escapeHtml(a.title)}">
              <td>
                <div class="assignment-title-row"><a href="#assignment/${a.id}"
                  ><span class="id">${formatAssignmentId(a.id)}</span
                  ><strong>${escapeHtml(a.title)}</strong></a
                >${updates(a)}</div>
              </td>
              <td>
                ${escapeHtml(owner(a, state.data))}
                <div class="muted" style="font-size:11px">
                  ${a.team_id ? "Team" : "Employee"}
                </div>
              </td>
              <td>${escapeHtml(a.due)}</td>
              <td data-status-cell>${manager ? `<select data-status="${a.id}" aria-label="Status for ${escapeHtml(a.title)}">${["Open", "In progress", "Done"].map((status) => `<option ${a.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>` : statusBadge(a.status)}</td>
            </tr>`,
        )
        .join("") ||
      `<tr><td colspan="4" class="empty">${manager ? "No assignments found. Create one to get started." : "No assignments found. Try another search or check back with your manager."}</td></tr>`;
    document.querySelectorAll("[data-assignment]").forEach((row) => {
      const open = () => { location.hash = `assignment/${row.dataset.assignment}`; };
      row.onclick = (event) => {
        if (!event.target.closest("a, button, select, input, textarea, [data-status-cell]")) open();
      };
      row.onkeydown = (event) => {
        if (event.target === row && ["Enter", " "].includes(event.key)) {
          event.preventDefault();
          open();
        }
      };
    });
    document.querySelectorAll("[data-status]").forEach((select) => {
      select.onchange = async () => {
        const id = Number(select.dataset.status);
        const previous = state.data.assignments.find((item) => item.id === id).status;
        select.disabled = true;
        try {
          await api("status", { id, status: select.value });
          await refresh();
          toast("Status updated");
        } catch (error) {
          select.value = previous;
          toast(error.message);
        } finally { select.disabled = false; }
      };
    });
  }
  return {
    assignments,
    rows,
  };
}
