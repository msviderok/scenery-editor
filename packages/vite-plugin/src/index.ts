import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { parseSpriteProject, type ResolvedSpriteProject } from "../../../shared/ast";

const VIRTUAL_PROJECT_PREFIX = "\0sprite-editor-project:";
const SPRITES_ROUTE_PREFIX = "/__sprite-editor__/sprites/";
const SPRITES_MANIFEST_ROUTE = "/__sprite-editor__/sprites.json";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function toPosixPath(value: string) {
  return value.split(path.sep).join("/");
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL in sprite asset.");
  }
  const mimeType = match[1] ?? "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { buffer, mimeType };
}

function extFromFileName(fileName: string) {
  const ext = path.extname(fileName);
  return ext || ".bin";
}

export type SpriteLibraryEntry = {
  id: string;
  fileName: string;
  relativePath: string;
  sourcePath: string;
  url: string;
  mimeType: string;
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

type SpriteLibraryPluginOptions = {
  spritesRoot?: string;
};

export function spriteEditorSpriteLibrary(options: SpriteLibraryPluginOptions = {}): Plugin {
  let spritesRoot = path.resolve(process.cwd(), "sprites");

  const handleRequest = async (
    url: string,
    res: NodeJS.WritableStream & {
      statusCode?: number;
      setHeader(name: string, value: string): void;
      end(chunk?: string): void;
    }
  ) => {
    const pathname = url.split("?")[0];
    if (pathname === SPRITES_MANIFEST_ROUTE) {
      const entries = await walkSpritesDirectory(spritesRoot, spritesRoot);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(entries));
      return true;
    }

    if (!pathname.startsWith(SPRITES_ROUTE_PREFIX)) {
      return false;
    }

    const relativePath = decodeURIComponent(pathname.slice(SPRITES_ROUTE_PREFIX.length));
    const filePath = path.resolve(spritesRoot, relativePath);
    if (!filePath.startsWith(spritesRoot)) {
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
      res.setHeader(
        "Content-Type",
        MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
      );
      createReadStream(filePath).pipe(res);
      return true;
    } catch {
      res.statusCode = 404;
      res.end("Not found");
      return true;
    }
  };

  return {
    name: "sprite-editor-sprite-library",
    configResolved(config) {
      spritesRoot = options.spritesRoot ?? path.resolve(config.root, "../../sprites");
    },
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

export function spriteEditorVite(): Plugin {
  let root = process.cwd();

  return {
    name: "sprite-editor-vite",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    async resolveId(source, importer) {
      if (!source.endsWith(".sprite.json")) {
        return null;
      }

      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved) {
        return null;
      }

      return `${VIRTUAL_PROJECT_PREFIX}${Buffer.from(resolved.id, "utf8").toString("base64url")}`;
    },
    async load(id) {
      if (!id.startsWith(VIRTUAL_PROJECT_PREFIX)) {
        return null;
      }

      const cleanId = Buffer.from(id.slice(VIRTUAL_PROJECT_PREFIX.length), "base64url")
        .toString("utf8")
        .split("?")[0];
      this.addWatchFile(cleanId);
      const raw = await readFile(cleanId, "utf8");
      const project = parseSpriteProject(JSON.parse(raw));
      const outputDir = path.join(root, ".sprite-editor", "generated", "assets");
      await mkdir(outputDir, { recursive: true });

      const assets = await Promise.all(
        Object.entries(project.assets).map(async ([assetId, asset]) => {
          let bytes: Buffer;
          if (asset.sourcePath) {
            this.addWatchFile(asset.sourcePath);
            bytes = await readFile(asset.sourcePath);
          } else if (asset.dataUrl) {
            bytes = parseDataUrl(asset.dataUrl).buffer;
          } else {
            throw new Error(`Asset ${assetId} has neither sourcePath nor dataUrl.`);
          }

          const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 12);
          const fileName = `${hash}${extFromFileName(asset.fileName)}`;
          const filePath = path.join(outputDir, fileName);
          await writeFile(filePath, bytes);
          return [
            assetId,
            {
              ...asset,
              resolvedUrl: `/${toPosixPath(path.relative(root, filePath))}`,
            },
          ] as const;
        }),
      );

      const resolvedProject: ResolvedSpriteProject = {
        ...project,
        assets: Object.fromEntries(assets),
      };

      return `export default ${JSON.stringify(resolvedProject, null, 2)};`;
    },
  };
}

export default spriteEditorVite;
