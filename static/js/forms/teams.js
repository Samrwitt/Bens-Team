import { escapeHtml } from "../utils/format.js";
import { field } from "../components/field.js";
export function createTeamForms({ state, modal }) {
  function teamForm(id) {
    const t = state.data.teams.find((t) => t.id === id);
    modal(
      id ? "Edit team" : "Create team",
      field(
        "Team name",
        "name",
        "text",
        `value="${escapeHtml(t?.name || "")}"`,
      ) +
        /* HTML */ `<label>Members</label>
          <div class="checks">
            ${state.data.employees
              .map(
                (e) =>
                  /* HTML */ `<label
                    ><input
                      type="checkbox"
                      name="member"
                      value="${e.id}"
                      ${state.data.members.some(
                        (m) => m.team_id === id && m.employee_id === e.id,
                      )
                        ? "checked"
                        : ""}
                    />${escapeHtml(e.name)}</label
                  >`,
              )
              .join("") ||
            '<p class="muted">Add employees first to select members.</p>'}
          </div>`,
      "teams",
      (d, f) => ({
        name: d.name,
        id,
        members: new FormData(f).getAll("member").map(Number),
      }),
    );
  }
  return {
    teamForm,
  };
}
