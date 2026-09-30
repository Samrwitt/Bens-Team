// Application entry point: session loading, routing, and UI action wiring.
import { api, configured, onSignedOut } from "./js/services/backend.js";
import { state } from "./js/state.js";
import { escapeHtml } from "./js/utils/format.js";
import { dialog, createModal } from "./js/components/modal.js";
import { createLoginPage } from "./js/pages/login.js";
import { createAssignmentsPage } from "./js/pages/assignments.js";
import { createEmployeesPage } from "./js/pages/employees.js";
import { createTeamsPage } from "./js/pages/teams.js";
import { createAssignmentDetailPage } from "./js/pages/assignment-detail.js";
import { createEmployeeForms } from "./js/forms/employees.js";
import { createTeamForms } from "./js/forms/teams.js";
import { createAssignmentForms } from "./js/forms/assignments.js";
import { createFeedbackForms } from "./js/forms/feedback.js";
const app = document.querySelector("#app");
const context = {
  state,
  refresh,
  render,
};
const { login, logout } = createLoginPage(context);
const { assignments, rows } = createAssignmentsPage(context);
const { employees } = createEmployeesPage(context);
const { teams } = createTeamsPage(context);
const { detail } = createAssignmentDetailPage(context);
const formContext = {
  state,
  modal: createModal(refresh),
};
async function refresh() {
  try {
    state.data = await api("data");
    render();
  } catch (error) {
    if (error.code === "SIGNED_OUT" || error.code === "MANAGER_REQUIRED") {
      state.data = null;
      login(error.code === "MANAGER_REQUIRED" ? error.message : "");
    } else {
      app.innerHTML = /* HTML */ `
        <div class="login panel">
          <h1>Unable to load workspace</h1>
          <p class="error">${escapeHtml(error.message)}</p>
          <button onclick="refresh()">Try again</button>
          <button class="secondary" onclick="logout()">Sign out</button>
        </div>
      `;
    }
  }
}
function render() {
  if (!state.data) return;
  const route = location.hash.slice(1) || "assignments";
  if (route.startsWith("assignment/"))
    return detail(Number(route.split("/")[1]));
  if (route === "employees") return employees();
  if (route === "teams") return teams();
  assignments();
}

// HTML templates call these named actions through their event attributes.
Object.assign(window, {
  refresh,
  logout,
  dialog,
  ...createEmployeeForms(formContext),
  ...createTeamForms(formContext),
  ...createAssignmentForms(formContext),
  ...createFeedbackForms(formContext),
  setSearch(value) {
    state.search = value;
    rows();
  },
  setFilter(value) {
    state.filter = value;
    rows();
  },
});
window.addEventListener("hashchange", render);
onSignedOut(() => {
  state.data = null;
  dialog.close();
  login();
});
if (configured) {
  refresh();
} else {
  app.innerHTML = /* HTML */ `
    <div class="login panel">
      <div class="brand"><span class="logo">w</span>workroom</div>
      <h1>Connect your workspace</h1>
      <p class="muted">
        Set the Supabase project URL and public key, then rebuild the frontend.
        Follow README.md to create the database and first manager account.
      </p>
    </div>
  `;
}
