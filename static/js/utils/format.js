export const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
export const formatAssignmentId = (id) => "ASG-" + String(id).padStart(4, "0");
export const getInitials = (n) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const owner = (a, data) =>
  a.employee_id
    ? data.employees.find((e) => e.id === a.employee_id)?.name
    : data.teams.find((t) => t.id === a.team_id)?.name;
export const statusBadge = (s) =>
  /* HTML */ `<span
    class="badge ${s === "Done"
      ? "done"
      : s === "In progress"
        ? "progress"
        : ""}"
    >${escapeHtml(s)}</span
  >`;
