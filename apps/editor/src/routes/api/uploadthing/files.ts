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
        const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
        const key = typeof body?.key === "string" ? body.key : null;

        if (!key) {
          return Response.json({ error: "Missing UploadThing file key." }, { status: 400 });
        }

        const result = await utapi.deleteFiles(key);
        return Response.json(result);
      },
    },
  },
});
