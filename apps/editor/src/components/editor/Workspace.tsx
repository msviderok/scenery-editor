import { readImageSize, createPlacedNode } from "@/editor/assets";
import { useDragDropMonitor, useDroppable } from "@dnd-kit/react";
import {
  DEFAULT_VIEWPORT_SCALE,
  MAX_VIEWPORT_SCALE,
  MIN_VIEWPORT_SCALE,
  SHIFT_SCROLL_ZOOM_SPEED,
  TRACKPAD_PINCH_ZOOM_SENSITIVITY,
} from "@/editor/constants";
import {
  DND_TYPE_FOLDER_ASSET,
  DND_TYPE_PROJECT_ASSET,
  WORKSPACE_DROP_ZONE_ID,
  createAssetDragGhost,
  isAssetDragData,
  type AssetDragData,
} from "@/editor/dnd";
import {
  calculateResizeBounds,
  clampViewportScale,
  hitTestMarquee,
  nextId,
  snapToGrid,
} from "@/editor/geometry";
import type { EditorDispatch, EditorSelectors, EditorState, ResizeHandle } from "@/editor/types";
import type { SpriteAsset, SpriteNode } from "@msviderok/sprite-editor-ast-schema";
import { FloatingNodeToolbar } from "./FloatingNodeToolbar";
import { SceneBackgroundToolbar } from "./SceneBackgroundToolbar";
import { SceneCanvas } from "./SceneCanvas";
import { SelectionOverlay } from "./SelectionOverlay";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type WorkspaceProps = {
  state: EditorState;
  selectors: EditorSelectors;
  selectedAsset: SpriteAsset | null;
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
type WebKitGestureEvent = Event & {
  clientX: number;
  clientY: number;
  scale: number;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function Workspace(props: WorkspaceProps) {
  const {
    state,
    selectors,
    selectedAsset,
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
  const { ref: workspaceDropRef, isDropTarget } = useDroppable({
    id: WORKSPACE_DROP_ZONE_ID,
    accept: [DND_TYPE_FOLDER_ASSET, DND_TYPE_PROJECT_ASSET],
  });

  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const spaceDownRef = useRef(false);
  const gestureZoomStartRef = useRef<{ pan: Point; zoom: number } | null>(null);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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

  const applyZoomAtClientPoint = (
    nextZoom: number,
    clientX: number,
    clientY: number,
    base?: {
      pan: Point;
      zoom: number;
    },
  ) => {
    const element = workspaceRef.current;
    if (!element) return;

    const referenceZoom = base?.zoom ?? zoomRef.current;
    if (nextZoom === referenceZoom) return;

    const referencePan = base?.pan ?? panRef.current;
    const rect = element.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - referencePan.x) / referenceZoom;
    const worldY = (localY - referencePan.y) / referenceZoom;

    setPan({
      x: localX - worldX * nextZoom,
      y: localY - worldY * nextZoom,
    });

    mutate((draft) => {
      draft.viewportScale = nextZoom;
    });
  };

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;

    const onGestureStart = (event: Event) => {
      const gestureEvent = event as WebKitGestureEvent;
      gestureZoomStartRef.current = {
        pan: panRef.current,
        zoom: zoomRef.current,
      };
      event.preventDefault();
      applyZoomAtClientPoint(zoomRef.current, gestureEvent.clientX, gestureEvent.clientY);
    };

    const onGestureChange = (event: Event) => {
      const gestureEvent = event as WebKitGestureEvent;
      const start = gestureZoomStartRef.current;
      if (!start) return;

      event.preventDefault();
      const nextZoom = clampViewportScale(Math.round(start.zoom * gestureEvent.scale * 100) / 100);
      applyZoomAtClientPoint(nextZoom, gestureEvent.clientX, gestureEvent.clientY, start);
    };

    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureZoomStartRef.current = null;
    };

    element.addEventListener("gesturestart", onGestureStart, { passive: false });
    element.addEventListener("gesturechange", onGestureChange, { passive: false });
    element.addEventListener("gestureend", onGestureEnd, { passive: false });

    return () => {
      element.removeEventListener("gesturestart", onGestureStart);
      element.removeEventListener("gesturechange", onGestureChange);
      element.removeEventListener("gestureend", onGestureEnd);
    };
  }, [mutate, workspaceRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isEditableTarget(event.target)) {
        spaceDownRef.current = true;
      }

      if (isEditableTarget(event.target)) return;

      if (event.key === "Escape") {
        mutate((draft) => {
          draft.selectedNodeIds = [];
          draft.backgroundSelected = false;
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

  const clearDragGhost = () => {
    dispatch({ type: "setDragGhost", dragGhost: null });
  };

  const updateAssetGhost = (dragData: AssetDragData, clientX: number, clientY: number) => {
    const point = screenToWorld(clientX, clientY);

    mutate((draft) => {
      const nextGhost = createAssetDragGhost(dragData);
      nextGhost.x = snapToGrid(point.x - nextGhost.width / 2, draft.gridSize);
      nextGhost.y = snapToGrid(point.y - nextGhost.height / 2, draft.gridSize);
      draft.dragGhost = nextGhost;
    });
  };

  const placeDroppedAsset = async (dragData: AssetDragData, clientX: number, clientY: number) => {
    const worldPoint = screenToWorld(clientX, clientY);

    const placeAsset = (asset: SpriteAsset) => {
      const placedWidth = dragData.previewWidth;
      const placedHeight = dragData.previewHeight;
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

    if (dragData.kind === DND_TYPE_PROJECT_ASSET) {
      const asset = state.project.assets[dragData.assetId];
      if (asset) {
        placeAsset(asset);
      }
      return;
    }

    const existing = Object.values(state.project.assets).find(
      (asset) => asset.sourcePath && asset.sourcePath === dragData.sprite.sourcePath,
    );

    if (existing) {
      placeAsset(existing);
      return;
    }

    const size =
      dragData.naturalWidth && dragData.naturalHeight
        ? { width: dragData.naturalWidth, height: dragData.naturalHeight }
        : (folderSpriteSizeCacheRef.current.get(dragData.sprite.url) ??
          (await readImageSize(dragData.sprite.url)));

    folderSpriteSizeCacheRef.current.set(dragData.sprite.url, size);

    const nextAsset: SpriteAsset = {
      id: nextId("asset", Object.keys(state.project.assets)),
      kind: "image",
      fileName: dragData.sprite.fileName,
      width: size.width,
      height: size.height,
      mimeType: dragData.sprite.mimeType,
      sourcePath: dragData.sprite.sourcePath,
      url: dragData.sprite.url,
    };

    mutate((draft) => {
      draft.project.assets[nextAsset.id] = nextAsset;
    });

    placeAsset(nextAsset);
  };

  useDragDropMonitor({
    onDragMove(event) {
      const sourceData = event.operation.source?.data;
      const position = (event.operation.position as { current?: { x: number; y: number } }).current;

      if (!isAssetDragData(sourceData) || !position) {
        return;
      }

      if (event.operation.target?.id !== WORKSPACE_DROP_ZONE_ID) {
        if (state.dragGhost) {
          clearDragGhost();
        }
        return;
      }

      updateAssetGhost(sourceData, position.x, position.y);
    },
    onDragOver(event) {
      const sourceData = event.operation.source?.data;
      const position = (event.operation.position as { current?: { x: number; y: number } }).current;

      if (!isAssetDragData(sourceData) || !position) {
        return;
      }

      if (event.operation.target?.id === WORKSPACE_DROP_ZONE_ID) {
        updateAssetGhost(sourceData, position.x, position.y);
        return;
      }

      if (state.dragGhost) {
        clearDragGhost();
      }
    },
    onDragEnd(event) {
      const sourceData = event.operation.source?.data;
      const position = (event.operation.position as { current?: { x: number; y: number } }).current;

      if (!isAssetDragData(sourceData)) {
        return;
      }

      if (event.operation.target?.id === WORKSPACE_DROP_ZONE_ID && position) {
        void placeDroppedAsset(sourceData, position.x, position.y);
      }

      clearDragGhost();
    },
  });

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
        freeForm: moveEvent.shiftKey,
      });

      updateNode(nodeId, (draft) => {
        draft.x = next.x;
        draft.y = next.y;
        draft.width = next.width;
        draft.height = next.height;
      });
    });
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
          ref={(element) => {
            workspaceRef.current = element;
            workspaceDropRef(element);
          }}
          className={`relative h-full w-full overflow-hidden ${
            spaceDownRef.current ? "cursor-grab" : "cursor-default"
          }`}
          onWheel={(event) => {
            event.preventDefault();

            if (event.ctrlKey) {
              const factor = Math.exp(-event.deltaY * TRACKPAD_PINCH_ZOOM_SENSITIVITY);
              const nextZoom = clampViewportScale(Math.round(zoomRef.current * factor * 100) / 100);
              applyZoomAtClientPoint(nextZoom, event.clientX, event.clientY);
              return;
            }

            if (event.shiftKey) {
              const factor =
                event.deltaY > 0 ? 1 - SHIFT_SCROLL_ZOOM_SPEED : 1 + SHIFT_SCROLL_ZOOM_SPEED;
              const nextZoom = clampViewportScale(
                Math.round(
                  Math.min(
                    MAX_VIEWPORT_SCALE,
                    Math.max(MIN_VIEWPORT_SCALE, zoomRef.current * factor),
                  ) * 100,
                ) / 100,
              );
              applyZoomAtClientPoint(nextZoom, event.clientX, event.clientY);
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
                draft.backgroundSelected = false;
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

            const startClientX = event.clientX;
            const startClientY = event.clientY;
            let moved = false;
            const hasBackgroundImage = Boolean(selectedScene.backgroundStyle.backgroundImage);
            const insideScene =
              origin.x >= 0 &&
              origin.y >= 0 &&
              origin.x <= selectedScene.size.width &&
              origin.y <= selectedScene.size.height;

            beginPointerSession(
              event.pointerId,
              (moveEvent) => {
                if (
                  !moved &&
                  Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY) > 3
                ) {
                  moved = true;
                }

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
              },
              () => {
                if (moved || additive) return;
                if (!hasBackgroundImage || !insideScene) return;
                mutate((draft) => {
                  if (draft.selectedNodeIds.length > 0) return;
                  draft.backgroundSelected = true;
                });
              },
            );
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
              dropTargetActive={isDropTarget}
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

            {state.backgroundSelected ? (
              <div
                className="pointer-events-none absolute left-0 top-0 z-30 border-2 border-[var(--accent)]"
                style={{
                  width: `${selectedScene.size.width}px`,
                  height: `${selectedScene.size.height}px`,
                }}
              />
            ) : null}
          </div>

          <SceneBackgroundToolbar
            scene={selectedScene}
            pan={pan}
            zoom={zoom}
            selected={state.backgroundSelected}
          />

          <FloatingNodeToolbar
            node={selectors.singleSelectedNode}
            asset={selectedAsset}
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
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="iconButton"
                      type="button"
                      className="text-[#e76464]"
                      onClick={onDeleteSelected}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <TooltipContent>Delete selected</TooltipContent>
              </Tooltip>
            </div>
          ) : null}

          <div className="absolute bottom-3 right-3 z-40 flex items-center gap-1 border border-white/14 bg-[#1b1b1b] p-1 shadow-[3px_3px_0_#000]">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="iconButton"
                    type="button"
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
                  </Button>
                }
              />
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    className="min-w-[50px] px-1.5 font-mono text-[10px] text-white/65"
                    onClick={() =>
                      mutate((draft) => {
                        draft.viewportScale = DEFAULT_VIEWPORT_SCALE;
                      })
                    }
                  >
                    {Math.round(zoom * 100)}%
                  </Button>
                }
              />
              <TooltipContent>Reset zoom</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="iconButton"
                    type="button"
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
                  </Button>
                }
              />
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </main>
  );
}
