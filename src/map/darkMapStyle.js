// Estilo oscuro de Google Maps alineado con la paleta de la app.
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0d1424" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8b9ab3" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1424" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#27324a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#b6c3da" }] },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#10241f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1a2540" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0d1424" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7d8ca8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#26365c" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#a9b9d6" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#06101f" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5d80" }] },
];
