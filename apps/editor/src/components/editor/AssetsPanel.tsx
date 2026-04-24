import { ChevronDown, RefreshCw as IconRefresh } from "lucide-react";
import type { SpriteAsset } from "../../../../../shared/ast";
import { getAssetUrl, readImageSize } from "@/editor/assets";
import type { EditorState, FolderSpriteSource } from "@/editor/types";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FOLDER_ASSET_MIME, PROJECT_ASSET_MIME } from "@/editor/constants";

type AssetsPanelProps = {
  folderSprites: FolderSpriteSource[];
  projectAssets: SpriteAsset[];
  projectAssetsBySourcePath: Map<string, SpriteAsset>;
  dragGhost: EditorState["dragGhost"];
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  onRefresh: () => void;
  mutate: (mutation: (draft: EditorState) => void) => void;
};

export function AssetsPanel(props: AssetsPanelProps) {
  const {
    folderSprites,
    projectAssets,
    projectAssetsBySourcePath,
    folderSpriteSizeCacheRef,
    onRefresh,
    mutate,
  } = props;

  const setGhost = (nextGhost: EditorState["dragGhost"]) => {
    mutate((draft) => {
      draft.dragGhost = nextGhost;
    });
  };

  return (
    <Collapsible
      defaultOpen
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 group"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2 shrink-0">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className="h-3.5 w-3.5 text-white/40 transition-transform duration-200 group-data-[panel-open=false]:-rotate-90" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Assets</div>
            <h2 className="text-[15px] font-semibold">Drag into scene</h2>
          </div>
        </CollapsibleTrigger>
        <Button variant="outline" size="icon-sm" title="Refresh folder" onClick={onRefresh}>
          <IconRefresh />
        </Button>
      </div>

      <CollapsibleContent className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
          Folder sprites
        </div>
        <div className="flex flex-col gap-1">
          {folderSprites.map((asset) => (
            <div
              key={asset.id}
              className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-white/6 bg-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/4 select-none"
              draggable
              onDragStart={(event) => {
                event.dataTransfer?.setData(FOLDER_ASSET_MIME, JSON.stringify(asset));
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "copy";
                }

                const existing = projectAssetsBySourcePath.get(asset.sourcePath);
                const cached = folderSpriteSizeCacheRef.current.get(asset.url);
                const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));

                if (existing) {
                  const scale = Math.min(1, capHeight / existing.height);
                  setGhost({
                    x: 0,
                    y: 0,
                    width: Math.round(existing.width * scale),
                    height: Math.round(existing.height * scale),
                    imageUrl: asset.url,
                  });
                  return;
                }

                if (cached) {
                  const scale = Math.min(1, capHeight / cached.height);
                  setGhost({
                    x: 0,
                    y: 0,
                    width: Math.round(cached.width * scale),
                    height: Math.round(cached.height * scale),
                    imageUrl: asset.url,
                  });
                  return;
                }

                setGhost({
                  x: 0,
                  y: 0,
                  width: 64,
                  height: 64,
                  imageUrl: asset.url,
                });

                void readImageSize(asset.url)
                  .then((size) => {
                    folderSpriteSizeCacheRef.current.set(asset.url, size);
                    const scale = Math.min(1, capHeight / size.height);
                    mutate((draft) => {
                      if (!draft.dragGhost || draft.dragGhost.imageUrl !== asset.url) return;
                      draft.dragGhost.width = Math.round(size.width * scale);
                      draft.dragGhost.height = Math.round(size.height * scale);
                    });
                  })
                  .catch(() => {});
              }}
              onDragEnd={() => setGhost(null)}
            >
              <div className="pointer-events-none grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/6 bg-white/4">
                <img
                  alt={asset.fileName}
                  className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                  draggable={false}
                  src={asset.url}
                />
              </div>
              <div className="pointer-events-none flex min-w-0 flex-col gap-0.5">
                <strong className="truncate text-xs font-medium">{asset.fileName}</strong>
                <span className="truncate text-[10px] text-white/35 [font-variant-numeric:tabular-nums]">
                  {asset.relativePath}
                </span>
              </div>
            </div>
          ))}
          {!folderSprites.length ? (
            <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/35">
              Put image files into <code>sprites/</code> at the repo root.
            </div>
          ) : null}
        </div>

        <div className="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
          Imported into project
        </div>
        <div className="flex flex-col gap-1">
          {projectAssets.map((asset) => (
            <div
              key={asset.id}
              className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-white/6 bg-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/4 select-none"
              draggable
              onDragStart={(event) => {
                event.dataTransfer?.setData(PROJECT_ASSET_MIME, asset.id);
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "copy";
                }
                const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
                const scale = Math.min(1, capHeight / asset.height);
                setGhost({
                  x: 0,
                  y: 0,
                  width: Math.round(asset.width * scale),
                  height: Math.round(asset.height * scale),
                  imageUrl: getAssetUrl(asset),
                });
              }}
              onDragEnd={() => setGhost(null)}
            >
              <div className="pointer-events-none grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/6 bg-white/4">
                {getAssetUrl(asset) ? (
                  <img
                    alt={asset.fileName}
                    className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                    draggable={false}
                    src={getAssetUrl(asset)}
                  />
                ) : (
                  <div className="p-1.5 text-center text-[10px] text-white/40">
                    {asset.fileName}
                  </div>
                )}
              </div>
              <div className="pointer-events-none flex min-w-0 flex-col gap-0.5">
                <strong className="truncate text-xs font-medium">{asset.fileName}</strong>
                <span className="text-[10px] text-white/35 [font-variant-numeric:tabular-nums]">
                  {asset.width} × {asset.height}
                </span>
              </div>
            </div>
          ))}
          {!projectAssets.length ? (
            <div className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/35">
              Dropped folder sprites show up here.
            </div>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
