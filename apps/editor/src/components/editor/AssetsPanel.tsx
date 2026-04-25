import { ChevronRight, RefreshCw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/react";
import type { SpriteAsset } from "../../../../../shared/ast";
import { getAssetUrl, readImageSize } from "@/editor/assets";
import {
  DND_TYPE_FOLDER_ASSET,
  createProjectAssetDragData,
  getAssetPreviewSize,
  type AssetDragData,
  type FolderAssetDragData,
} from "@/editor/dnd";
import type { FolderSpriteSource } from "@/editor/types";

type AssetsPanelProps = {
  folderSprites: FolderSpriteSource[];
  projectAssets: SpriteAsset[];
  projectAssetsBySourcePath: Map<string, SpriteAsset>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  onRefresh: () => void;
  onUploadFiles: (files: FileList | null) => void;
};

type FolderGroup = {
  key: string;
  label: string;
  sprites: FolderSpriteSource[];
};

function groupSprites(sprites: FolderSpriteSource[]): FolderGroup[] {
  const buckets = new Map<string, FolderSpriteSource[]>();

  for (const sprite of sprites) {
    const segments = sprite.relativePath.split("/").filter(Boolean);
    const folder = segments.length > 1 ? segments.slice(0, -1).join("/") : "root";
    const list = buckets.get(folder) ?? [];
    list.push(sprite);
    buckets.set(folder, list);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => ({
      key,
      label: key === "root" ? "Sprites" : key.replaceAll(/[-_]/g, " "),
      sprites: group.sort((left, right) => left.fileName.localeCompare(right.fileName)),
    }));
}

function FolderHeader(props: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { label, count, open, onToggle } = props;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-3 py-1 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/38 transition-colors hover:text-white/68"
    >
      <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
      <span className="flex-1 text-left">{label}</span>
      <span className="font-mono text-[10px] text-white/28">{count}</span>
    </button>
  );
}

function AssetRow(props: { label: string; previewUrl: string; dragData: AssetDragData }) {
  const { label, previewUrl, dragData } = props;
  const { ref, isDragging } = useDraggable({
    id:
      dragData.kind === DND_TYPE_FOLDER_ASSET
        ? `folder-asset:${dragData.sprite.id}`
        : `project-asset:${dragData.assetId}`,
    type: dragData.kind,
    data: dragData,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`flex w-full touch-none cursor-grab items-center gap-2 px-4 py-1.5 text-left text-white/58 transition-[color,opacity,background-color] hover:bg-white/[0.04] hover:text-white/86 active:cursor-grabbing ${
        isDragging ? "opacity-35" : ""
      }`}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden border border-white/12 bg-white/[0.03]">
        {previewUrl ? (
          <img
            alt={label}
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
            draggable={false}
            src={previewUrl}
          />
        ) : null}
      </span>
      <span className="truncate font-mono text-[11px]">{label}</span>
    </button>
  );
}

function FolderAssetRow(props: {
  sprite: FolderSpriteSource;
  existingAsset: SpriteAsset | undefined;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
}) {
  const { sprite, existingAsset, folderSpriteSizeCacheRef } = props;
  const [measuredSize, setMeasuredSize] = useState<{ width: number; height: number } | null>(() =>
    existingAsset
      ? { width: existingAsset.width, height: existingAsset.height }
      : (folderSpriteSizeCacheRef.current.get(sprite.url) ?? null),
  );

  useEffect(() => {
    if (existingAsset) {
      setMeasuredSize({ width: existingAsset.width, height: existingAsset.height });
      return;
    }

    const cached = folderSpriteSizeCacheRef.current.get(sprite.url);
    if (cached) {
      setMeasuredSize(cached);
      return;
    }

    let cancelled = false;

    void readImageSize(sprite.url)
      .then((size) => {
        folderSpriteSizeCacheRef.current.set(sprite.url, size);
        if (!cancelled) {
          setMeasuredSize(size);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [existingAsset, folderSpriteSizeCacheRef, sprite.url]);

  const naturalWidth = measuredSize?.width ?? 64;
  const naturalHeight = measuredSize?.height ?? 64;
  const preview = getAssetPreviewSize(naturalWidth, naturalHeight);

  const dragData: FolderAssetDragData = {
    kind: DND_TYPE_FOLDER_ASSET,
    sprite,
    previewUrl: sprite.url,
    imageUrl: sprite.url,
    previewWidth: preview.width,
    previewHeight: preview.height,
    naturalWidth: measuredSize?.width,
    naturalHeight: measuredSize?.height,
  };

  return <AssetRow label={sprite.fileName} previewUrl={sprite.url} dragData={dragData} />;
}

export function AssetsPanel(props: AssetsPanelProps) {
  const {
    folderSprites,
    projectAssets,
    projectAssetsBySourcePath,
    folderSpriteSizeCacheRef,
    onRefresh,
    onUploadFiles,
  } = props;

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => groupSprites(folderSprites), [folderSprites]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    root: true,
    posters: true,
    textures: true,
    "in-project": true,
  });

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
          Assets
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Refresh sprite folder"
            className="sb-icon-button"
            onClick={onRefresh}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Upload images"
            className="sb-icon-button"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
          </button>
          <input
            ref={uploadInputRef}
            hidden
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              onUploadFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2 [scrollbar-width:thin]">
        {groups.map((group) => {
          const open = openGroups[group.key] ?? true;

          return (
            <div key={group.key} className="pb-1">
              <FolderHeader
                label={group.label}
                count={group.sprites.length}
                open={open}
                onToggle={() =>
                  setOpenGroups((current) => ({
                    ...current,
                    [group.key]: !open,
                  }))
                }
              />

              {open ? (
                <div className="flex flex-col">
                  {group.sprites.map((sprite) => (
                    <FolderAssetRow
                      key={sprite.id}
                      sprite={sprite}
                      existingAsset={projectAssetsBySourcePath.get(sprite.sourcePath)}
                      folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {projectAssets.length ? (
          <div className="pt-1">
            <FolderHeader
              label="In Project"
              count={projectAssets.length}
              open={openGroups["in-project"] ?? true}
              onToggle={() =>
                setOpenGroups((current) => ({
                  ...current,
                  "in-project": !(current["in-project"] ?? true),
                }))
              }
            />

            {(openGroups["in-project"] ?? true) ? (
              <div className="flex flex-col">
                {projectAssets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    label={asset.fileName}
                    previewUrl={getAssetUrl(asset)}
                    dragData={createProjectAssetDragData(asset)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!folderSprites.length && !projectAssets.length ? (
          <div className="mx-3 mt-1 border border-dashed border-white/12 px-3 py-4 text-center text-[11px] text-white/28">
            No sprites yet.
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className="m-2 flex shrink-0 items-center justify-center gap-2 border border-dashed border-white/12 px-3 py-3 font-[var(--font-ui)] text-[11px] font-semibold text-white/40 transition-colors hover:border-[var(--accent)]/50 hover:text-white/78"
        onClick={() => uploadInputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        Upload images
      </button>
    </>
  );
}
