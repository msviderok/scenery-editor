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
    alias: {
      "@msviderok/sprite-editor-ast": new URL("../../packages/ast/src/index.ts", import.meta.url)
        .pathname,
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
