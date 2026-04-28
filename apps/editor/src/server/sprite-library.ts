import { createReadStream, type Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

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

export type SpriteLibraryEntry = {
  id: string;
  fileName: string;
  relativePath: string;
  sourcePath: string;
  url: string;
  mimeType: string;
};

export function getSpritesRoot() {
  return path.resolve(process.cwd(), "../../sprites");
}

function isSafeChildPath(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function walkSpritesDirectory(
  dir: string,
  rootDir: string,
  entries: SpriteLibraryEntry[],
): Promise<void> {
  let dirents: Dirent[];

  try {
    dirents = await readdir(dir, { encoding: "utf8", withFileTypes: true });
  } catch {
    return;
  }

  for (const dirent of dirents) {
    const absolutePath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      await walkSpritesDirectory(absolutePath, rootDir, entries);
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
}

export async function listSpriteEntries(rootDir = getSpritesRoot()) {
  const entries: SpriteLibraryEntry[] = [];
  await walkSpritesDirectory(rootDir, rootDir, entries);
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function createSpriteManifestResponse() {
  const entries = await listSpriteEntries();
  return Response.json(entries, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function resolveSpriteFile(relativePath: string, rootDir = getSpritesRoot()) {
  const decodedPath = decodeURIComponent(relativePath);
  const filePath = path.resolve(rootDir, decodedPath);

  if (!isSafeChildPath(rootDir, filePath)) {
    return { kind: "forbidden" as const };
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return { kind: "not-found" as const };
    }

    return {
      kind: "file" as const,
      filePath,
      mimeType: MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    };
  } catch {
    return { kind: "not-found" as const };
  }
}

export async function createSpriteFileResponse(relativePath: string) {
  const resolved = await resolveSpriteFile(relativePath);
  if (resolved.kind === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }
  if (resolved.kind === "not-found") {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Readable.toWeb(createReadStream(resolved.filePath)) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": resolved.mimeType,
      "Cache-Control": "no-store",
    },
  });
}

export { SPRITES_MANIFEST_ROUTE };
