import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { parseSpriteProject, type ResolvedSpriteProject } from "../../../shared/ast";

const VIRTUAL_PROJECT_PREFIX = "\0sprite-editor-project:";

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
