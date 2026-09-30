// Un único catálogo de trazos para React y el contenido DOM del mapa.
const paths = {
  "map-pin": ["M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  "layout-dashboard": ["M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"],
  "clipboard-list": ["M9 5H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3", "M10 2h4a1 1 0 0 1 1 1v3H9V3a1 1 0 0 1 1-1ZM12 11h4M12 16h4M8 11h.01M8 16h.01"],
  radio: ["M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0", "M16.24 7.76a6 6 0 0 1 0 8.48M7.76 16.24a6 6 0 0 1 0-8.48M19.07 4.93a10 10 0 0 1 0 14.14M4.93 19.07a10 10 0 0 1 0-14.14"],
  menu: ["M4 6h16M4 12h16M4 18h16"],
  navigation: ["m3 11 19-9-9 19-2-8-8-2Z"],
  map: ["m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6ZM9 3v15M15 6v15"],
  copy: ["M9 9h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9Z", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
  route: ["M7 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0", "M7 18h10a5 5 0 0 0 0-10H7a3 3 0 0 1 0-6h10"],
  x: ["M18 6 6 18M6 6l12 12"],
  search: ["M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0M21 21l-4.3-4.3"],
  battery: ["M3 7h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM22 11v2"],
  gauge: ["m12 14 4-4", "M3.34 19a10 10 0 1 1 17.32 0Z"],
  clock: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "message-square": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"],
  "refresh-cw": ["M3 11a9 9 0 0 1 15-6l3 3M21 3v5h-5M21 13a9 9 0 0 1-15 6l-3-3M3 21v-5h5"],
  calendar: ["M8 2v4M16 2v4M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"],
  circle: ["M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"],
};

const attributes = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  "aria-hidden": "true", focusable: "false",
};

export default function Icon({ name, size = 18, className = "", ...props }) {
  return <svg {...attributes} width={size} height={size} className={`icon ${className}`.trim()} {...props}>
    {paths[name]?.map((d, index) => <path key={index} d={d} />)}
  </svg>;
}

// Construimos nodos SVG sin interpolar datos del vehículo en HTML.
export function createIcon(name, size = 18) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [key, value] of Object.entries({ ...attributes, width: size, height: size, class: "icon" })) {
    const attribute = key === "viewBox" ? key : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    svg.setAttribute(attribute, String(value));
  }
  for (const d of paths[name] ?? []) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
