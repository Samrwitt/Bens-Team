// Application entry point: session loading, routing, and UI action wiring.
import { api, configured, onSignedOut } from "./js/services/backend.js";
import { state, resetWorkspace } from "./js/state.js";
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
  const requestId = ++state.requestId;
  try {
    const data = await api("data");
    if (requestId !== state.requestId) return;
    state.data = data;
    render();
  } catch (error) {
    if (requestId !== state.requestId) return;
    if (error.code === "SIGNED_OUT" || error.code === "PROFILE_REQUIRED") {
      state.data = null;
      login(error.code === "PROFILE_REQUIRED" ? error.message : "");
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
  if (dialog.querySelector("#assignment-analysis")) {
    dialog.close();
    dialog.innerHTML = "";
    dialog.removeAttribute("aria-label");
    dialog.oncancel = null;
  }
  const route = location.hash.slice(1) || "assignments";
  if (route.startsWith("assignment/"))
    return detail(Number(route.split("/")[1]));
  if (state.data.profile.role === "manager" && route === "employees")
    return employees();
  if (state.data.profile.role === "manager" && route === "teams")
    return teams();
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
  resetWorkspace();
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
