export const $ = (selector) => document.querySelector(selector);

/** Devuelve una función `status(text, error)` ligada a la barra de estado; un texto vacío la oculta. */
export function createStatus(element) {
  return (text = '', error = false) => {
    element.textContent = text;
    element.hidden = !text;
    element.classList.toggle('error', error);
  };
}
