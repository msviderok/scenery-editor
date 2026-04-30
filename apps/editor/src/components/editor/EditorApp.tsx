import { AssetsPanel } from "@/components/editor/AssetsPanel";
import { NewSceneModal } from "@/components/editor/NewSceneModal";
import { SceneTabs } from "@/components/editor/SceneTabs";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { Workspace } from "@/components/editor/Workspace";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { buildEmbeddedExportProject, serializeEmbeddedProject } from "@/editor/assets";
import { DEFAULT_VIEWPORT_SCALE, GRID_SIZE_BREAKPOINTS } from "@/editor/constants";
import { isAssetDragData, isSceneTabDragData, type EditorDragData } from "@/editor/dnd";
import { nextId, swapAtIndex } from "@/editor/geometry";
import { getNextPersistenceSlot } from "@/editor/persistence";
import { useEditorEffects } from "@/editor/useEditorEffects";
import { useEditorState } from "@/editor/useEditorState";
import { useUploadThingAssets } from "@/editor/useUploadThingAssets";
import { readSpriteProjectFromFile } from "@/lib/readSpriteProjectFromFile";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { createDefaultScene } from "@msviderok/sprite-editor-ast-schema";
import { Grid3x3, Play } from "lucide-react";
import { PreviewOverlay } from "@/components/preview/PreviewOverlay";

export function EditorApp() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previewAstInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const pendingPersistencePayloadRef = useRef<string | null>(null);
  const nextPersistenceSlotRef = useRef<0 | 1>(getNextPersistenceSlot());
  const restoredWorkspaceScrollRef = useRef(false);
  const navigate = useNavigate();

  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<EditorDragData | null>(null);
  const [previewAstError, setPreviewAstError] = useState<string | null>(null);

  const { state, dispatch, mutate, updateScene, updateNode, selectors } = useEditorState();
  const uploadThingAssets = useUploadThingAssets();
  const gridSizeBreakpoints: readonly number[] = GRID_SIZE_BREAKPOINTS;
  const gridSizeStepIndex = Math.max(0, gridSizeBreakpoints.indexOf(state.gridSize));

  useEditorEffects({
    state,
    dispatch,
    workspaceRef,
    autosaveTimerRef,
    pendingPersistencePayloadRef,
    nextPersistenceSlotRef,
    restoredWorkspaceScrollRef,
  });

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
    const nextProject = await readSpriteProjectFromFile(file);
    mutate((draft) => {
      draft.project = nextProject;
      draft.selectedSceneId = nextProject.scenes[0].id;
      draft.selectedNodeIds = [];
      draft.nodeStyleId = null;
      draft.collisionEditorId = null;
      draft.viewportScale = DEFAULT_VIEWPORT_SCALE;
    });
  };

  const handlePreviewAst = async (file: File | undefined) => {
    if (!file) return;

    try {
      const nextProject = await readSpriteProjectFromFile(file);
      setPreviewAstError(null);
      void navigate({
        to: "/preview/imported",
        state: (prev) => ({
          ...prev,
          importedPreview: {
            project: nextProject,
            sourceFileName: file.name,
          },
        }),
      });
    } catch (error) {
      setPreviewAstError(error instanceof Error ? error.message : "Failed to parse AST.");
    }
  };

  const handleUploadComplete = async () => {
    await uploadThingAssets.refresh();
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

  const currentSceneAssetIds = new Set(selectors.selectedScene.nodes.map((node) => node.assetId));
  const projectAssets = Object.values(state.project.assets)
    .filter((asset) => currentSceneAssetIds.has(asset.id))
    .sort((left, right) => left.fileName.localeCompare(right.fileName));
  const selectedAsset = selectors.singleSelectedNode
    ? (state.project.assets[selectors.singleSelectedNode.assetId] ?? null)
    : null;

  return (
    <TooltipProvider delay={0} closeDelay={0}>
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
          <input
            ref={previewAstInputRef}
            hidden
            type="file"
            accept=".json,.sprite.json,application/json"
            onChange={(event) => {
              void handlePreviewAst(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />

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
                  draft.backgroundSelected = false;
                })
              }
              onClose={handleCloseScene}
              onAdd={() => setNewSceneOpen(true)}
              onReorder={(from, to) =>
                mutate((draft) => {
                  draft.project.scenes = swapAtIndex(draft.project.scenes, from, to);
                })
              }
              onRename={(sceneId, name) =>
                mutate((draft) => {
                  const scene = draft.project.scenes.find((entry) => entry.id === sceneId);
                  if (scene) scene.name = name;
                })
              }
            />

            <div className="flex shrink-0 items-center gap-2 px-3">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-[0.35rem] border border-white/14 bg-[#232323] px-3 py-[0.25rem] font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 shadow-[2px_2px_0_#000] transition-colors duration-[120ms] hover:border-[var(--accent)]">
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
                  }
                />
                <TooltipContent>Import project JSON</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="muted"
                      size="compact"
                      type="button"
                      className="h-8 px-3"
                      onClick={() => previewAstInputRef.current?.click()}
                    >
                      Preview AST
                    </Button>
                  }
                />
                <TooltipContent>
                  Preview imported AST JSON without replacing the current project
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="muted"
                      size="compact"
                      type="button"
                      className="h-8 px-3"
                      disabled={!selectors.selectedScene}
                      onClick={() => dispatch({ type: "setPreviewOpen", previewOpen: true })}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                  }
                />
                <TooltipContent>Preview current scene</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="accent"
                      size="compact"
                      type="button"
                      className="h-8 px-3"
                      onClick={() => void handleExport()}
                    >
                      Export
                    </Button>
                  }
                />
                <TooltipContent>Export project JSON</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {previewAstError ? (
            <div className="absolute top-[46px] right-3 z-20 max-w-sm border border-[#e76464]/50 bg-[#281313] px-3 py-2 font-mono text-[11px] text-[#f0b1b1] shadow-[2px_2px_0_#000]">
              {previewAstError}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#171717]">
              <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
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
                        <Grid3x3 size={14} />
                      </Button>
                    }
                  />
                  <TooltipContent>{state.gridVisible ? "Hide grid" : "Show grid"}</TooltipContent>
                </Tooltip>

                <div className="flex-1 font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/38">
                  Grid
                </div>

                <div className="w-36">
                  <Slider
                    min={0}
                    max={GRID_SIZE_BREAKPOINTS.length - 1}
                    step={1}
                    value={gridSizeStepIndex}
                    onValueChange={(value) => {
                      const nextIndex = Array.isArray(value) ? (value[0] ?? 1) : value;
                      mutate((draft) => {
                        draft.gridSize = gridSizeBreakpoints[nextIndex] ?? 4;
                      });
                    }}
                    className="py-1"
                  />
                  <div className="mt-1 flex justify-between font-mono text-[8px] leading-none text-white/24">
                    {gridSizeBreakpoints.map((breakpoint) => {
                      const isActive = breakpoint === state.gridSize;
                      return (
                        <span
                          key={breakpoint}
                          className="flex w-0 shrink-0 justify-center overflow-visible"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              mutate((draft) => {
                                draft.gridSize = breakpoint;
                              });
                            }}
                            className={cn(
                              "inline-flex h-4 min-w-[14px] cursor-pointer items-center justify-center rounded-sm px-1 text-[8px] leading-none transition-colors",
                              isActive
                                ? "bg-accent/15 font-bold text-accent"
                                : "text-white/38 hover:bg-white/[0.06] hover:text-white/86",
                            )}
                          >
                            {breakpoint}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <AssetsPanel
                uploadThingAssets={uploadThingAssets.assets}
                uploadThingLoading={uploadThingAssets.loading}
                uploadThingError={uploadThingAssets.error}
                projectAssets={projectAssets}
                onUploadComplete={() => void handleUploadComplete()}
                onDeleteUploadThingAsset={(key) => void uploadThingAssets.deleteAsset(key)}
                onBulkDeleteUploadThingAssets={(keys) => void uploadThingAssets.deleteAssets(keys)}
                deletingUploadThingAssetKeys={uploadThingAssets.deletingKeys}
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
              selectedAsset={selectedAsset}
              workspaceRef={workspaceRef}
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

          <PreviewOverlay />

          <DragOverlay dropAnimation={null}>
            {activeDrag ? (
              isAssetDragData(activeDrag) ? (
                state.dragGhost ? null : (
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
                )
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
    </TooltipProvider>
  );
}
