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
          ? '<div class="assignment-actions"><button class="secondary" onclick="refresh()">Refresh updates</button><button onclick="assignmentForm()">＋ New assignment</button></div>'
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
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Assigned to</th>
                  <th>Due date</th>
                  <th>Status</th>
                  ${manager ? "<th>Employee updates</th>" : ""}
                  <th></th>
                </tr>
              </thead>
              <tbody id="rows"></tbody>
            </table>
          </div> `,
    );
    rows();
  }
  function rows() {
    const manager = state.data.profile.role === "manager";
    const employeeIds = new Set(state.data.employees.map((person) => person.auth_user_id));
    function updates(assignment) {
      const messages = state.data.feedback
        .filter((item) => item.assignment_id === assignment.id && employeeIds.has(item.author_id))
        .sort((a, b) => new Date(b.created) - new Date(a.created));
      if (!messages.length) return '<span class="muted">No employee updates</span>';
      const latest = messages[0];
      const person = state.data.people.find((item) => item.auth_user_id === latest.author_id);
      return `<a class="employee-update" href="#assignment/${assignment.id}"><span class="badge progress">${messages.length} employee update${messages.length === 1 ? "" : "s"}</span><strong>${escapeHtml(person?.name || "Employee")}${latest.parent_id ? " replied" : " posted feedback"}</strong><span class="update-preview">${escapeHtml(latest.body)}</span><small class="muted">${escapeHtml(new Date(latest.created).toLocaleString())}</small></a>`;
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
            /* HTML */ `<tr>
              <td>
                <a href="#assignment/${a.id}"
                  ><span class="id">${formatAssignmentId(a.id)}</span
                  ><strong>${escapeHtml(a.title)}</strong></a
                >
              </td>
              <td>
                ${escapeHtml(owner(a, state.data))}
                <div class="muted" style="font-size:11px">
                  ${a.team_id ? "Team" : "Employee"}
                </div>
              </td>
              <td>${escapeHtml(a.due)}</td>
              <td>${manager ? `<select data-status="${a.id}" aria-label="Status for ${escapeHtml(a.title)}">${["Open", "In progress", "Done"].map((status) => `<option ${a.status === status ? "selected" : ""}>${status}</option>`).join("")}</select>` : statusBadge(a.status)}</td>
              ${manager ? `<td>${updates(a)}</td>` : ""}
              <td>
                <a
                  href="#assignment/${a.id}"
                  aria-label="Open ${formatAssignmentId(a.id)}"
                  >↗</a
                >
              </td>
            </tr>`,
        )
        .join("") ||
      `<tr><td colspan="${manager ? 6 : 5}" class="empty">${manager ? "No assignments found. Create one to get started." : "No assignments found. Try another search or check back with your manager."}</td></tr>`;
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
