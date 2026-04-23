import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { spriteEditorSpriteLibrary } from "../../packages/vite-plugin/src";

export default defineConfig({
  plugins: [tailwindcss(), solid(), spriteEditorSpriteLibrary()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
