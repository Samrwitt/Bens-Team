import { escapeHtml, getInitials } from "../utils/format.js";
import { shell, heading } from "../components/layout.js";
export function createEmployeesPage({ state }) {
  function employees() {
    shell(
      "employees",
      heading(
        "Employees",
        "Create accounts for the people doing the work.",
        '<button onclick="employeeForm()">＋ Add employee</button>',
      ) +
        /* HTML */ `<div class="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Teams</th>
                  <th>Account</th>
                </tr>
              </thead>
              <tbody>
                ${state.data.employees
                  .map(
                    (e) =>
                      /* HTML */ `<tr>
                        <td>
                          <span class="avatar"
                            >${escapeHtml(getInitials(e.name))}</span
                          ><strong>${escapeHtml(e.name)}</strong>
                        </td>
                        <td>${escapeHtml(e.email)}</td>
                        <td>
                          ${state.data.members
                            .filter((m) => m.employee_id === e.id)
                            .map((m) =>
                              escapeHtml(
                                state.data.teams.find((t) => t.id === m.team_id)
                                  ?.name,
                              ),
                            )
                            .join(", ") || "—"}
                        </td>
                        <td>
                          <button
                            class="textbutton"
                            onclick="passwordForm(${e.id})"
                          >
                            Reset password
                          </button>
                        </td>
                      </tr>`,
                  )
                  .join("") ||
                '<tr><td colspan="4" class="empty">Add your first employee.</td></tr>'}
              </tbody>
            </table>
          </div>
         `,
    );
  }
  return {
    employees,
  };
}
