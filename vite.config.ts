import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["apps/editor/src/routeTree.gen.ts"],
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  pack: {
    format: "esm",
    dts: true,
    sourcemap: true,
  },
  run: {
    cache: true,
    tasks: {
      build: {
        command: "vp run -v editor#build",
        dependsOn: [
          "@msviderok/sprite-editor-ast-schema#build",
          "@msviderok/2d-scene-transform-vite-plugin#build",
        ],
      },
    },
  },
});
