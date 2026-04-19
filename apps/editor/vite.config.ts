import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";

const SPRITES_ROUTE_PREFIX = "/__sprite-editor__/sprites/";
const SPRITES_MANIFEST_ROUTE = "/__sprite-editor__/sprites.json";
const SPRITES_ROOT = path.resolve(__dirname, "../../sprites");

type SpriteLibraryEntry = {
  id: string;
  fileName: string;
  relativePath: string;
  sourcePath: string;
  url: string;
  mimeType: string;
};

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

async function walkSpritesDirectory(dir: string, rootDir: string): Promise<SpriteLibraryEntry[]> {
  let entries: SpriteLibraryEntry[] = [];
  let dirents: Awaited<ReturnType<typeof readdir>>;

  try {
    dirents = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const dirent of dirents) {
    const absolutePath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      entries = entries.concat(await walkSpritesDirectory(absolutePath, rootDir));
      continue;
    }
    const ext = path.extname(dirent.name).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) continue;

    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join("/");
    entries.push({
      id: `folder:${relativePath}`,
      fileName: dirent.name,
      relativePath,
      sourcePath: absolutePath,
      url: `${SPRITES_ROUTE_PREFIX}${relativePath}`,
      mimeType,
    });
  }

  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function spriteLibraryPlugin(): Plugin {
  const handleRequest = async (url: string, res: NodeJS.WritableStream & { statusCode?: number; setHeader(name: string, value: string): void; end(chunk?: string): void; }) => {
    const pathname = url.split("?")[0];
    if (pathname === SPRITES_MANIFEST_ROUTE) {
      const entries = await walkSpritesDirectory(SPRITES_ROOT, SPRITES_ROOT);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(entries));
      return true;
    }

    if (!pathname.startsWith(SPRITES_ROUTE_PREFIX)) {
      return false;
    }

    const relativePath = decodeURIComponent(pathname.slice(SPRITES_ROUTE_PREFIX.length));
    const filePath = path.resolve(SPRITES_ROOT, relativePath);
    if (!filePath.startsWith(SPRITES_ROOT)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return true;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        res.statusCode = 404;
        res.end("Not found");
        return true;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
      createReadStream(filePath).pipe(res);
      return true;
    } catch {
      res.statusCode = 404;
      res.end("Not found");
      return true;
    }
  };

  return {
    name: "sprite-library",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        void handleRequest(req.url, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        void handleRequest(req.url, res).then((handled) => {
          if (!handled) next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), solid(), spriteLibraryPlugin()],
  server: {
    host: true,
  },
  build: {
    target: "es2022",
  },
});
