import { readImageSize, createPlacedNode } from "@/editor/assets";
import {
  DEFAULT_VIEWPORT_SCALE,
  FOLDER_ASSET_MIME,
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  PROJECT_ASSET_MIME,
} from "@/editor/constants";
import {
  calculateResizeBounds,
  clampViewportScale,
  hitTestMarquee,
  nextId,
  snapToGrid,
} from "@/editor/geometry";
import type {
  EditorDispatch,
  EditorSelectors,
  EditorState,
  FolderSpriteSource,
  ResizeHandle,
} from "@/editor/types";
import type { SpriteAsset, SpriteNode } from "../../../../../shared/ast";
import { FloatingNodeToolbar } from "./FloatingNodeToolbar";
import { SceneCanvas } from "./SceneCanvas";
import { SelectionOverlay } from "./SelectionOverlay";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type WorkspaceProps = {
  state: EditorState;
  selectors: EditorSelectors;
  workspaceRef: React.RefObject<HTMLDivElement | null>;
  folderSpriteSizeCacheRef: React.MutableRefObject<Map<string, { width: number; height: number }>>;
  mutate: (mutation: (draft: EditorState) => void) => void;
  dispatch: EditorDispatch;
  updateNode: (nodeId: string, updater: (node: SpriteNode) => void) => void;
  onDeleteSelected: () => void;
  onDuplicateNode: (nodeId: string) => void;
  onBringForward: (nodeId: string) => void;
  onSendBackward: (nodeId: string) => void;
};

type Point = { x: number; y: number };

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Workspace(props: WorkspaceProps) {
  const {
    state,
    selectors,
    workspaceRef,
    folderSpriteSizeCacheRef,
    mutate,
    dispatch,
    updateNode,
    onDeleteSelected,
    onDuplicateNode,
    onBringForward,
    onSendBackward,
  } = props;

  const selectedScene = selectors.selectedScene;
  const zoom = state.viewportScale;

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const panRef = useRef(pan);
  const spaceDownRef = useRef(false);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({
        width: rect.width,
        height: rect.height,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [workspaceRef]);

  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height) return;

    setPan({
      x: Math.round((viewportSize.width - selectedScene.size.width * zoom) / 2),
      y: Math.round((viewportSize.height - selectedScene.size.height * zoom) / 2),
    });
  }, [
    selectedScene.id,
    selectedScene.size.height,
    selectedScene.size.width,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        spaceDownRef.current = true;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        mutate((draft) => {
          draft.selectedNodeIds = [];
        });
      }

      if ((event.key === "Delete" || event.key === "Backspace") && state.selectedNodeIds.length) {
        event.preventDefault();
        onDeleteSelected();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        spaceDownRef.current = false;
      }
    };

    const onBlur = () => {
      spaceDownRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [mutate, onDeleteSelected, state.selectedNodeIds.length]);

  const screenToWorld = (clientX: number, clientY: number) => {
    const element = workspaceRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();

    return {
      x: (clientX - rect.left - panRef.current.x) / zoom,
      y: (clientY - rect.top - panRef.current.y) / zoom,
    };
  };

  const beginPointerSession = (
    pointerId: number,
    move: (event: PointerEvent) => void,
    end?: () => void,
    clearInteraction = true,
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
      if (clearInteraction) {
        dispatch({ type: "setInteraction", interaction: null });
      }
      end?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const startPanSession = (pointerId: number, startClientX: number, startClientY: number) => {
    const origin = panRef.current;
    beginPointerSession(
      pointerId,
      (event) => {
        setPan({
          x: origin.x + (event.clientX - startClientX),
          y: origin.y + (event.clientY - startClientY),
        });
      },
      undefined,
      false,
    );
  };

  const handleSelectNode = (nodeId: string, additive: boolean) => {
    mutate((draft) => {
      if (!additive) {
        draft.selectedNodeIds = [nodeId];
        return;
      }

      draft.selectedNodeIds = draft.selectedNodeIds.includes(nodeId)
        ? draft.selectedNodeIds.filter((entry) => entry !== nodeId)
        : [...draft.selectedNodeIds, nodeId];
    });
  };

  const handleStartDrag = (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
    if (spaceDownRef.current || event.button === 1) {
      startPanSession(event.pointerId, event.clientX, event.clientY);
      return;
    }

    const node = selectedScene.nodes.find((entry) => entry.id === nodeId);
    if (!node) return;

    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    if (additive) {
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
        .map((entry) => [entry.id, { x: entry.x, y: entry.y }]),
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
      const deltaX = (moveEvent.clientX - event.clientX) / zoom;
      const deltaY = (moveEvent.clientY - event.clientY) / zoom;

      mutate((draft) => {
        const scene = draft.project.scenes.find((entry) => entry.id === selectedScene.id);
        if (!scene) return;

        for (const activeId of activeIds) {
          const target = scene.nodes.find((entry) => entry.id === activeId);
          const origin = origins[activeId];
          if (!target || !origin || target.locked) continue;
          target.x = snapToGrid(origin.x + deltaX, draft.gridSize);
          target.y = snapToGrid(origin.y + deltaY, draft.gridSize);
        }
      });
    });
  };

  const handleStartResize = (
    nodeId: string,
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
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
      const deltaX = (moveEvent.clientX - event.clientX) / zoom;
      const deltaY = (moveEvent.clientY - event.clientY) / zoom;
      const next = calculateResizeBounds({
        handle,
        origin,
        deltaX,
        deltaY,
        gridSize: state.gridSize,
        keepAspect: moveEvent.shiftKey,
      });

      updateNode(nodeId, (draft) => {
        draft.x = next.x;
        draft.y = next.y;
        draft.width = next.width;
        draft.height = next.height;
      });
    });
  };

  const handleDropAsset = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const folderAssetPayload = event.dataTransfer.getData(FOLDER_ASSET_MIME);
    const projectAssetId = event.dataTransfer.getData(PROJECT_ASSET_MIME);
    const worldPoint = screenToWorld(event.clientX, event.clientY);

    const placeAsset = (asset: SpriteAsset) => {
      const placedWidth = state.dragGhost?.width ?? asset.width;
      const placedHeight = state.dragGhost?.height ?? asset.height;
      const nextNodeId = nextId(
        "node",
        selectedScene.nodes.map((node) => node.id),
      );
      const node = createPlacedNode(
        asset,
        nextNodeId,
        snapToGrid(worldPoint.x - placedWidth / 2, state.gridSize),
        snapToGrid(worldPoint.y - placedHeight / 2, state.gridSize),
      );
      node.width = placedWidth;
      node.height = placedHeight;

      mutate((draft) => {
        const scene = draft.project.scenes.find((entry) => entry.id === selectedScene.id);
        if (!scene) return;
        scene.nodes.push(node);
        draft.selectedNodeIds = [nextNodeId];
      });
    };

    if (projectAssetId) {
      const asset = state.project.assets[projectAssetId];
      if (asset) {
        placeAsset(asset);
      }
      return;
    }

    if (!folderAssetPayload) return;

    const source = JSON.parse(folderAssetPayload) as FolderSpriteSource;
    const existing = Object.values(state.project.assets).find(
      (asset) => asset.sourcePath && asset.sourcePath === source.sourcePath,
    );

    if (existing) {
      placeAsset(existing);
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

    placeAsset(nextAsset);
  };

  const toolbarPosition = useMemo(() => {
    if (!selectors.singleSelectedNode) return null;
    return {
      left: pan.x + selectors.singleSelectedNode.x * zoom,
      top: Math.max(10, pan.y + selectors.singleSelectedNode.y * zoom - 36),
    };
  }, [pan.x, pan.y, selectors.singleSelectedNode, zoom]);

  return (
    <main className="flex min-w-0 flex-1 flex-col bg-[#0b0b0b]">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#0b0b0b]">
        <div
          ref={workspaceRef}
          className={`relative h-full w-full overflow-hidden ${
            spaceDownRef.current ? "cursor-grab" : "cursor-default"
          }`}
          onWheel={(event) => {
            event.preventDefault();

            if (event.shiftKey) {
              const element = workspaceRef.current;
              if (!element) return;
              const rect = element.getBoundingClientRect();
              const mouseX = event.clientX - rect.left;
              const mouseY = event.clientY - rect.top;
              const factor = event.deltaY > 0 ? 0.92 : 1.08;
              const nextZoom = clampViewportScale(
                Math.round(
                  Math.min(MAX_VIEWPORT_SCALE, Math.max(MIN_VIEWPORT_SCALE, zoom * factor)) * 100,
                ) / 100,
              );

              if (nextZoom === zoom) return;

              const worldX = (mouseX - panRef.current.x) / zoom;
              const worldY = (mouseY - panRef.current.y) / zoom;

              setPan({
                x: mouseX - worldX * nextZoom,
                y: mouseY - worldY * nextZoom,
              });

              mutate((draft) => {
                draft.viewportScale = nextZoom;
              });
              return;
            }

            setPan((current) => ({
              x: current.x - event.deltaX,
              y: current.y - event.deltaY,
            }));
          }}
          onPointerDown={(event) => {
            if (event.button === 1 || (event.button === 0 && spaceDownRef.current)) {
              event.preventDefault();
              startPanSession(event.pointerId, event.clientX, event.clientY);
              return;
            }

            if (event.button !== 0) return;

            const origin = screenToWorld(event.clientX, event.clientY);
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
                originX: origin.x,
                originY: origin.y,
                currentX: origin.x,
                currentY: origin.y,
                additive,
                baseSelection,
              },
            });

            beginPointerSession(event.pointerId, (moveEvent) => {
              const current = screenToWorld(moveEvent.clientX, moveEvent.clientY);

              dispatch({
                type: "setInteraction",
                interaction: {
                  type: "marquee",
                  pointerId: event.pointerId,
                  originX: origin.x,
                  originY: origin.y,
                  currentX: current.x,
                  currentY: current.y,
                  additive,
                  baseSelection,
                },
              });

              const hits = hitTestMarquee(selectedScene.nodes, {
                x: Math.min(origin.x, current.x),
                y: Math.min(origin.y, current.y),
                width: Math.abs(current.x - origin.x),
                height: Math.abs(current.y - origin.y),
              });

              mutate((draft) => {
                draft.selectedNodeIds = additive
                  ? Array.from(new Set([...baseSelection, ...hits]))
                  : hits;
              });
            });
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!state.dragGhost) return;
            const point = screenToWorld(event.clientX, event.clientY);

            mutate((draft) => {
              if (!draft.dragGhost) return;
              draft.dragGhost.x = snapToGrid(point.x - draft.dragGhost.width / 2, draft.gridSize);
              draft.dragGhost.y = snapToGrid(point.y - draft.dragGhost.height / 2, draft.gridSize);
            });
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
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${selectedScene.size.width}px`,
              height: `${selectedScene.size.height}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <SceneCanvas
              scene={selectedScene}
              assets={state.project.assets}
              gridVisible={state.gridVisible}
              gridSize={state.gridSize}
              dragGhost={state.dragGhost}
            />

            <SelectionOverlay
              scene={selectedScene}
              assets={state.project.assets}
              selectedNodeIds={state.selectedNodeIds}
              selectedNodeSet={selectors.selectedNodeSet}
              marqueeRect={selectors.marqueeRect}
              onNodePointerDown={handleStartDrag}
              onResizePointerDown={handleStartResize}
            />
          </div>

          <FloatingNodeToolbar
            node={selectors.singleSelectedNode}
            toolbarPosition={toolbarPosition}
            onUpdateNode={updateNode}
            onDuplicateNode={onDuplicateNode}
            onBringForward={onBringForward}
            onSendBackward={onSendBackward}
            onDeleteSelected={onDeleteSelected}
          />

          {state.selectedNodeIds.length > 1 ? (
            <div className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 border border-white/14 bg-[#1b1b1b] px-3 py-2 shadow-[3px_3px_0_#000]">
              <span className="font-[var(--font-ui)] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/66">
                {state.selectedNodeIds.length} selected
              </span>
              <button
                type="button"
                className="sb-icon-button text-[#e76464]"
                onClick={onDeleteSelected}
                title="Delete selected"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1 border border-white/14 bg-[#1b1b1b] p-1 shadow-[3px_3px_0_#000]">
            <button
              type="button"
              title="Zoom out"
              className="sb-icon-button"
              onClick={() =>
                mutate((draft) => {
                  draft.viewportScale = Math.max(
                    MIN_VIEWPORT_SCALE,
                    Math.round((draft.viewportScale - 0.1) * 100) / 100,
                  );
                })
              }
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Reset zoom"
              className="min-w-[50px] px-1.5 font-mono text-[10px] text-white/65"
              onClick={() =>
                mutate((draft) => {
                  draft.viewportScale = DEFAULT_VIEWPORT_SCALE;
                })
              }
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              title="Zoom in"
              className="sb-icon-button"
              onClick={() =>
                mutate((draft) => {
                  draft.viewportScale = Math.min(
                    MAX_VIEWPORT_SCALE,
                    Math.round((draft.viewportScale + 0.1) * 100) / 100,
                  );
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
