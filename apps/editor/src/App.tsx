import { AssetsPanel } from "@/components/editor/AssetsPanel";
import { NewSceneModal } from "@/components/editor/NewSceneModal";
import { SceneTabs } from "@/components/editor/SceneTabs";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { Workspace } from "@/components/editor/Workspace";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import {
  buildEmbeddedExportProject,
  readFileAsDataUrl,
  readImageSize,
  serializeEmbeddedProject,
} from "@/editor/assets";
import { DEFAULT_VIEWPORT_SCALE, SPRITES_MANIFEST_ROUTE } from "@/editor/constants";
import { isAssetDragData, isSceneTabDragData, type EditorDragData } from "@/editor/dnd";
import { nextId, swapAtIndex } from "@/editor/geometry";
import { getNextPersistenceSlot } from "@/editor/persistence";
import { useEditorEffects } from "@/editor/useEditorEffects";
import { useEditorState } from "@/editor/useEditorState";
import { useRef, useState } from "react";
import { createDefaultScene, parseSpriteProject, type SpriteAsset } from "../../../shared/ast";

export default function App() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const folderSpriteSizeCacheRef = useRef(new Map<string, { width: number; height: number }>());
  const autosaveTimerRef = useRef<number | null>(null);
  const pendingPersistencePayloadRef = useRef<string | null>(null);
  const nextPersistenceSlotRef = useRef<0 | 1>(getNextPersistenceSlot());
  const restoredWorkspaceScrollRef = useRef(false);

  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<EditorDragData | null>(null);

  const { state, dispatch, mutate, updateScene, updateNode, selectors } = useEditorState();

  useEditorEffects({
    state,
    dispatch,
    workspaceRef,
    folderSpriteSizeCacheRef,
    autosaveTimerRef,
    pendingPersistencePayloadRef,
    nextPersistenceSlotRef,
    restoredWorkspaceScrollRef,
  });

  const refreshFolderSprites = async () => {
    const response = await fetch(SPRITES_MANIFEST_ROUTE, { cache: "no-store" });
    if (!response.ok) {
      dispatch({ type: "setFolderSprites", folderSprites: [] });
      return;
    }

    const sprites = (await response.json()) as typeof state.folderSprites;
    dispatch({ type: "setFolderSprites", folderSprites: sprites });
    for (const sprite of sprites) {
      if (folderSpriteSizeCacheRef.current.has(sprite.url)) continue;
      void readImageSize(sprite.url)
        .then((size) => {
          folderSpriteSizeCacheRef.current.set(sprite.url, size);
        })
        .catch(() => {});
    }
  };

  const handleExport = async () => {
    const embeddedProject = await buildEmbeddedExportProject(state.project);
    const json = serializeEmbeddedProject(embeddedProject);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scene.sprite.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const nextProject = parseSpriteProject(JSON.parse(text));
    mutate((draft) => {
      draft.project = nextProject;
      draft.selectedSceneId = nextProject.scenes[0].id;
      draft.selectedNodeIds = [];
      draft.nodeStyleId = null;
      draft.collisionEditorId = null;
      draft.viewportScale = DEFAULT_VIEWPORT_SCALE;
    });
  };

  const handleUploadImages = async (files: FileList | null) => {
    if (!files?.length) return;

    const entries = await Promise.all(
      [...files]
        .filter((file) => file.type.startsWith("image/"))
        .map(async (file) => {
          const dataUrl = await readFileAsDataUrl(file);
          const size = await readImageSize(dataUrl);
          return {
            id: nextId("asset", Object.keys(state.project.assets)),
            kind: "image" as const,
            fileName: file.name,
            width: size.width,
            height: size.height,
            mimeType: file.type,
            dataUrl,
          };
        }),
    );

    mutate((draft) => {
      for (const asset of entries) {
        const uniqueId = nextId("asset", Object.keys(draft.project.assets));
        draft.project.assets[uniqueId] = { ...asset, id: uniqueId };
      }
    });
  };

  const handleDeleteSelected = () => {
    const deletableIds = new Set(selectors.selectedUnlockedNodeIds);
    if (!deletableIds.size) return;

    const lockedIds = new Set(
      selectors.selectedScene.nodes
        .filter((node) => selectors.selectedNodeSet.has(node.id) && node.locked)
        .map((node) => node.id),
    );

    mutate((draft) => {
      const scene = draft.project.scenes.find((entry) => entry.id === selectors.selectedScene.id);
      if (!scene) return;
      scene.nodes = scene.nodes.filter((node) => !deletableIds.has(node.id));
      draft.selectedNodeIds = [...lockedIds];
      draft.nodeStyleId = null;
      draft.collisionEditorId = null;
    });
  };

  const handleDuplicateNode = (nodeId: string) => {
    mutate((draft) => {
      const scene = draft.project.scenes.find((entry) => entry.id === draft.selectedSceneId);
      if (!scene) return;

      const source = scene.nodes.find((node) => node.id === nodeId);
      if (!source) return;

      const duplicateId = nextId(
        "node",
        scene.nodes.map((node) => node.id),
      );

      scene.nodes.push({
        ...source,
        id: duplicateId,
        x: source.x + 20,
        y: source.y + 20,
        collisions: { ...source.collisions },
        style: { ...source.style },
      });
      draft.selectedNodeIds = [duplicateId];
    });
  };

  const handleBringForward = (nodeId: string) => {
    mutate((draft) => {
      const scene = draft.project.scenes.find((entry) => entry.id === draft.selectedSceneId);
      if (!scene) return;
      const index = scene.nodes.findIndex((node) => node.id === nodeId);
      if (index === -1 || index === scene.nodes.length - 1) return;
      scene.nodes = swapAtIndex(scene.nodes, index, index + 1);
    });
  };

  const handleSendBackward = (nodeId: string) => {
    mutate((draft) => {
      const scene = draft.project.scenes.find((entry) => entry.id === draft.selectedSceneId);
      if (!scene) return;
      const index = scene.nodes.findIndex((node) => node.id === nodeId);
      if (index <= 0) return;
      scene.nodes = swapAtIndex(scene.nodes, index, index - 1);
    });
  };

  const handleCreateScene = (params: { name: string; width: number; height: number }) => {
    mutate((draft) => {
      const id = nextId(
        "scene",
        draft.project.scenes.map((scene) => scene.id),
      );
      const nextScene = createDefaultScene(id, params.name);
      nextScene.size.width = params.width;
      nextScene.size.height = params.height;
      draft.project.scenes.push(nextScene);
      draft.selectedSceneId = id;
      draft.selectedNodeIds = [];
    });
    setNewSceneOpen(false);
  };

  const handleCloseScene = (sceneId: string) => {
    mutate((draft) => {
      if (draft.project.scenes.length <= 1) return;
      const currentIndex = draft.project.scenes.findIndex((scene) => scene.id === sceneId);
      if (currentIndex === -1) return;
      draft.project.scenes = draft.project.scenes.filter((scene) => scene.id !== sceneId);
      const nextScene =
        draft.project.scenes[Math.min(currentIndex, draft.project.scenes.length - 1)];
      if (nextScene) {
        draft.selectedSceneId = nextScene.id;
      }
      draft.selectedNodeIds = [];
    });
  };

  const projectAssets = Object.values(state.project.assets).sort((left, right) =>
    left.fileName.localeCompare(right.fileName),
  );
  const projectAssetsBySourcePath = new Map<string, SpriteAsset>(
    projectAssets
      .filter((asset): asset is SpriteAsset & { sourcePath: string } => Boolean(asset.sourcePath))
      .map((asset) => [asset.sourcePath!, asset]),
  );

  const selectedAsset = selectors.singleSelectedNode
    ? (state.project.assets[selectors.singleSelectedNode.assetId] ?? null)
    : null;

  return (
    <DragDropProvider
      onDragStart={(event) => {
        const sourceData = event.operation.source?.data;
        if (isAssetDragData(sourceData) || isSceneTabDragData(sourceData)) {
          setActiveDrag(sourceData);
        }
      }}
      onDragEnd={() => {
        setActiveDrag(null);
      }}
    >
      <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
        {state.persistenceError ? (
          <div className="shrink-0 border-b border-[#e76464]/50 bg-[#281313] px-4 py-2 font-mono text-[10px] font-medium text-[#f0b1b1]">
            {state.persistenceError}
          </div>
        ) : null}

        <header className="flex h-[42px] shrink-0 items-stretch border-b border-white/10 bg-[#1a1a1a]">
          <SceneTabs
            scenes={state.project.scenes}
            activeSceneId={state.selectedSceneId}
            onSelect={(sceneId) =>
              mutate((draft) => {
                draft.selectedSceneId = sceneId;
                draft.selectedNodeIds = [];
              })
            }
            onClose={handleCloseScene}
            onAdd={() => setNewSceneOpen(true)}
            onReorder={(from, to) =>
              mutate((draft) => {
                draft.project.scenes = swapAtIndex(draft.project.scenes, from, to);
              })
            }
          />

          <div className="flex shrink-0 items-center gap-2 px-3">
            <label className="sb-button sb-button-compact sb-button-muted h-8 cursor-pointer px-3">
              <span>Import</span>
              <input
                hidden
                type="file"
                accept=".json,.sprite.json"
                onChange={(event) => {
                  void handleImportProject(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>

            <button
              type="button"
              className="sb-button sb-button-compact sb-button-accent h-8 px-3"
              onClick={() => void handleExport()}
            >
              Export
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#171717]">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
              <button
                type="button"
                title={state.gridVisible ? "Hide grid" : "Show grid"}
                onClick={() =>
                  mutate((draft) => {
                    draft.gridVisible = !draft.gridVisible;
                  })
                }
                className={`grid h-7 w-7 place-items-center border text-[10px] font-bold transition-colors ${
                  state.gridVisible
                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                    : "border-white/14 bg-white/[0.03] text-white/54 hover:border-[var(--accent)]/55 hover:text-white"
                }`}
              >
                #
              </button>

              <div className="flex-1 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
                Grid
              </div>

              <input
                type="number"
                min={4}
                max={128}
                value={state.gridSize}
                onChange={(event) =>
                  mutate((draft) => {
                    draft.gridSize = Math.max(
                      4,
                      Math.min(128, Number(event.currentTarget.value) || 32),
                    );
                  })
                }
                className="sb-input h-7 w-14 px-2 text-center font-mono text-[11px]"
              />
            </div>

            <AssetsPanel
              folderSprites={state.folderSprites}
              projectAssets={projectAssets}
              projectAssetsBySourcePath={projectAssetsBySourcePath}
              folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
              onRefresh={() => void refreshFolderSprites()}
              onUploadFiles={(files) => void handleUploadImages(files)}
            />

            <ScenesPanel
              selectedScene={selectors.selectedScene}
              selectedNode={selectors.singleSelectedNode}
              selectedAsset={selectedAsset}
              onUpdateScene={updateScene}
              onUpdateNode={updateNode}
            />
          </aside>

          <Workspace
            state={state}
            selectors={selectors}
            workspaceRef={workspaceRef}
            folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
            mutate={mutate}
            dispatch={dispatch}
            updateNode={updateNode}
            onDeleteSelected={handleDeleteSelected}
            onDuplicateNode={handleDuplicateNode}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
          />
        </div>

        <NewSceneModal
          open={newSceneOpen}
          onClose={() => setNewSceneOpen(false)}
          onCreate={handleCreateScene}
        />

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            isAssetDragData(activeDrag) ? (
              <div
                className="overflow-hidden border border-white/18 bg-[#111] p-2 shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
                style={{
                  width: `${activeDrag.previewWidth + 16}px`,
                }}
              >
                <div
                  className="mx-auto [image-rendering:pixelated]"
                  style={{
                    width: `${activeDrag.previewWidth}px`,
                    height: `${activeDrag.previewHeight}px`,
                    backgroundImage: `url("${activeDrag.previewUrl}")`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            ) : (
              <div className="flex min-w-[180px] items-center gap-2 border border-white/14 bg-[#232323] px-3 py-2 text-white shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
                <span className="truncate font-[var(--font-ui)] text-[13px] font-semibold">
                  {activeDrag.sceneName}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-white/45">
                  {activeDrag.sceneWidth}×{activeDrag.sceneHeight}
                </span>
              </div>
            )
          ) : null}
        </DragOverlay>
      </div>
    </DragDropProvider>
  );
}
