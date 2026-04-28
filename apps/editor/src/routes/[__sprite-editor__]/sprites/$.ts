import { createFileRoute } from "@tanstack/react-router";
import { createSpriteFileResponse } from "@/server/sprite-library";

export const Route = createFileRoute("/__sprite-editor__/sprites/$")({
  server: {
    handlers: {
      GET: async ({ params }) => createSpriteFileResponse(params._splat ?? ""),
    },
  },
});
