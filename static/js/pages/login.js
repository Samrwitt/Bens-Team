import { api } from "../services/backend.js";
import { escapeHtml } from "../utils/format.js";
import { toast } from "../components/toast.js";
import { dialog } from "../components/modal.js";
const app = document.querySelector("#app");
export function createLoginPage({ state, refresh }) {
  function login(message = "") {
    app.innerHTML = /* HTML */ `<div class="login panel">
      <div class="brand"><span class="logo">w</span>workroom</div>
      <h1>Welcome back.</h1>
      <p class="muted">Sign in to your manager workspace.</p>
      <form id="login">
        <label for="email">Email</label
        ><input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="username"
        /><label for="password">Password</label
        ><input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
        />
        <div class="error" role="alert">${escapeHtml(message)}</div>
        <button>Sign in →</button>
      </form>

    </div>`;
    document.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("login", Object.fromEntries(new FormData(e.target)));
        await refresh();
      } catch (err) {
        document.querySelector(".error").textContent = err.message;
      }
    };
  }
  async function logout() {
    try {
      await api("logout", {});
      state.data = null;
      dialog.close();
      login();
    } catch (e) {
      toast(e.message);
    }
  }
  return {
    login,
    logout,
  };
}
