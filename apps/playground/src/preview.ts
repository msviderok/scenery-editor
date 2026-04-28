import type { CSSProperties } from "react";
import type {
  BackgroundStyle,
  SpriteAsset,
  SpriteScene,
} from "@msviderok/sprite-editor-ast-schema";

export function getAssetUrl(asset: SpriteAsset | undefined): string {
  if (!asset) return "";
  return asset.url ?? asset.dataUrl ?? asset.sourcePath ?? "";
}

export function createNodeBackgroundStyle(
  asset: SpriteAsset | undefined,
  style: BackgroundStyle,
): CSSProperties {
  const backgroundImage =
    style.backgroundImage ?? (asset ? `url("${getAssetUrl(asset)}")` : undefined);
  const backgroundRepeat = style.backgroundRepeat ?? "no-repeat";
  const fallbackSize =
    backgroundRepeat !== "no-repeat" && asset ? `${asset.width}px ${asset.height}px` : "100% 100%";

  return {
    backgroundColor: style.backgroundColor ?? "transparent",
    backgroundImage,
    backgroundSize: style.backgroundSize ?? fallbackSize,
    backgroundRepeat,
    backgroundPosition: style.backgroundPosition ?? "center",
  };
}

export function createSceneBackgroundStyle(style: BackgroundStyle): CSSProperties {
  return {
    backgroundColor: style.backgroundColor ?? "#151515",
    backgroundImage: style.backgroundImage,
    backgroundSize: style.backgroundSize,
    backgroundRepeat: style.backgroundRepeat,
    backgroundPosition: style.backgroundPosition,
  };
}

export function fitSceneToViewport(
  scene: Pick<SpriteScene, "size">,
  viewport: { width: number; height: number },
  padding = 96,
): number {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const widthScale = availableWidth / Math.max(1, scene.size.width);
  const heightScale = availableHeight / Math.max(1, scene.size.height);
  return Math.max(0.1, Math.min(widthScale, heightScale));
}

export function fitSceneToViewportHeight(
  scene: Pick<SpriteScene, "size">,
  viewport: { height: number },
  padding = 0,
): number {
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const heightScale = availableHeight / Math.max(1, scene.size.height);
  return Math.max(0.1, heightScale);
}
