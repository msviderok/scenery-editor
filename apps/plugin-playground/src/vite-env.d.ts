/// <reference types="vite/client" />

declare module "*.sprite.json" {
  import type { ResolvedSpriteProject } from "../../../shared/ast";

  const project: ResolvedSpriteProject;
  export default project;
}
