import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Vercel sirve en la raíz ("/"). Para GitHub Pages se pasa VITE_BASE=/Observatorio-2026/.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
});
