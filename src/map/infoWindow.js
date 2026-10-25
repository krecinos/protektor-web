export async function copyCoordinates(value) {
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(value); return; }
  } catch { /* Algunos navegadores deniegan el portapapeles incluso en HTTPS. */ }
  const previous = document.activeElement;
  const input = document.createElement("textarea");
  input.value = value;
  input.style.cssText = "position:fixed;left:-9999px;top:0";
  document.body.appendChild(input);
  input.select();
  try {
    if (!document.execCommand("copy")) throw new Error("No se pudo copiar");
  } finally {
    input.remove();
    previous?.focus();
  }
}
