export function createFeedbackForms({ modal }) {
  function feedbackForm(assignment_id, parent_id) {
    modal(
      "Reply to feedback",
      '<label for="reply">Your reply</label><textarea id="reply" name="body" required></textarea><label for="reply-files">Attachments</label><input id="reply-files" name="files" type="file" multiple><small>Up to 10 files, 20 MB each. Images, PDFs, code, and other files.</small>',
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
