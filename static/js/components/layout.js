import { state } from "../state.js";
import { escapeHtml, getInitials } from "../utils/format.js";
const app = document.querySelector("#app");
export function shell(page, content) {
  const manager = state.data.profile.role === "manager";
  const navigation = manager
    ? [
        ["assignments", "▤", "Assignments"],
        ["employees", "♙", "Employees"],
        ["teams", "▦", "Teams"],
      ]
    : [["assignments", "▤", "My assignments"]];
  app.innerHTML = /* HTML */ `<aside>
      <a class="brand" href="#assignments"
        ><span class="logo">w</span>workroom</a
      >
      <div class="caption">Workspace</div>
      <nav>
        ${navigation
          .map(
            ([p, icon, n]) =>
              /* HTML */ `<a href="#${p}" class="${p === page ? "active" : ""}"
                >${icon} &nbsp; ${n}</a
              >`,
          )
          .join("")}
      </nav>
      <div class="aside-bottom">
        <span class="avatar"
          >${escapeHtml(getInitials(state.data.profile.name))}</span
        >${manager ? "Manager workspace" : "Employee workspace"}
      </div>
    </aside>
    <main>
      <header class="topbar">
        <span
          >Workspace &nbsp; / &nbsp;
          ${!manager && page === "assignments"
            ? "My assignments"
            : page[0].toUpperCase() + page.slice(1)}</span
        ><button onclick="logout()">Sign out ↗</button>
      </header>
      ${content}
    </main>`;
}
export function heading(title, subtitle, button = "") {
  return /* HTML */ `<div class="heading">
    <div>
      <h1>${title}</h1>
      <p class="muted">${subtitle}</p>
    </div>
    ${button}
  </div>`;
}
