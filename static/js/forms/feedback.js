export function createFeedbackForms({ modal }) {
  function feedbackForm(assignment_id, parent_id) {
    modal(
      "Reply to feedback",
      '<label for="reply">Your reply</label><textarea id="reply" name="body" required></textarea>',
      "feedback",
      (d) => ({
        ...d,
        assignment_id,
        parent_id,
      }),
    );
  }
  return {
    feedbackForm,
  };
}
