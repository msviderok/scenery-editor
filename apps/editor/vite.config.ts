import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { spriteEditorSpriteLibrary } from "@msviderok/2d-scene-transform-vite-plugin";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    spriteEditorSpriteLibrary(),
  ],
  resolve: {
    alias: {
      "@msviderok/sprite-editor-ast-schema": new URL(
        "../../packages/sprite-editor-ast-schema/src/index.ts",
        import.meta.url,
      ).pathname,
    },
    tsconfigPaths: true,
  },
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
