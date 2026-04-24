import { AssetsPanel } from "@/components/editor/AssetsPanel";
import { ScenesPanel } from "@/components/editor/ScenesPanel";
import { Workspace } from "@/components/editor/Workspace";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  buildEmbeddedExportProject,
  readImageSize,
  serializeEmbeddedProject,
} from "@/editor/assets";
import { DEFAULT_VIEWPORT_SCALE, SPRITES_MANIFEST_ROUTE } from "@/editor/constants";
import { nextId, swapAtIndex } from "@/editor/geometry";
import { getNextPersistenceSlot } from "@/editor/persistence";
import { useEditorEffects } from "@/editor/useEditorEffects";
import { useEditorState } from "@/editor/useEditorState";
import { useRef } from "react";
import { createDefaultScene, parseSpriteProject, type SpriteAsset } from "../../../shared/ast";

export default function App() {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stylePopoverContentRef = useRef<HTMLDivElement>(null);
  const folderSpriteSizeCacheRef = useRef(new Map<string, { width: number; height: number }>());
  const autosaveTimerRef = useRef<number | null>(null);
  const pendingPersistencePayloadRef = useRef<string | null>(null);
  const nextPersistenceSlotRef = useRef<0 | 1>(getNextPersistenceSlot());
  const restoredWorkspaceScrollRef = useRef(false);

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

  const projectAssets = Object.values(state.project.assets);
  const projectAssetsBySourcePath = new Map<string, SpriteAsset>(
    projectAssets
      .filter((asset): asset is SpriteAsset & { sourcePath: string } => Boolean(asset.sourcePath))
      .map((asset) => [asset.sourcePath!, asset]),
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      {state.persistenceError ? (
        <div className="col-span-full border-b-2 border-border bg-secondary-background px-4 py-2 text-xs font-medium text-foreground">
          {state.persistenceError}
        </div>
      ) : null}

      <aside className="flex h-screen max-h-screen flex-col gap-3 overflow-hidden border-b-2 border-border bg-secondary-background p-4 lg:sticky lg:top-0 lg:border-r lg:border-b-0">
        <div className="shrink-0 rounded-2xl border-2 border-border bg-background p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-muted-foreground text-[10px] uppercase tracking-[0.22em]">
                Sprite editor
              </div>
              <h1 className="text-[15px] font-semibold">Scene authoring</h1>
            </div>
            <Button size="sm" onClick={() => void handleExport()}>
              Export AST
            </Button>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <label
              className={`${buttonVariants({ variant: "neutral", size: "sm" })} relative cursor-pointer overflow-hidden text-[11px] uppercase tracking-[0.08em]`}
            >
              <span>Import AST</span>
              <input
                className="hidden"
                type="file"
                accept=".json,.sprite.json"
                onChange={(event) => {
                  void handleImportProject(event.currentTarget.files?.[0]);
                }}
              />
            </label>
          </div>
        </div>

        <ScenesPanel
          project={state.project}
          selectedScene={selectors.selectedScene}
          selectedSceneId={state.selectedSceneId}
          gridVisible={state.gridVisible}
          gridSize={state.gridSize}
          onAddScene={() => {
            mutate((draft) => {
              const id = nextId(
                "scene",
                draft.project.scenes.map((scene) => scene.id),
              );
              draft.project.scenes.push(
                createDefaultScene(id, `Scene ${draft.project.scenes.length + 1}`),
              );
              draft.selectedSceneId = id;
              draft.selectedNodeIds = [];
            });
          }}
          onDeleteScene={() => {
            mutate((draft) => {
              const current = draft.project.scenes.find(
                (scene) => scene.id === draft.selectedSceneId,
              );
              if (!current) return;
              draft.project.scenes = draft.project.scenes.filter(
                (scene) => scene.id !== current.id,
              );
              const nextScene = draft.project.scenes[0];
              if (nextScene) {
                draft.selectedSceneId = nextScene.id;
              }
              draft.selectedNodeIds = [];
            });
          }}
          onSelectScene={(sceneId) =>
            mutate((draft) => {
              draft.selectedSceneId = sceneId;
              draft.selectedNodeIds = [];
            })
          }
          onMoveScene={(from, to) =>
            mutate((draft) => {
              draft.project.scenes = swapAtIndex(draft.project.scenes, from, to);
            })
          }
          onUpdateScene={updateScene}
          onSetGridVisible={(visible) =>
            mutate((draft) => {
              draft.gridVisible = visible;
            })
          }
          onSetGridSize={(gridSize) =>
            mutate((draft) => {
              draft.gridSize = gridSize;
            })
          }
        />

        <AssetsPanel
          folderSprites={state.folderSprites}
          projectAssets={projectAssets}
          projectAssetsBySourcePath={projectAssetsBySourcePath}
          dragGhost={state.dragGhost}
          folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
          onRefresh={() => void refreshFolderSprites()}
          mutate={mutate}
        />
      </aside>

      <Workspace
        state={state}
        selectors={selectors}
        workspaceRef={workspaceRef}
        stylePopoverContentRef={stylePopoverContentRef}
        folderSpriteSizeCacheRef={folderSpriteSizeCacheRef}
        mutate={mutate}
        dispatch={dispatch}
        updateNode={updateNode}
        onDeleteSelected={handleDeleteSelected}
      />
    </div>
  );
}
