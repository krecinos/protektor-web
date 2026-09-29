const images = new Map();
const pins = new Map();
const svgUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

// Los SVG aislados no heredan variables CSS: resolvemos el token antes de componerlos.
function white() {
  return getComputedStyle(document.documentElement).getPropertyValue('--on-primary').trim();
}
const car = (color) => `<g fill="none" stroke="${escape(color)}" stroke-width="2" stroke-linejoin="round"><path d="M12 23v-6l3-6h14l3 6v6zM13 17h18M17 11l-2 6m12-6 2 6"/><path d="M14 23v3m16-3v3M15 20h2m10 0h2"/></g>`;

export function genericVehicleIcon() {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 7 28 24">${car(white())}</svg>`);
}

export function vehicleImage(icon) {
  const name = typeof icon === 'string' ? icon.trim() : '';
  if (!name || !/^[\w.-]+$/.test(name) || name === '.' || name === '..') return Promise.resolve(null);
  if (!images.has(name)) images.set(name, (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${window.location.origin}/gui/app/webroot/img/vehicles/${encodeURIComponent(name)}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Ícono no disponible');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Imagen inválida');
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      // También detecta respuestas exitosas cuyo contenido no es una imagen válida.
      const image = new Image();
      image.src = url;
      await image.decode();
      return url;
    } catch { return null; }
    finally { clearTimeout(timeout); }
  })());
  return images.get(name);
}

export function fallbackPin(color) {
  return composePin(color, null, white());
}

function composePin(color, image, border) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path d="M22 50C18 43 2 33 2 22a20 20 0 1 1 40 0c0 11-16 21-20 28Z" fill="${escape(color)}" stroke="${escape(border)}" stroke-width="2"/>${image ? `<circle cx="22" cy="21" r="15" fill="${escape(border)}"/><image href="${escape(image)}" x="8" y="7" width="28" height="28"/>` : car(border)}</svg>`);
}

export function markerIcon(icon, color) {
  const border = white();
  const key = JSON.stringify([icon, color, border]);
  if (!pins.has(key)) pins.set(key, vehicleImage(icon).then((image) => composePin(color, image, border)));
  return pins.get(key);
}
