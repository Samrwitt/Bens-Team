export function attachmentPicker(id) {
  return `<input id="${id}" name="files" type="file" multiple hidden aria-label="Attachments">
    <button type="button" class="secondary attachment-button" data-pick-files="${id}" aria-label="Attach files" title="Attach images or files · up to 10 files, 20 MB each"><span aria-hidden="true">📎</span></button>
    <span class="selected-files muted" data-selected-files="${id}" aria-live="polite"></span>`;
}

export function bindAttachmentPickers(container) {
  container.querySelectorAll("[data-pick-files]").forEach((button) => {
    const input = container.querySelector(`#${button.dataset.pickFiles}`);
    const summary = container.querySelector(`[data-selected-files="${button.dataset.pickFiles}"]`);
    button.onclick = () => input.click();
    input.onchange = () => {
      const files = Array.from(input.files);
      summary.textContent = files.map((file) => file.name).join(", ");
      summary.title = files.map((file) => file.name).join(", ");
      button.setAttribute("aria-label", files.length ? `Attach files (${files.length} selected)` : "Attach files");
    };
  });
}
