import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import spriteEditorVite from "@msviderok/sprite-editor-vite";

export default defineConfig({
  plugins: [spriteEditorVite(), solid()],
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
