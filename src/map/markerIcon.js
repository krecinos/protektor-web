const svgUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

export function markerIcon(color, selected = false) {
  const fill = String(color).replace(/[^#a-zA-Z0-9]/g, "");
  // El lienzo deja espacio para la sombra y el halo sin recortarlos.
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".22"/></filter></defs>${selected ? `<circle cx="18" cy="18" r="17" fill="${fill}" fill-opacity=".2"/>` : ""}<circle cx="18" cy="18" r="${selected ? 11 : 9}" fill="${fill}" stroke="#fff" stroke-width="2" filter="url(#shadow)"/></svg>`);
}
