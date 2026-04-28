import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    alias: {
      "@msviderok/sprite-editor-ast-schema": new URL(
        "../../packages/sprite-editor-ast-schema/src/index.ts",
        import.meta.url,
      ).pathname,
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: "es2022",
  },
});
