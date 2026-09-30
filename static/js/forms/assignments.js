import { escapeHtml } from "../utils/format.js";
import { field } from "../components/field.js";
export function createAssignmentForms({ state, modal }) {
  function assignmentForm() {
    const teamOptions = state.data.teams
      .map(
        (team) => /* HTML */ `
          <option value="team:${team.id}">
            Team · ${escapeHtml(team.name)}
          </option>
        `,
      )
      .join("");
    const employeeOptions = state.data.employees
      .map(
        (employee) => /* HTML */ `
          <option value="employee:${employee.id}">
            ${escapeHtml(employee.name)}
          </option>
        `,
      )
      .join("");
    modal(
      "New assignment",
      /* HTML */ `
        ${field("Assignment title", "title")}
        <label for="description">Brief</label>
        <textarea
          id="description"
          name="description"
          required
          placeholder="What needs to be done?"
        ></textarea>
        <label for="owner">Assign to</label>
        <select id="owner" name="owner" required>
          <option value="">Select an employee or team</option>
          ${teamOptions} ${employeeOptions}
        </select>
        ${field("Due date", "due", "date")}
      `,
      "assignments",
    );
  }
  return {
    assignmentForm,
  };
}
