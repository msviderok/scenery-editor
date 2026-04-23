import { createDefaultCollision, normalizeRotation, type SpriteAsset, type SpriteNode } from "../../../../../shared/ast";
import { getAssetUrl, readImageSize } from "@/editor/assets";
import {
  DEFAULT_VIEWPORT_SCALE,
  FOLDER_ASSET_MIME,
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  PROJECT_ASSET_MIME,
  WORKSPACE_PADDING,
} from "@/editor/constants";
import { calculateResizeBounds, hitTestMarquee, nextId, snapToGrid } from "@/editor/geometry";
import type {
  EditorDispatch,
  EditorSelectors,
  EditorState,
  FolderSpriteSource,
  ResizeHandle,
} from "@/editor/types";
import { Button } from "@/components/ui/button";
import { FloatingNodeToolbar } from "./FloatingNodeToolbar";
import { ResizeHint } from "./ResizeHint";
import { SceneCanvas } from "./SceneCanvas";
import { SelectionOverlay } from "./SelectionOverlay";
import { Trash2, ZoomIn, ZoomOut } from "lucide-react";

type WorkspaceProps = {
  state: EditorState;
  selectors: EditorSelectors;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  stylePopoverContentRef: React.RefObject<HTMLDivElement | null>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  mutate: (mutation: (draft: EditorState) => void) => void;
  dispatch: EditorDispatch;
  updateNode: (nodeId: string, updater: (node: SpriteNode) => void) => void;
  onDeleteSelected: () => void;
};

export function Workspace(props: WorkspaceProps) {
  const {
    state,
    selectors,
    workspaceRef,
    stylePopoverContentRef,
    folderSpriteSizeCacheRef,
    mutate,
    dispatch,
    updateNode,
    onDeleteSelected,
  } = props;

  const selectedScene = selectors.selectedScene;

  const beginPointerSession = (
    pointerId: number,
    move: (event: PointerEvent) => void,
    end?: () => void
  ) => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      move(event);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      dispatch({ type: "setInteraction", interaction: null });
      end?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const adjustViewportScale = (delta: number) => {
    mutate((draft) => {
      draft.viewportScale = Math.min(
        MAX_VIEWPORT_SCALE,
        Math.max(MIN_VIEWPORT_SCALE, Math.round((draft.viewportScale + delta) * 100) / 100)
      );
    });
  };

  const handleSelectNode = (nodeId: string, metaKey: boolean) => {
    mutate((draft) => {
      if (metaKey) {
        draft.selectedNodeIds = draft.selectedNodeIds.includes(nodeId)
          ? draft.selectedNodeIds.filter((entry) => entry !== nodeId)
          : [...draft.selectedNodeIds, nodeId];
        return;
      }
      draft.selectedNodeIds = [nodeId];
    });
  };

  const handleStartDrag = (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
    const node = selectedScene.nodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    if (event.metaKey || event.ctrlKey) {
      handleSelectNode(nodeId, true);
      return;
    }
    if (node.locked) {
      mutate((draft) => {
        draft.selectedNodeIds = [nodeId];
      });
      return;
    }

    const activeIds = selectors.selectedNodeSet.has(nodeId) ? state.selectedNodeIds : [nodeId];
    if (!selectors.selectedNodeSet.has(nodeId)) {
      mutate((draft) => {
        draft.selectedNodeIds = [nodeId];
      });
    }

    const origins = Object.fromEntries(
      selectedScene.nodes
        .filter((entry) => activeIds.includes(entry.id))
        .map((entry) => [entry.id, { x: entry.x, y: entry.y }])
    );

    dispatch({
      type: "setInteraction",
      interaction: {
        type: "drag",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        nodeIds: activeIds,
        origins,
      },
    });

    beginPointerSession(event.pointerId, (moveEvent) => {
      const deltaX = (moveEvent.clientX - event.clientX) / state.viewportScale;
      const deltaY = (moveEvent.clientY - event.clientY) / state.viewportScale;
      mutate((draft) => {
        const scene = draft.project.scenes.find((entry) => entry.id === selectedScene.id);
        if (!scene) return;
        for (const targetId of activeIds) {
          const target = scene.nodes.find((entry) => entry.id === targetId);
          const origin = origins[targetId];
          if (!target || !origin || target.locked) continue;
          target.x = snapToGrid(origin.x + deltaX, draft.gridSize);
          target.y = snapToGrid(origin.y + deltaY, draft.gridSize);
        }
      });
    });
  };

  const handleStartRotate = (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const node = selectedScene.nodes.find((entry) => entry.id === nodeId);
    const workspace = workspaceRef.current;
    if (!node || node.locked || !workspace) return;

    mutate((draft) => {
      draft.selectedNodeIds = [nodeId];
    });

    const rect = workspace.getBoundingClientRect();
    const centerSceneX = node.x + node.width / 2;
    const centerSceneY = node.y + node.height / 2;
    const centerX =
      rect.left + (WORKSPACE_PADDING + centerSceneX) * state.viewportScale - workspace.scrollLeft;
    const centerY =
      rect.top + (WORKSPACE_PADDING + centerSceneY) * state.viewportScale - workspace.scrollTop;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);

    dispatch({
      type: "setInteraction",
      interaction: {
        type: "rotate",
        pointerId: event.pointerId,
        nodeId,
        centerX,
        centerY,
        startAngle,
        startRotation: node.rotation,
      },
    });

    beginPointerSession(event.pointerId, (moveEvent) => {
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
      const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
      let next = normalizeRotation(node.rotation + deltaDeg);
      if (moveEvent.shiftKey) next = Math.round(next / 15) * 15;
      updateNode(nodeId, (draft) => {
        draft.rotation = next;
      });
    });
  };

  const handleStartResize = (
    nodeId: string,
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.stopPropagation();
    const node = selectedScene.nodes.find((entry) => entry.id === nodeId);
    if (!node || node.locked) return;

    mutate((draft) => {
      draft.selectedNodeIds = [nodeId];
    });

    const origin = { x: node.x, y: node.y, width: node.width, height: node.height };
    dispatch({
      type: "setInteraction",
      interaction: {
        type: "resize",
        pointerId: event.pointerId,
        nodeId,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        origin,
      },
    });

    beginPointerSession(event.pointerId, (moveEvent) => {
      const deltaX = (moveEvent.clientX - event.clientX) / state.viewportScale;
      const deltaY = (moveEvent.clientY - event.clientY) / state.viewportScale;
      const nextBounds = calculateResizeBounds({
        handle,
        origin,
        deltaX,
        deltaY,
        gridSize: state.gridSize,
        keepAspect: !moveEvent.shiftKey,
      });

      updateNode(nodeId, (draft) => {
        draft.x = nextBounds.x;
        draft.y = nextBounds.y;
        draft.width = nextBounds.width;
        draft.height = nextBounds.height;
      });
    });
  };

  const handleDropAsset = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const assetId = event.dataTransfer.getData(PROJECT_ASSET_MIME);
    const folderAssetPayload = event.dataTransfer.getData(FOLDER_ASSET_MIME);
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const placeAssetNode = (asset: SpriteAsset) => {
      const rect = workspace.getBoundingClientRect();
      const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
      const scale = Math.min(1, capHeight / asset.height);
      const width = Math.round(asset.width * scale);
      const height = Math.round(asset.height * scale);
      const pointerSceneX =
        (event.clientX - rect.left + workspace.scrollLeft) / state.viewportScale - WORKSPACE_PADDING;
      const pointerSceneY =
        (event.clientY - rect.top + workspace.scrollTop) / state.viewportScale - WORKSPACE_PADDING;
      const x = snapToGrid(pointerSceneX - width / 2, state.gridSize);
      const y = snapToGrid(pointerSceneY - height / 2, state.gridSize);
      const nodeId = nextId(
        "node",
        selectedScene.nodes.map((node) => node.id)
      );

      mutate((draft) => {
        const scene = draft.project.scenes.find((entry) => entry.id === selectedScene.id);
        if (!scene) return;
        scene.nodes.push({
          id: nodeId,
          assetId: asset.id,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: 1,
          locked: false,
          collisions: createDefaultCollision(),
          style: {
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          },
        });
        draft.selectedNodeIds = [nodeId];
      });
    };

    if (assetId) {
      const asset = state.project.assets[assetId];
      if (asset) {
        placeAssetNode(asset);
      }
      return;
    }

    if (!folderAssetPayload) return;
    const source = JSON.parse(folderAssetPayload) as FolderSpriteSource;
    const existing = Object.values(state.project.assets).find(
      (asset) => asset.sourcePath && asset.sourcePath === source.sourcePath
    );
    if (existing) {
      placeAssetNode(existing);
      return;
    }

    const size =
      folderSpriteSizeCacheRef.current.get(source.url) ?? (await readImageSize(source.url));
    folderSpriteSizeCacheRef.current.set(source.url, size);

    const nextAsset: SpriteAsset = {
      id: nextId("asset", Object.keys(state.project.assets)),
      kind: "image",
      fileName: source.fileName,
      width: size.width,
      height: size.height,
      mimeType: source.mimeType,
      sourcePath: source.sourcePath,
      url: source.url,
    };

    mutate((draft) => {
      draft.project.assets[nextAsset.id] = nextAsset;
    });
    placeAssetNode(nextAsset);
  };

  return (
    <main className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Current scene</div>
          <strong className="text-sm">{selectedScene.name}</strong>
          <span className="text-[11px] text-white/35">
            {selectedScene.nodes.length} nodes • {state.selectedNodeIds.length} selected
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-md border border-white/8 bg-white/6 p-0.5 text-[11px] text-white/70">
            <Button variant="ghost" size="icon-sm" title="Zoom out" onClick={() => adjustViewportScale(-0.1)}>
              <ZoomOut />
            </Button>
            <button
              className="min-w-[52px] rounded px-2 text-center text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white [font-variant-numeric:tabular-nums]"
              title="Reset zoom"
              onClick={() =>
                mutate((draft) => {
                  draft.viewportScale = DEFAULT_VIEWPORT_SCALE;
                })
              }
            >
              {Math.round(state.viewportScale * 100)}%
            </button>
            <Button variant="ghost" size="icon-sm" title="Zoom in" onClick={() => adjustViewportScale(0.1)}>
              <ZoomIn />
            </Button>
          </div>
          <Button
            variant="destructive"
            size="icon-sm"
            title="Delete selection"
            disabled={!selectors.selectedUnlockedNodeIds.length}
            onClick={onDeleteSelected}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={workspaceRef}
          className="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => {
            mutate((draft) => {
              draft.workspaceScroll = {
                left: event.currentTarget.scrollLeft,
                top: event.currentTarget.scrollTop,
              };
            });
          }}
          onDragOver={(event) => {
            event.preventDefault();
            const workspace = workspaceRef.current;
            if (!workspace) return;

            const folderPayload = event.dataTransfer.types.includes(FOLDER_ASSET_MIME);
            const assetPayload = event.dataTransfer.types.includes(PROJECT_ASSET_MIME);
            if (!folderPayload && !assetPayload) return;

            const rect = workspace.getBoundingClientRect();
            const rawX =
              (event.clientX - rect.left + workspace.scrollLeft) / state.viewportScale - WORKSPACE_PADDING;
            const rawY =
              (event.clientY - rect.top + workspace.scrollTop) / state.viewportScale - WORKSPACE_PADDING;

            if (state.dragGhost) {
              mutate((draft) => {
                if (!draft.dragGhost) return;
                draft.dragGhost.x = snapToGrid(rawX - draft.dragGhost.width / 2, draft.gridSize);
                draft.dragGhost.y = snapToGrid(rawY - draft.dragGhost.height / 2, draft.gridSize);
              });
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              dispatch({ type: "setDragGhost", dragGhost: null });
            }
          }}
          onDrop={(event) => {
            void handleDropAsset(event);
            dispatch({ type: "setDragGhost", dragGhost: null });
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const workspace = workspaceRef.current;
            if (!workspace) return;

            const rect = workspace.getBoundingClientRect();
            const originX =
              (event.clientX - rect.left + workspace.scrollLeft) / state.viewportScale - WORKSPACE_PADDING;
            const originY =
              (event.clientY - rect.top + workspace.scrollTop) / state.viewportScale - WORKSPACE_PADDING;
            const additive = event.metaKey || event.ctrlKey || event.shiftKey;
            const baseSelection = additive ? state.selectedNodeIds : [];

            if (!additive) {
              mutate((draft) => {
                draft.selectedNodeIds = [];
              });
            }

            dispatch({
              type: "setInteraction",
              interaction: {
                type: "marquee",
                pointerId: event.pointerId,
                originX,
                originY,
                currentX: originX,
                currentY: originY,
                additive,
                baseSelection,
              },
            });

            beginPointerSession(event.pointerId, (moveEvent) => {
              const ws = workspaceRef.current;
              if (!ws) return;

              const wsRect = ws.getBoundingClientRect();
              const currentX =
                (moveEvent.clientX - wsRect.left + ws.scrollLeft) / state.viewportScale - WORKSPACE_PADDING;
              const currentY =
                (moveEvent.clientY - wsRect.top + ws.scrollTop) / state.viewportScale - WORKSPACE_PADDING;

              dispatch({
                type: "setInteraction",
                interaction: {
                  type: "marquee",
                  pointerId: event.pointerId,
                  originX,
                  originY,
                  currentX,
                  currentY,
                  additive,
                  baseSelection,
                },
              });

              const hits = hitTestMarquee(selectedScene.nodes, {
                x: Math.min(originX, currentX),
                y: Math.min(originY, currentY),
                width: Math.abs(currentX - originX),
                height: Math.abs(currentY - originY),
              });

              mutate((draft) => {
                draft.selectedNodeIds = additive ? Array.from(new Set([...baseSelection, ...hits])) : hits;
              });
            });
          }}
        >
          <div
            className="relative min-h-full min-w-full"
            style={{
              width: `${(selectedScene.size.width + WORKSPACE_PADDING * 2) * state.viewportScale}px`,
              height: `${(selectedScene.size.height + WORKSPACE_PADDING * 2) * state.viewportScale}px`,
            }}
          >
            <SceneCanvas
              scene={selectedScene}
              assets={state.project.assets}
              viewportScale={state.viewportScale}
              gridVisible={state.gridVisible}
              gridSize={state.gridSize}
              dragGhost={state.dragGhost}
            />

            <SelectionOverlay
              scene={selectedScene}
              viewportScale={state.viewportScale}
              selectedNodeIds={state.selectedNodeIds}
              selectedNodeSet={selectors.selectedNodeSet}
              marqueeRect={selectors.marqueeRect}
              onNodePointerDown={handleStartDrag}
              onRotatePointerDown={handleStartRotate}
              onResizePointerDown={handleStartResize}
            />

            <FloatingNodeToolbar
              node={selectors.singleSelectedNode}
              toolbarPosition={selectors.toolbarPosition}
              selectedUnlockedNodeIds={selectors.selectedUnlockedNodeIds}
              nodeStyleId={state.nodeStyleId}
              collisionEditorId={state.collisionEditorId}
              stylePopoverContentRef={stylePopoverContentRef}
              onSetNodeStyleOpen={(open, nodeId) =>
                mutate((draft) => {
                  draft.nodeStyleId = open ? nodeId : null;
                })
              }
              onSetCollisionEditorOpen={(open, nodeId) =>
                mutate((draft) => {
                  draft.collisionEditorId = open ? nodeId : null;
                })
              }
              onUpdateNode={updateNode}
              onDeleteSelected={onDeleteSelected}
            />
          </div>
        </div>

        <ResizeHint visible={state.interaction?.type === "resize"} shiftHeld={state.shiftHeld} />
      </div>
    </main>
  );
}
