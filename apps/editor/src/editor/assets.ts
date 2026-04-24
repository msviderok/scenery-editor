import type { CSSProperties } from "react";
import {
  createDefaultCollision,
  serializeSpriteProject,
  type BackgroundStyle,
  type SpriteAsset,
  type SpriteProject,
} from "../../../../shared/ast";

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Expected FileReader result to be a data URL string."));
    reader.readAsDataURL(file);
  });
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      void blob
        .arrayBuffer()
        .then((arrayBuffer) => {
          const bytes = new Uint8Array(arrayBuffer);
          const BufferCtor = (
            globalThis as typeof globalThis & {
              Buffer?: { from(data: Uint8Array): { toString(encoding: "base64"): string } };
            }
          ).Buffer;
          const base64 = BufferCtor
            ? BufferCtor.from(bytes).toString("base64")
            : btoa(String.fromCharCode(...bytes));
          resolve(`data:${blob.type || "application/octet-stream"};base64,${base64}`);
        })
        .catch(reject);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Expected FileReader result to be a data URL string."));
    reader.readAsDataURL(blob);
  });
}

export async function fetchAsDataUrl(
  url: string,
  mimeType?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset at ${url} (status ${response.status}).`);
  }
  const blob = await response.blob();
  const typed = mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob;
  return blobToDataUrl(typed);
}

export function readImageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Failed to read image dimensions."));
    image.src = url;
  });
}

export function getAssetUrl(asset: SpriteAsset | undefined): string {
  if (!asset) return "";
  return asset.url ?? asset.dataUrl ?? asset.sourcePath ?? "";
}

export function createNodeBackground(
  asset: SpriteAsset | undefined,
  style: BackgroundStyle,
): CSSProperties {
  const image = style.backgroundImage ?? (asset ? `url("${getAssetUrl(asset)}")` : undefined);
  return {
    backgroundColor: style.backgroundColor ?? "transparent",
    backgroundImage: image,
    backgroundSize: style.backgroundSize ?? "100% 100%",
    backgroundRepeat: style.backgroundRepeat ?? "no-repeat",
    backgroundPosition: style.backgroundPosition ?? "center",
  };
}

export function createSceneBackground(style: BackgroundStyle): CSSProperties {
  return {
    backgroundColor: style.backgroundColor ?? "#151515",
    backgroundImage: style.backgroundImage,
    backgroundSize: style.backgroundSize,
    backgroundRepeat: style.backgroundRepeat,
    backgroundPosition: style.backgroundPosition,
  };
}

export function createPlacedNode(asset: SpriteAsset, nodeId: string, x: number, y: number) {
  return {
    id: nodeId,
    assetId: asset.id,
    x,
    y,
    width: asset.width,
    height: asset.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    collisions: createDefaultCollision(),
    style: {
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    },
  };
}

export async function buildEmbeddedExportProject(
  project: SpriteProject,
  fetchImpl: typeof fetch = fetch,
) {
  const embeddedAssets: Record<string, SpriteAsset> = {};

  for (const [assetId, asset] of Object.entries(project.assets)) {
    if (asset.dataUrl) {
      embeddedAssets[assetId] = {
        id: asset.id,
        kind: asset.kind,
        fileName: asset.fileName,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType,
        dataUrl: asset.dataUrl,
      };
      continue;
    }

    const fetchUrl = asset.url ?? asset.sourcePath;
    if (!fetchUrl) {
      throw new Error(`Asset ${assetId} has no url, sourcePath, or dataUrl to export.`);
    }

    embeddedAssets[assetId] = {
      id: asset.id,
      kind: asset.kind,
      fileName: asset.fileName,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
      dataUrl: await fetchAsDataUrl(fetchUrl, asset.mimeType, fetchImpl),
    };
  }

  return {
    ...project,
    assets: embeddedAssets,
  } satisfies SpriteProject;
}

export function serializeEmbeddedProject(project: SpriteProject) {
  return serializeSpriteProject(project);
}
