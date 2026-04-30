import { Loader2, Ratio, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/react";
import type { SpriteAsset } from "@msviderok/sprite-editor-ast-schema";
import { getAssetUrl } from "@/editor/assets";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UploadButton } from "@/lib/uploadthing";
import { AssetDimensionSourcePopoverContent } from "./AssetDimensionSourcePopover";
import {
  DND_TYPE_PROJECT_ASSET,
  createProjectAssetDragData,
  createUploadThingAssetDragData,
  type AssetDragData,
} from "@/editor/dnd";
import type { UploadThingAsset } from "@/editor/useUploadThingAssets";
import { cn } from "@/lib/utils";

type AssetsPanelProps = {
  uploadThingAssets: UploadThingAsset[];
  uploadThingLoading: boolean;
  uploadThingError: string | null;
  projectAssets: SpriteAsset[];
  onUploadComplete: () => void;
  onDeleteUploadThingAsset: (key: string) => void;
  onBulkDeleteUploadThingAssets: (keys: string[]) => void;
  deletingUploadThingAssetKeys: Set<string>;
};

function AssetRow(props: {
  label: string;
  previewUrl: string;
  dragData: AssetDragData;
  depth: number;
  dimensionSource?: { url: string; width: number; height: number };
  deleteSource?: {
    key: string;
    name: string;
    isDeleting: boolean;
    onDelete: (key: string) => void;
  };
  isSelected?: boolean;
  onSelect?: (event: React.MouseEvent) => void;
}) {
  const {
    label,
    previewUrl,
    dragData,
    depth,
    dimensionSource,
    deleteSource,
    isSelected,
    onSelect,
  } = props;
  const { ref, isDragging } = useDraggable({
    id:
      dragData.kind === DND_TYPE_PROJECT_ASSET
        ? `project-asset:${dragData.assetId}`
        : `uploadthing-asset:${dragData.file.key}`,
    type: dragData.kind,
    data: dragData,
  });

  const isDeleting = !!deleteSource?.isDeleting;
  const button = (
    <Button
      ref={ref}
      type="button"
      onClick={onSelect}
      disabled={isDeleting}
      className={cn(
        "flex w-full touch-none cursor-grab items-center gap-2 py-1.5 text-left text-white/58 transition-[color,opacity,background-color] hover:bg-white/[0.04] hover:text-white/86 active:cursor-grabbing",
        isDragging && "opacity-35",
        isSelected &&
          "bg-[var(--accent)]/12 text-white/92 shadow-[inset_2px_0_0_var(--accent)] hover:bg-[var(--accent)]/16",
        isDeleting && "cursor-wait opacity-50",
      )}
      style={{
        paddingLeft: `${16 + depth * 12}px`,
        paddingRight:
          dimensionSource && deleteSource
            ? "76px"
            : dimensionSource || deleteSource
              ? "44px"
              : "16px",
      }}
    >
      <span className="pointer-events-none grid h-5 w-5 shrink-0 place-items-center overflow-hidden border border-white/12 bg-white/[0.03]">
        {previewUrl ? (
          <img
            alt={label}
            className="pointer-events-none max-h-full max-w-full object-contain [image-rendering:pixelated]"
            draggable={false}
            src={previewUrl}
          />
        ) : null}
      </span>
      <span className="pointer-events-none truncate font-mono text-[11px]">{label}</span>
    </Button>
  );

  const trigger = previewUrl ? (
    <HoverCard>
      <HoverCardTrigger delay={0} closeDelay={0} render={button} />
      <HoverCardContent side="right" sideOffset={12}>
        <div className="flex flex-col items-center gap-2">
          <img
            alt={label}
            src={previewUrl}
            draggable={false}
            className="max-h-64 max-w-64 object-contain [image-rendering:pixelated]"
          />
          <span className="max-w-64 truncate font-mono text-[11px] text-white/68">{label}</span>
        </div>
      </HoverCardContent>
    </HoverCard>
  ) : (
    button
  );

  if (!dimensionSource && !deleteSource) return trigger;

  return (
    <div className="group relative flex w-full items-center">
      {trigger}
      {isDeleting ? (
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <Loader2 className="h-3 w-3 animate-spin text-[#f0b1b1]" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 data-[open=true]:opacity-100">
          <div className="pointer-events-auto">
            {dimensionSource ? (
              <AssetDimensionSourceRowButton dimensionSource={dimensionSource} />
            ) : null}
          </div>
          <div className="pointer-events-auto">
            {deleteSource ? <DeleteUploadedAssetButton deleteSource={deleteSource} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}

function AssetDimensionSourceRowButton({
  dimensionSource,
}: {
  dimensionSource: { url: string; width: number; height: number };
}) {
  const [open, setOpen] = useState(false);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="iconButton"
                  className="h-6 w-6"
                  onPointerDown={stop}
                  onMouseDown={stop}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                >
                  <Ratio className="h-3 w-3" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Use as scene dimension source</TooltipContent>
      </Tooltip>

      <PopoverContent
        side="right"
        sideOffset={8}
        align="center"
        className="w-80 border-white/14 bg-[#1a1a1a] text-foreground"
      >
        <AssetDimensionSourcePopoverContent
          assetUrl={dimensionSource.url}
          width={dimensionSource.width}
          height={dimensionSource.height}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </PopoverRoot>
  );
}

function DeleteUploadedAssetButton({
  deleteSource,
}: {
  deleteSource: { key: string; name: string; isDeleting: boolean; onDelete: (key: string) => void };
}) {
  const [open, setOpen] = useState(false);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <PopoverRoot open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="iconButton"
                  className="h-6 w-6 text-white/48 hover:text-[#f0b1b1]"
                  disabled={deleteSource.isDeleting}
                  onPointerDown={stop}
                  onMouseDown={stop}
                  onClick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Delete from UploadThing</TooltipContent>
      </Tooltip>

      <PopoverContent
        side="right"
        sideOffset={8}
        align="center"
        className="w-64 border-white/14 bg-[#1a1a1a] p-3 text-foreground"
        onPointerDown={stop}
        onMouseDown={stop}
      >
        <div className="space-y-3">
          <div>
            <div className="font-[var(--font-ui)] text-[12px] font-bold text-white/86">
              Delete uploaded asset?
            </div>
            <div className="mt-1 font-mono text-[10px] leading-4 text-white/44">
              This permanently removes {deleteSource.name} from UploadThing storage.
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="muted"
              size="compact"
              onClick={() => setOpen(false)}
              disabled={deleteSource.isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="compact"
              className="border-[#e76464]/60 bg-[#2a1515] text-[#f0b1b1] hover:border-[#e76464]"
              disabled={deleteSource.isDeleting}
              onClick={() => {
                deleteSource.onDelete(deleteSource.key);
                setOpen(false);
              }}
            >
              {deleteSource.isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}

function BulkDeleteAssetsBar({
  count,
  isDeleting,
  onConfirm,
  onClear,
  confirmOpen,
  onConfirmOpenChange,
}: {
  count: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onClear: () => void;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
}) {
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <div className="mx-3 mb-2 flex items-center gap-2 border border-white/14 bg-white/[0.04] px-2 py-1.5">
      <span className="flex flex-1 items-center gap-1.5 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/68">
        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin text-white/68" /> : null}
        {isDeleting ? `Deleting ${count}...` : `${count} selected`}
      </span>
      <PopoverRoot open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="iconButton"
                    className="h-6 w-6 text-white/48 hover:text-[#f0b1b1]"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>Delete selected</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          sideOffset={8}
          align="end"
          className="w-64 border-white/14 bg-[#1a1a1a] p-3 text-foreground"
          onPointerDown={stop}
          onMouseDown={stop}
        >
          <div className="space-y-3">
            <div>
              <div className="font-[var(--font-ui)] text-[12px] font-bold text-white/86">
                Delete {count} uploaded asset{count === 1 ? "" : "s"}?
              </div>
              <div className="mt-1 font-mono text-[10px] leading-4 text-white/44">
                This permanently removes the selected file{count === 1 ? "" : "s"} from UploadThing
                storage.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="muted"
                size="compact"
                onClick={() => onConfirmOpenChange(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="compact"
                className="border-[#e76464]/60 bg-[#2a1515] text-[#f0b1b1] hover:border-[#e76464]"
                disabled={isDeleting}
                onClick={onConfirm}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </PopoverRoot>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="iconButton"
              className="h-6 w-6"
              onClick={onClear}
              disabled={isDeleting}
            >
              <X className="h-3 w-3" />
            </Button>
          }
        />
        <TooltipContent>Clear selection</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] text-white/28">{count}</span>
    </div>
  );
}

export function AssetsPanel(props: AssetsPanelProps) {
  const {
    uploadThingAssets,
    uploadThingLoading,
    uploadThingError,
    projectAssets,
    onUploadComplete,
    onDeleteUploadThingAsset,
    onBulkDeleteUploadThingAssets,
    deletingUploadThingAssetKeys,
  } = props;

  const [search, setSearch] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const trimmedSearch = search.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;

  const projectAssetUrls = useMemo(
    () => new Set(projectAssets.map((asset) => asset.url).filter(Boolean)),
    [projectAssets],
  );

  const filteredUploadThingAssets = useMemo(() => {
    const assets = uploadThingAssets.filter((asset) => !projectAssetUrls.has(asset.url));
    if (!isSearching) return assets;
    return assets.filter((asset) => asset.name.toLowerCase().includes(trimmedSearch));
  }, [isSearching, projectAssetUrls, trimmedSearch, uploadThingAssets]);

  const filteredProjectAssets = useMemo(() => {
    if (!isSearching) return projectAssets;
    return projectAssets.filter((asset) => asset.fileName.toLowerCase().includes(trimmedSearch));
  }, [projectAssets, isSearching, trimmedSearch]);

  const filteredUploadThingKeys = useMemo(
    () => filteredUploadThingAssets.map((asset) => asset.key),
    [filteredUploadThingAssets],
  );

  // Trim selection to currently visible (filtered) keys.
  useEffect(() => {
    setSelectedKeys((current) => {
      if (current.size === 0) return current;
      const visible = new Set(filteredUploadThingKeys);
      let changed = false;
      const next = new Set<string>();
      for (const key of current) {
        if (visible.has(key)) next.add(key);
        else changed = true;
      }
      return changed ? next : current;
    });
    setAnchorKey((current) =>
      current && filteredUploadThingKeys.includes(current) ? current : null,
    );
  }, [filteredUploadThingKeys]);

  const handleAssetClick = (key: string, event: React.MouseEvent) => {
    if (event.shiftKey && anchorKey && anchorKey !== key) {
      const fromIndex = filteredUploadThingKeys.indexOf(anchorKey);
      const toIndex = filteredUploadThingKeys.indexOf(key);
      if (fromIndex !== -1 && toIndex !== -1) {
        const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
        const range = filteredUploadThingKeys.slice(start, end + 1);
        setSelectedKeys(new Set(range));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedKeys((current) => {
        const next = new Set(current);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setAnchorKey(key);
      return;
    }
    setSelectedKeys(new Set([key]));
    setAnchorKey(key);
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
    setAnchorKey(null);
  };

  const selectedKeysArray = useMemo(() => Array.from(selectedKeys), [selectedKeys]);
  const isBulkDeleting = selectedKeysArray.some((key) => deletingUploadThingAssetKeys.has(key));

  const confirmBulkDelete = () => {
    if (selectedKeysArray.length === 0) return;
    onBulkDeleteUploadThingAssets(selectedKeysArray);
    setBulkConfirmOpen(false);
    setSelectedKeys(new Set());
    setAnchorKey(null);
  };

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (selectedKeys.size === 0) return;
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      setBulkConfirmOpen(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      clearSelection();
    }
  };

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
          Assets
        </span>
      </div>

      <div className="shrink-0 border-b border-white/10 px-3 py-2">
        <UploadButton
          config={{ cn: cn }}
          endpoint="imageUploader"
          onClientUploadComplete={onUploadComplete}
          appearance={{
            container: "w-full",
            button:
              "ut-ready:bg-transparent ut-uploading:bg-transparent after:bg-accent flex w-full items-center justify-center gap-2 border border-dashed border-white/12 bg-transparent px-3 py-2.5 font-[var(--font-ui)] text-[11px] font-semibold text-white/40 transition-colors hover:border-[var(--accent)]/50 hover:text-white/78",
            allowedContent: "hidden",
          }}
          content={{
            button({ isUploading }) {
              return (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {isUploading ? "Uploading..." : "Upload images"}
                </>
              );
            },
          }}
        />
      </div>

      <div className="relative shrink-0 border-b border-white/10 px-3 py-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/38" />
        <input
          type="text"
          value={search}
          placeholder="Search assets..."
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="h-7 w-full border border-white/14 bg-white/[0.03] pl-6 pr-7 font-mono text-[11px] text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
        />
        {search ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center text-white/38 transition-colors hover:text-white/78"
                >
                  <X className="h-3 w-3" />
                </Button>
              }
            />
            <TooltipContent>Clear search</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div
        ref={listRef}
        tabIndex={-1}
        onKeyDown={handleListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto py-2 outline-none [scrollbar-width:thin]"
      >
        {uploadThingError ? (
          <div className="mx-3 mb-2 border border-[#e76464]/50 bg-[#281313] px-3 py-2 font-mono text-[10px] text-[#f0b1b1]">
            {uploadThingError}
          </div>
        ) : null}

        {filteredProjectAssets.length ? (
          <div>
            <SectionHeader label="In Project" count={filteredProjectAssets.length} />
            <div className="flex flex-col">
              {filteredProjectAssets.map((asset) => {
                const url = getAssetUrl(asset);
                return (
                  <AssetRow
                    key={asset.id}
                    label={asset.fileName}
                    previewUrl={url}
                    dragData={createProjectAssetDragData(asset)}
                    depth={1}
                    dimensionSource={
                      url ? { url, width: asset.width, height: asset.height } : undefined
                    }
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {filteredUploadThingAssets.length ? (
          <div>
            {selectedKeys.size > 0 ? (
              <BulkDeleteAssetsBar
                count={selectedKeys.size}
                isDeleting={isBulkDeleting}
                onConfirm={confirmBulkDelete}
                onClear={clearSelection}
                confirmOpen={bulkConfirmOpen}
                onConfirmOpenChange={setBulkConfirmOpen}
              />
            ) : null}
            <SectionHeader label="Assets" count={filteredUploadThingAssets.length} />
            <div className="flex flex-col">
              {filteredUploadThingAssets.map((asset) => (
                <AssetRow
                  key={asset.key}
                  label={asset.name}
                  previewUrl={asset.url}
                  dragData={createUploadThingAssetDragData(asset)}
                  depth={1}
                  dimensionSource={{ url: asset.url, width: asset.width, height: asset.height }}
                  deleteSource={{
                    key: asset.key,
                    name: asset.name,
                    isDeleting: deletingUploadThingAssetKeys.has(asset.key),
                    onDelete: onDeleteUploadThingAsset,
                  }}
                  isSelected={selectedKeys.has(asset.key)}
                  onSelect={(event) => handleAssetClick(asset.key, event)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {!filteredUploadThingAssets.length && !filteredProjectAssets.length ? (
          <div className="mx-3 mt-1 border border-dashed border-white/12 px-3 py-4 text-center text-[11px] text-white/28">
            {uploadThingLoading ? "Loading assets..." : isSearching ? "No matches." : "No assets."}
          </div>
        ) : null}
      </div>
    </>
  );
}
