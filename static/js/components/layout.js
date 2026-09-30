const app = document.querySelector("#app");
export function shell(page, content) {
  app.innerHTML = /* HTML */ `<aside>
      <a class="brand" href="#assignments"
        ><span class="logo">w</span>workroom</a
      >
      <div class="caption">Workspace</div>
      <nav>
        ${[
          ["assignments", "▤", "Assignments"],
          ["employees", "♙", "Employees"],
          ["teams", "▦", "Teams"],
        ]
          .map(
            ([p, icon, n]) =>
              /* HTML */ `<a href="#${p}" class="${p === page ? "active" : ""}"
                >${icon} &nbsp; ${n}</a
              >`,
          )
          .join("")}
      </nav>
      <div class="aside-bottom">
        <span class="avatar">M</span>Manager workspace
      </div>
    </aside>
    <main>
      <header class="topbar">
        <span
          >Workspace &nbsp; / &nbsp;
          ${page[0].toUpperCase() + page.slice(1)}</span
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
