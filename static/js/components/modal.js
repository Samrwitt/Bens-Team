import { state } from "../state.js";
import { api } from "../services/backend.js";
import { toast } from "./toast.js";
import { bindAttachmentPickers } from "./attachment-picker.js";
export const dialog = document.querySelector("#dialog");
export function createModal(refresh) {
  function modal(title, fields, endpoint, transform = (x) => x) {
    if (
      !state.data ||
      (endpoint !== "feedback" && state.data.profile.role !== "manager")
    )
      return;
    dialog.oncancel = null;
    dialog.removeAttribute("aria-label");
    dialog.innerHTML = /* HTML */ `<h2>${title}</h2>
      <form>
        ${fields}
        <div class="error" role="alert"></div>
        <div class="actions">
          <button type="button" class="secondary" onclick="dialog.close()">
            Cancel</button
          ><button>Save</button>
        </div>
      </form>`;
    dialog.showModal();
    bindAttachmentPickers(dialog);
    dialog.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const button = e.target.querySelector("button:last-child");
      button.disabled = true;
      try {
        await api(
          endpoint,
          transform(Object.fromEntries(new FormData(e.target)), e.target),
        );
        dialog.close();
        await refresh();
        toast("Saved successfully");
      } catch (err) {
        dialog.querySelector(".error").textContent = err.message;
      } finally {
        button.disabled = false;
      }
    };
  }
  return modal;
}
