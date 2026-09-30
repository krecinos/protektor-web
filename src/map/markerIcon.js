const svgUrl = (svg) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

export function markerIcon(color, selected = false) {
  const fill = String(color).replace(/[^#a-zA-Z0-9]/g, "");
  // El lienzo deja espacio para la sombra y el halo sin recortarlos.
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".22"/></filter></defs>${selected ? `<circle cx="17" cy="17" r="16" fill="${fill}" fill-opacity=".25"/>` : ""}<path d="M17 39C14 34 4 24 4 17a13 13 0 0 1 26 0c0 7-10 17-13 22Z" fill="${fill}" stroke="#fff" stroke-width="2" stroke-linejoin="round" filter="url(#shadow)"/><circle cx="17" cy="17" r="4" fill="#fff"/></svg>`);
}

export function clusterIcon(count, color, foreground) {
  const size = 34 + 2 * String(count).length;
  const fill = String(color).replace(/[^#a-zA-Z0-9(),.%\s-]/g, "");
  const ink = String(foreground).replace(/[^#a-zA-Z0-9(),.%\s-]/g, "");
  const center = size / 2;
  return {
    size,
    url: svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${center}" cy="${center}" r="${center - 2}" fill="${fill}" stroke="${ink}" stroke-width="2"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${ink}">${count}</text></svg>`),
  };
}
