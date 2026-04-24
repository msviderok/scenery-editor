import { ChevronRight, RefreshCw, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { SpriteAsset } from "../../../../../shared/ast";
import { getAssetUrl, readImageSize } from "@/editor/assets";
import { FOLDER_ASSET_MIME, PROJECT_ASSET_MIME } from "@/editor/constants";
import type { DragGhost, EditorState, FolderSpriteSource } from "@/editor/types";

type AssetsPanelProps = {
  folderSprites: FolderSpriteSource[];
  projectAssets: SpriteAsset[];
  projectAssetsBySourcePath: Map<string, SpriteAsset>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  mutate: (mutation: (draft: EditorState) => void) => void;
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

function AssetRow(props: {
  label: string;
  previewUrl: string;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
}) {
  const { label, previewUrl, onDragStart, onDragEnd } = props;
  return (
    <button
      type="button"
      draggable
      className="flex w-full cursor-grab items-center gap-2 px-4 py-1.5 text-left text-white/58 transition-colors hover:bg-white/[0.04] hover:text-white/86 active:cursor-grabbing"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
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

export function AssetsPanel(props: AssetsPanelProps) {
  const {
    folderSprites,
    projectAssets,
    projectAssetsBySourcePath,
    folderSpriteSizeCacheRef,
    mutate,
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

  const updateDragGhost = (nextGhost: DragGhost | null) => {
    mutate((draft) => {
      draft.dragGhost = nextGhost;
    });
  };

  const setAssetGhost = (
    previewUrl: string,
    width: number,
    height: number,
    imageUrl = previewUrl,
  ) => {
    const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
    const scale = Math.min(1, capHeight / Math.max(height, 1));
    updateDragGhost({
      x: 0,
      y: 0,
      width: Math.max(16, Math.round(width * scale)),
      height: Math.max(16, Math.round(height * scale)),
      imageUrl,
    });
  };

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
                    <AssetRow
                      key={sprite.id}
                      label={sprite.fileName}
                      previewUrl={sprite.url}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(FOLDER_ASSET_MIME, JSON.stringify(sprite));
                        event.dataTransfer.effectAllowed = "copy";

                        const existing = projectAssetsBySourcePath.get(sprite.sourcePath);
                        const cached = folderSpriteSizeCacheRef.current.get(sprite.url);

                        if (existing) {
                          setAssetGhost(sprite.url, existing.width, existing.height);
                          return;
                        }

                        if (cached) {
                          setAssetGhost(sprite.url, cached.width, cached.height);
                          return;
                        }

                        updateDragGhost({
                          x: 0,
                          y: 0,
                          width: 64,
                          height: 64,
                          imageUrl: sprite.url,
                        });

                        void readImageSize(sprite.url)
                          .then((size) => {
                            folderSpriteSizeCacheRef.current.set(sprite.url, size);
                            mutate((draft) => {
                              if (!draft.dragGhost || draft.dragGhost.imageUrl !== sprite.url) {
                                return;
                              }

                              const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
                              const scale = Math.min(1, capHeight / Math.max(size.height, 1));
                              draft.dragGhost.width = Math.max(16, Math.round(size.width * scale));
                              draft.dragGhost.height = Math.max(
                                16,
                                Math.round(size.height * scale),
                              );
                            });
                          })
                          .catch(() => {});
                      }}
                      onDragEnd={() => updateDragGhost(null)}
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
                    onDragStart={(event) => {
                      event.dataTransfer.setData(PROJECT_ASSET_MIME, asset.id);
                      event.dataTransfer.effectAllowed = "copy";
                      setAssetGhost(getAssetUrl(asset), asset.width, asset.height);
                    }}
                    onDragEnd={() => updateDragGhost(null)}
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
