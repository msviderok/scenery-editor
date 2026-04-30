import { createFileRoute } from "@tanstack/react-router";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export const Route = createFileRoute("/api/uploadthing/files")({
  server: {
    handlers: {
      GET: async () => {
        const { files } = await utapi.listFiles();
        const withUrls = files.map((file) => ({
          key: file.key,
          name: file.name,
          size: file.size,
          status: file.status,
          url: `https://utfs.io/f/${file.key}`,
        }));

        return Response.json(withUrls);
      },
      DELETE: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          key?: unknown;
          keys?: unknown;
        } | null;
        const singleKey = typeof body?.key === "string" ? body.key : null;
        const keysArray = Array.isArray(body?.keys)
          ? (body.keys.filter((entry): entry is string => typeof entry === "string") as string[])
          : [];
        const target = keysArray.length > 0 ? keysArray : singleKey ? [singleKey] : [];

        if (target.length === 0) {
          return Response.json({ error: "Missing UploadThing file key(s)." }, { status: 400 });
        }

        const result = await utapi.deleteFiles(target);
        return Response.json(result);
      },
    },
  },
});
