export const field = (label, name, type = "text", extra = "") =>
  /* HTML */ `<label for="f-${name}">${label}</label
    ><input id="f-${name}" name="${name}" type="${type}" required ${extra} />`;
