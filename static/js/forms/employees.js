import { field } from "../components/field.js";
export function createEmployeeForms({ modal }) {
  function employeeForm() {
    modal(
      "Add employee",
      field("Full name", "name") +
        field("Email / sign-in", "email", "email") +
        field(
          "Initial password",
          "password",
          "password",
          'minlength="10" autocomplete="new-password"',
        ) +
        '<p class="muted" style="font-size:12px;margin-top:10px">At least 10 characters. Share this password with the employee privately.</p>',
      "employees",
    );
  }
  function passwordForm(id) {
    modal(
      "Reset employee password",
      field(
        "New password",
        "password",
        "password",
        'minlength="10" autocomplete="new-password"',
      ),
      "password",
      (d) => ({
        ...d,
        id,
      }),
    );
  }
  return {
    employeeForm,
    passwordForm,
  };
}
