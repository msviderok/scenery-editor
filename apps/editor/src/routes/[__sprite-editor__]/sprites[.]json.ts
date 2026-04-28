import { createFileRoute } from "@tanstack/react-router";
import { createSpriteManifestResponse } from "@/server/sprite-library";

export const Route = createFileRoute("/__sprite-editor__/sprites.json")({
  server: {
    handlers: {
      GET: async () => createSpriteManifestResponse(),
    },
  },
});
