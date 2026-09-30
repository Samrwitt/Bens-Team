import { escapeHtml, getInitials } from "../utils/format.js";
import { shell, heading } from "../components/layout.js";
export function createTeamsPage({ state }) {
  function teams() {
    shell(
      "teams",
      heading(
        "Teams",
        "Group employees and assign work together.",
        '<button onclick="teamForm()">＋ Create team</button>',
      ) +
        /* HTML */ `<div class="grid">
          ${state.data.teams
            .map((t) => {
              const people = state.data.members
                .filter((m) => m.team_id === t.id)
                .map((m) =>
                  state.data.employees.find((e) => e.id === m.employee_id),
                );
              return /* HTML */ `<div class="card">
                <span class="avatar">▦</span>
                <h2 style="margin-top:16px">${escapeHtml(t.name)}</h2>
                <p>${people.length} members</p>
                ${people
                  .map(
                    (e) =>
                      /* HTML */ `<div style="margin:12px 0;font-size:13px">
                        <span class="avatar"
                          >${escapeHtml(getInitials(e.name))}</span
                        >${escapeHtml(e.name)}
                      </div>`,
                  )
                  .join("") || "<p>No members yet</p>"}
                <div class="card-footer">
                  <span class="muted" style="font-size:12px"
                    >${state.data.assignments.filter((a) => a.team_id === t.id)
                      .length}
                    assignments</span
                  ><button class="textbutton" onclick="teamForm(${t.id})">
                    Edit team →
                  </button>
                </div>
              </div>`;
            })
            .join("") ||
          '<div class="empty">Create a team to group your employees.</div>'}
        </div>`,
    );
  }
  return {
    teams,
  };
}
