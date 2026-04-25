import {
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/react";
import type { SpriteAsset } from "../../../../../shared/ast";
import { getAssetUrl, readImageSize } from "@/editor/assets";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

type TreeFolder = {
  kind: "folder";
  /** Full path key, unique. e.g. "posters/old" */
  path: string;
  label: string;
  children: TreeNode[];
};

type TreeFile = {
  kind: "file";
  path: string;
  sprite: FolderSpriteSource;
};

type TreeNode = TreeFolder | TreeFile;

function buildTree(sprites: FolderSpriteSource[]): TreeFolder {
  const root: TreeFolder = { kind: "folder", path: "", label: "Sprites", children: [] };

  const ensureFolder = (segments: string[]): TreeFolder => {
    let current = root;
    let pathAccum = "";
    for (const segment of segments) {
      pathAccum = pathAccum ? `${pathAccum}/${segment}` : segment;
      let child = current.children.find(
        (node): node is TreeFolder => node.kind === "folder" && node.label === segment,
      );
      if (!child) {
        child = {
          kind: "folder",
          path: pathAccum,
          label: segment,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
    return current;
  };

  for (const sprite of sprites) {
    const segments = sprite.relativePath.split("/").filter(Boolean);
    const folderSegments = segments.slice(0, -1);
    const folder = ensureFolder(folderSegments);
    folder.children.push({
      kind: "file",
      path: sprite.relativePath,
      sprite,
    });
  }

  const sortNode = (node: TreeFolder) => {
    node.children.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      const leftLabel = left.kind === "folder" ? left.label : left.sprite.fileName;
      const rightLabel = right.kind === "folder" ? right.label : right.sprite.fileName;
      return leftLabel.localeCompare(rightLabel);
    });
    for (const child of node.children) {
      if (child.kind === "folder") sortNode(child);
    }
  };
  sortNode(root);

  return root;
}

function collectFolderPaths(node: TreeFolder, acc: string[] = []): string[] {
  acc.push(node.path);
  for (const child of node.children) {
    if (child.kind === "folder") collectFolderPaths(child, acc);
  }
  return acc;
}

function countFiles(node: TreeFolder): number {
  let total = 0;
  for (const child of node.children) {
    if (child.kind === "file") total += 1;
    else total += countFiles(child);
  }
  return total;
}

function FolderHeader(props: {
  label: string;
  count: number;
  open: boolean;
  depth: number;
  onToggle: () => void;
}) {
  const { label, count, open, depth, onToggle } = props;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 py-1 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/38 transition-colors hover:text-white/68"
      style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: "12px" }}
    >
      <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="font-mono text-[10px] text-white/28">{count}</span>
    </button>
  );
}

function AssetRow(props: {
  label: string;
  previewUrl: string;
  dragData: AssetDragData;
  depth: number;
}) {
  const { label, previewUrl, dragData, depth } = props;
  const { ref, isDragging } = useDraggable({
    id:
      dragData.kind === DND_TYPE_FOLDER_ASSET
        ? `folder-asset:${dragData.sprite.id}`
        : `project-asset:${dragData.assetId}`,
    type: dragData.kind,
    data: dragData,
  });

  const button = (
    <button
      ref={ref}
      type="button"
      className={`flex w-full touch-none cursor-grab items-center gap-2 py-1.5 text-left text-white/58 transition-[color,opacity,background-color] hover:bg-white/[0.04] hover:text-white/86 active:cursor-grabbing ${
        isDragging ? "opacity-35" : ""
      }`}
      style={{ paddingLeft: `${16 + depth * 12}px`, paddingRight: "16px" }}
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
    </button>
  );

  if (!previewUrl) return button;

  return (
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
  );
}

function FolderAssetRow(props: {
  sprite: FolderSpriteSource;
  existingAsset: SpriteAsset | undefined;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  depth: number;
}) {
  const { sprite, existingAsset, folderSpriteSizeCacheRef, depth } = props;
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

  return (
    <AssetRow label={sprite.fileName} previewUrl={sprite.url} dragData={dragData} depth={depth} />
  );
}

function TreeFolderView(props: {
  folder: TreeFolder;
  depth: number;
  openFolders: Record<string, boolean>;
  onToggle: (path: string) => void;
  projectAssetsBySourcePath: Map<string, SpriteAsset>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
}) {
  const {
    folder,
    depth,
    openFolders,
    onToggle,
    projectAssetsBySourcePath,
    folderSpriteSizeCacheRef,
  } = props;
  const open = openFolders[folder.path] ?? true;
  const count = countFiles(folder);

  return (
    <div>
      <FolderHeader
        label={folder.label || "Sprites"}
        count={count}
        open={open}
        depth={depth}
        onToggle={() => onToggle(folder.path)}
      />
      {open ? (
        <div className="flex flex-col">
          {folder.children.map((child) =>
            child.kind === "folder" ? (
              <TreeFolderView
                key={`folder:${child.path}`}
                folder={child}
                depth={depth + 1}
                openFolders={openFolders}
                onToggle={onToggle}
                projectAssetsBySourcePath={projectAssetsBySourcePath}
                folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
              />
            ) : (
              <FolderAssetRow
                key={`file:${child.sprite.id}`}
                sprite={child.sprite}
                existingAsset={projectAssetsBySourcePath.get(child.sprite.sourcePath)}
                folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
                depth={depth + 1}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}

const IN_PROJECT_KEY = "__in-project__";

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
  const [search, setSearch] = useState("");
  const trimmedSearch = search.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;

  const filteredFolderSprites = useMemo(() => {
    if (!isSearching) return folderSprites;
    return folderSprites.filter(
      (sprite) =>
        sprite.fileName.toLowerCase().includes(trimmedSearch) ||
        sprite.relativePath.toLowerCase().includes(trimmedSearch),
    );
  }, [folderSprites, isSearching, trimmedSearch]);

  const filteredProjectAssets = useMemo(() => {
    if (!isSearching) return projectAssets;
    return projectAssets.filter((asset) => asset.fileName.toLowerCase().includes(trimmedSearch));
  }, [projectAssets, isSearching, trimmedSearch]);

  const tree = useMemo(() => buildTree(filteredFolderSprites), [filteredFolderSprites]);

  const allFolderPaths = useMemo(() => {
    const paths = collectFolderPaths(tree);
    if (filteredProjectAssets.length) paths.push(IN_PROJECT_KEY);
    return paths;
  }, [tree, filteredProjectAssets.length]);

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => ({}));

  // Default new folders to open. While searching, force-expand all folders
  // so matches are visible.
  const resolvedOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const path of allFolderPaths) {
      map[path] = isSearching ? true : (openFolders[path] ?? true);
    }
    return map;
  }, [allFolderPaths, openFolders, isSearching]);

  const allOpen = allFolderPaths.every((path) => resolvedOpen[path]);
  const allClosed = allFolderPaths.every((path) => !resolvedOpen[path]);

  const setAll = (open: boolean) => {
    const map: Record<string, boolean> = {};
    for (const path of allFolderPaths) map[path] = open;
    setOpenFolders(map);
  };

  const toggleFolder = (path: string) => {
    setOpenFolders((current) => ({
      ...current,
      [path]: !(current[path] ?? resolvedOpen[path] ?? true),
    }));
  };

  const inProjectOpen = resolvedOpen[IN_PROJECT_KEY] ?? true;

  return (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
          Assets
        </span>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="sb-icon-button"
                  disabled={allOpen}
                  onClick={() => setAll(true)}
                >
                  <ChevronsUpDown className="h-3 w-3" />
                </button>
              }
            />
            <TooltipContent>Expand all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="sb-icon-button"
                  disabled={allClosed}
                  onClick={() => setAll(false)}
                >
                  <ChevronsDownUp className="h-3 w-3" />
                </button>
              }
            />
            <TooltipContent>Collapse all</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button type="button" className="sb-icon-button" onClick={onRefresh}>
                  <RefreshCw className="h-3 w-3" />
                </button>
              }
            />
            <TooltipContent>Refresh sprite folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="sb-icon-button"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                </button>
              }
            />
            <TooltipContent>Upload images</TooltipContent>
          </Tooltip>
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

      <div className="relative shrink-0 border-b border-white/10 px-3 py-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/38" />
        <input
          type="text"
          value={search}
          placeholder="Search assets…"
          onChange={(event) => setSearch(event.currentTarget.value)}
          className="sb-input h-7 w-full pl-6 pr-7 font-mono text-[11px]"
        />
        {search ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center text-white/38 transition-colors hover:text-white/78"
                >
                  <X className="h-3 w-3" />
                </button>
              }
            />
            <TooltipContent>Clear search</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2 [scrollbar-width:thin]">
        {filteredFolderSprites.length ? (
          <TreeFolderView
            folder={tree}
            depth={0}
            openFolders={resolvedOpen}
            onToggle={toggleFolder}
            projectAssetsBySourcePath={projectAssetsBySourcePath}
            folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
          />
        ) : null}

        {filteredProjectAssets.length ? (
          <div className="pt-1">
            <FolderHeader
              label="In Project"
              count={filteredProjectAssets.length}
              open={inProjectOpen}
              depth={0}
              onToggle={() => toggleFolder(IN_PROJECT_KEY)}
            />

            {inProjectOpen ? (
              <div className="flex flex-col">
                {filteredProjectAssets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    label={asset.fileName}
                    previewUrl={getAssetUrl(asset)}
                    dragData={createProjectAssetDragData(asset)}
                    depth={1}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {!filteredFolderSprites.length && !filteredProjectAssets.length ? (
          <div className="mx-3 mt-1 border border-dashed border-white/12 px-3 py-4 text-center text-[11px] text-white/28">
            {isSearching
              ? "No matches."
              : !folderSprites.length && !projectAssets.length
                ? "No sprites yet."
                : "No assets."}
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
