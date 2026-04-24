import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { spriteEditorSpriteLibrary } from "../../packages/vite-plugin/src";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    spriteEditorSpriteLibrary(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
