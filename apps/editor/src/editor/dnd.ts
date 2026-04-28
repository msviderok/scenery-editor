import type { SpriteAsset } from "@msviderok/sprite-editor-ast-schema";
import { getAssetUrl } from "./assets";
import type { DragGhost, FolderSpriteSource } from "./types";

export const DND_TYPE_FOLDER_ASSET = "folder-asset";
export const DND_TYPE_PROJECT_ASSET = "project-asset";
export const DND_TYPE_SCENE_TAB = "scene-tab";
export const WORKSPACE_DROP_ZONE_ID = "workspace-dropzone";
export const SCENE_TABS_GROUP_ID = "scene-tabs";

export type FolderAssetDragData = {
  kind: typeof DND_TYPE_FOLDER_ASSET;
  sprite: FolderSpriteSource;
  previewUrl: string;
  imageUrl: string;
  previewWidth: number;
  previewHeight: number;
  naturalWidth?: number;
  naturalHeight?: number;
};

export type ProjectAssetDragData = {
  kind: typeof DND_TYPE_PROJECT_ASSET;
  assetId: string;
  previewUrl: string;
  imageUrl: string;
  previewWidth: number;
  previewHeight: number;
  naturalWidth: number;
  naturalHeight: number;
};

export type SceneTabDragData = {
  kind: typeof DND_TYPE_SCENE_TAB;
  sceneId: string;
  sceneName: string;
  sceneWidth: number;
  sceneHeight: number;
};

export type EditorDragData = FolderAssetDragData | ProjectAssetDragData | SceneTabDragData;
export type AssetDragData = FolderAssetDragData | ProjectAssetDragData;

export function getAssetPreviewSize(width: number, height: number) {
  const capHeight =
    typeof window === "undefined" ? 80 : Math.max(80, Math.floor(window.innerHeight * 0.2));
  const scale = Math.min(1, capHeight / Math.max(height, 1));

  return {
    width: Math.max(16, Math.round(width * scale)),
    height: Math.max(16, Math.round(height * scale)),
  };
}

export function createProjectAssetDragData(asset: SpriteAsset): ProjectAssetDragData {
  const preview = getAssetPreviewSize(asset.width, asset.height);

  return {
    kind: DND_TYPE_PROJECT_ASSET,
    assetId: asset.id,
    previewUrl: getAssetUrl(asset),
    imageUrl: getAssetUrl(asset),
    previewWidth: preview.width,
    previewHeight: preview.height,
    naturalWidth: asset.width,
    naturalHeight: asset.height,
  };
}

export function createAssetDragGhost(data: AssetDragData): DragGhost {
  return {
    x: 0,
    y: 0,
    width: data.previewWidth,
    height: data.previewHeight,
    imageUrl: data.imageUrl,
  };
}

export function isAssetDragData(value: unknown): value is AssetDragData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const kind = (value as { kind?: string }).kind;
  return kind === DND_TYPE_FOLDER_ASSET || kind === DND_TYPE_PROJECT_ASSET;
}

export function isSceneTabDragData(value: unknown): value is SceneTabDragData {
  return Boolean(
    value && typeof value === "object" && (value as { kind?: string }).kind === DND_TYPE_SCENE_TAB,
  );
}
