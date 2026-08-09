import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "/v2/": el bundle se sirve en app.protektor.com.gt/v2/ — el MISMO origen
// que el GUI legacy, para que la cookie PHPSESSID viaje sola y el front no
// tenga que guardar ningún secreto.
export default defineConfig({
  base: "/v2/",
  plugins: [react()],
  server: {
    // En desarrollo, /api/v2 se reenvía a producción para trabajar contra datos
    // reales sin levantar la API local. Se manda la cookie del navegador.
    proxy: {
      "/api/v2": {
        target: "https://app.protektor.com.gt",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
