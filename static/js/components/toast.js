export function toast(message) {
  const t = document.querySelector("#toast");
  t.textContent = message;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
}
