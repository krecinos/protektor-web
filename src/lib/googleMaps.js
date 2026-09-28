let mapsPromise;

export function loadGoogleMaps() {
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const callback = "__protektorGoogleMapsReady";
    const timeout = window.setTimeout(() => reject(new Error("Google Maps tardó demasiado en responder.")), 30000);
    window[callback] = () => {
      clearTimeout(timeout);
      delete window[callback];
      resolve(window.google.maps);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      delete window[callback];
      reject(new Error("No se pudo cargar Google Maps."));
    };
    const key = import.meta.env.VITE_GMAPS_KEY || "AIzaSyCPfKYOv6_1qUqpN4DGMsnhI4Et2wTt0VA";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${callback}&v=weekly&language=es&region=GT`;
    script.async = true;
    document.head.appendChild(script);
  });
  return mapsPromise;
}
