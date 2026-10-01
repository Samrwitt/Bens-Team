import {
  escapeHtml,
  formatAssignmentId,
  owner,
  statusBadge,
} from "../utils/format.js";
import { shell, heading } from "../components/layout.js";
export function createAssignmentsPage({ state }) {
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
          ? '<button onclick="assignmentForm()">＋ New assignment</button>'
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
              <td>${statusBadge(a.status)}</td>
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
      `<tr><td colspan="5" class="empty">${state.data.profile.role === "manager" ? "No assignments found. Create one to get started." : "No assignments found. Try another search or check back with your manager."}</td></tr>`;
  }
  return {
    assignments,
    rows,
  };
}
