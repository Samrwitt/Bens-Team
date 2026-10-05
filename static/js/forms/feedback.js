import { attachmentPicker } from "../components/attachment-picker.js";
export function createFeedbackForms({ modal }) {
  function feedbackForm(assignment_id, parent_id) {
    modal(
      "Reply to feedback",
      `<label for="reply">Your reply</label><div class="feedback-input"><textarea id="reply" name="body" required></textarea><div class="composer-actions">${attachmentPicker("reply-files")}</div></div>`,
      "feedback",
      (d, form) => ({
        ...d,
        files: Array.from(form.elements.files.files),
        assignment_id,
        parent_id,
      }),
    );
  }
  return {
    feedbackForm,
  };
}
