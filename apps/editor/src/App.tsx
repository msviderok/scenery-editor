import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { createStore, produce, unwrap } from "solid-js/store";
import {
  createDefaultCollision,
  createDefaultScene,
  createEmptyProject,
  hasAnyCollision,
  normalizeRotation,
  parseSpriteProject,
  serializeSpriteProject,
  type BackgroundStyle,
  type SpriteAsset,
  type SpriteNode,
} from "../../../shared/ast";
import { PopoverContent, PopoverRoot, PopoverSection, PopoverTrigger } from "./popover";
import {
  Lock,
  LockOpen,
  Trash2,
  RotateCw,
  ChevronDown,
  ArrowUp as IconArrowUp,
  ArrowDown as IconArrowDown,
  Plus as IconPlus,
  RefreshCw as IconRefresh,
  ZoomIn,
  ZoomOut,
  Power,
  ArrowUpToLine,
  ArrowRightToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible";
import { Button } from "./components/ui/button";

const WORKSPACE_PADDING = 240;
const MIN_NODE_SIZE = 24;
const AUTOSAVE_DELAY_MS = 120;
const PERSISTENCE_VERSION = 1;
const PERSISTENCE_ACTIVE_SLOT_KEY = "sprite-editor:persistence:active-slot";
const PERSISTENCE_SLOT_KEYS = [
  "sprite-editor:persistence:slot-0",
  "sprite-editor:persistence:slot-1",
] as const;

type Interaction =
  | {
      type: "drag";
      pointerId: number;
      startX: number;
      startY: number;
      nodeIds: string[];
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      type: "resize";
      pointerId: number;
      nodeId: string;
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      origin: { x: number; y: number; width: number; height: number };
    }
  | {
      type: "rotate";
      pointerId: number;
      nodeId: string;
      centerX: number;
      centerY: number;
      startAngle: number;
      startRotation: number;
    }
  | {
      type: "marquee";
      pointerId: number;
      originX: number;
      originY: number;
      currentX: number;
      currentY: number;
      additive: boolean;
      baseSelection: string[];
    };

type MarqueeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FolderSpriteSource = {
  id: string;
  fileName: string;
  relativePath: string;
  sourcePath: string;
  url: string;
  mimeType: string;
};

type PersistedEditorUiState = {
  selectedSceneId: string;
  selectedNodeIds: string[];
  viewportScale: number;
  nodeStyleId: string | null;
  collisionEditorId: string | null;
  gridVisible: boolean;
  gridSize: number;
  workspaceScroll: {
    left: number;
    top: number;
  };
};

type PersistedEditorState = {
  version: typeof PERSISTENCE_VERSION;
  savedAt: number;
  project: ReturnType<typeof createEmptyProject>;
  ui: PersistedEditorUiState;
};

function nextId(prefix: string, ids: string[]) {
  const used = new Set(ids);
  let index = 1;
  while (used.has(`${prefix}_${index}`)) {
    index += 1;
  }
  return `${prefix}_${index}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapToGrid(value: number, grid: number) {
  return Math.round(value / grid) * grid;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUrl(url: string, mimeType?: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset at ${url} (status ${response.status}).`);
  }
  const blob = await response.blob();
  const typed = mimeType && blob.type !== mimeType ? new Blob([blob], { type: mimeType }) : blob;
  return blobToDataUrl(typed);
}

function readImageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Failed to read image dimensions."));
    image.src = url;
  });
}

function swapAtIndex<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function getAssetUrl(asset: SpriteAsset | undefined): string {
  if (!asset) return "";
  return asset.url ?? asset.dataUrl ?? asset.sourcePath ?? "";
}

function createNodeBackground(asset: SpriteAsset | undefined, style: BackgroundStyle) {
  const image = style.backgroundImage ?? (asset ? `url("${getAssetUrl(asset)}")` : undefined);
  return {
    "background-color": style.backgroundColor ?? "transparent",
    "background-image": image,
    "background-size": style.backgroundSize ?? "100% 100%",
    "background-repeat": style.backgroundRepeat ?? "no-repeat",
    "background-position": style.backgroundPosition ?? "center",
  };
}

function createSceneBackground(style: BackgroundStyle) {
  return {
    "background-color": style.backgroundColor ?? "#151515",
    "background-image": style.backgroundImage,
    "background-size": style.backgroundSize,
    "background-repeat": style.backgroundRepeat,
    "background-position": style.backgroundPosition,
  };
}

function parseStoredJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getNextPersistenceSlot() {
  if (typeof window === "undefined") return 0;
  const activeSlot = window.localStorage.getItem(PERSISTENCE_ACTIVE_SLOT_KEY);
  return activeSlot === "0" ? 1 : 0;
}

function sanitizePersistedUiState(
  value: unknown,
  project: ReturnType<typeof createEmptyProject>,
): PersistedEditorUiState {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const selectedSceneId =
    typeof record.selectedSceneId === "string" && sceneIds.has(record.selectedSceneId)
      ? record.selectedSceneId
      : project.scenes[0].id;
  const selectedScene = project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0];
  const nodeIds = new Set(selectedScene.nodes.map((node) => node.id));
  const selectedNodeIds = Array.isArray(record.selectedNodeIds)
    ? record.selectedNodeIds.filter((entry): entry is string => typeof entry === "string" && nodeIds.has(entry))
    : [];
  const nodeStyleId =
    typeof record.nodeStyleId === "string" && nodeIds.has(record.nodeStyleId) ? record.nodeStyleId : null;
  const collisionEditorId =
    typeof record.collisionEditorId === "string" && nodeIds.has(record.collisionEditorId)
      ? record.collisionEditorId
      : null;
  const workspaceScroll =
    record.workspaceScroll && typeof record.workspaceScroll === "object"
      ? (record.workspaceScroll as Record<string, unknown>)
      : {};

  return {
    selectedSceneId,
    selectedNodeIds,
    viewportScale: clamp(
      typeof record.viewportScale === "number" && Number.isFinite(record.viewportScale)
        ? record.viewportScale
        : 0.75,
      0.1,
      4,
    ),
    nodeStyleId,
    collisionEditorId,
    gridVisible: typeof record.gridVisible === "boolean" ? record.gridVisible : true,
    gridSize: clamp(
      typeof record.gridSize === "number" && Number.isFinite(record.gridSize) ? record.gridSize : 32,
      4,
      128,
    ),
    workspaceScroll: {
      left:
        typeof workspaceScroll.left === "number" && Number.isFinite(workspaceScroll.left)
          ? Math.max(0, workspaceScroll.left)
          : 0,
      top:
        typeof workspaceScroll.top === "number" && Number.isFinite(workspaceScroll.top)
          ? Math.max(0, workspaceScroll.top)
          : 0,
    },
  };
}

function readPersistedEditorState(): PersistedEditorState | null {
  if (typeof window === "undefined") return null;

  const activeSlot = window.localStorage.getItem(PERSISTENCE_ACTIVE_SLOT_KEY);
  const slotOrder =
    activeSlot === "0" || activeSlot === "1"
      ? [Number(activeSlot), Number(activeSlot) === 0 ? 1 : 0]
      : [0, 1];

  for (const slot of slotOrder) {
    const parsed = parseStoredJson(window.localStorage.getItem(PERSISTENCE_SLOT_KEYS[slot]));
    if (!parsed || typeof parsed !== "object") continue;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== PERSISTENCE_VERSION) continue;

    try {
      const project = parseSpriteProject(candidate.project);
      return {
        version: PERSISTENCE_VERSION,
        savedAt:
          typeof candidate.savedAt === "number" && Number.isFinite(candidate.savedAt)
            ? candidate.savedAt
            : Date.now(),
        project,
        ui: sanitizePersistedUiState(candidate.ui, project),
      };
    } catch {
      continue;
    }
  }

  return null;
}

export default function App() {
  const restoredState = readPersistedEditorState();
  const initialProject = restoredState?.project ?? createEmptyProject();
  const initialUiState: PersistedEditorUiState = restoredState?.ui ?? {
    selectedSceneId: initialProject.scenes[0].id,
    selectedNodeIds: [],
    viewportScale: 0.75,
    nodeStyleId: null,
    collisionEditorId: null,
    gridVisible: true,
    gridSize: 32,
    workspaceScroll: {
      left: 0,
      top: 0,
    },
  };

  const [project, setProject] = createStore(initialProject);
  const [selectedSceneId, setSelectedSceneId] = createSignal(initialUiState.selectedSceneId);
  const [selectedNodeIds, setSelectedNodeIds] = createSignal<string[]>(initialUiState.selectedNodeIds);
  const [interaction, setInteraction] = createSignal<Interaction | null>(null);
  const [workspaceRef, setWorkspaceRef] = createSignal<HTMLDivElement>();
  const [nodeStyleId, setNodeStyleId] = createSignal<string | null>(initialUiState.nodeStyleId);
  const [collisionEditorId, setCollisionEditorId] = createSignal<string | null>(
    initialUiState.collisionEditorId,
  );
  const [folderSprites, setFolderSprites] = createSignal<FolderSpriteSource[]>([]);
  const [gridVisible, setGridVisible] = createSignal(initialUiState.gridVisible);
  const [gridSize, setGridSize] = createSignal(initialUiState.gridSize);
  const [viewportScale, setViewportScale] = createSignal(initialUiState.viewportScale);
  const [workspaceScroll, setWorkspaceScroll] = createSignal(initialUiState.workspaceScroll);
  const [persistenceError, setPersistenceError] = createSignal<string | null>(null);
  const [shiftHeld, setShiftHeld] = createSignal(false);
  const [dragGhost, setDragGhost] = createSignal<{
    x: number;
    y: number;
    width: number;
    height: number;
    imageUrl: string;
  } | null>(null);
  const folderSpriteSizeCache = new Map<string, { width: number; height: number }>();
  let persistenceTimer: number | undefined;
  let pendingPersistencePayload: string | null = null;
  let nextPersistenceSlot = getNextPersistenceSlot();
  let restoredWorkspaceScroll = false;

  const selectedScene = createMemo(
    () => project.scenes.find((scene) => scene.id === selectedSceneId()) ?? project.scenes[0],
  );
  const selectedNodeSet = createMemo(() => new Set(selectedNodeIds()));
  const marqueeRect = createMemo<MarqueeRect | null>(() => {
    const current = interaction();
    if (!current || current.type !== "marquee") return null;
    const x = Math.min(current.originX, current.currentX);
    const y = Math.min(current.originY, current.currentY);
    const width = Math.abs(current.currentX - current.originX);
    const height = Math.abs(current.currentY - current.originY);
    return { x, y, width, height };
  });
  const singleSelectedNode = createMemo(() => {
    const ids = selectedNodeIds();
    if (ids.length !== 1) return null;
    return selectedScene().nodes.find((node) => node.id === ids[0]) ?? null;
  });
  const selectedUnlockedNodeIds = createMemo(() => {
    const ids = new Set(selectedNodeIds());
    return selectedScene()
      .nodes.filter((node) => ids.has(node.id) && !node.locked)
      .map((node) => node.id);
  });

  const currentSceneIndex = createMemo(() =>
    project.scenes.findIndex((scene) => scene.id === selectedScene().id),
  );

  const toolbarPosition = createMemo(() => {
    const node = singleSelectedNode();
    if (!node) return null;
    return {
      left: WORKSPACE_PADDING + node.x + node.width / 2,
      top: WORKSPACE_PADDING + node.y + 12,
    };
  });

  const writePersistedState = (payload: string) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PERSISTENCE_SLOT_KEYS[nextPersistenceSlot], payload);
      window.localStorage.setItem(PERSISTENCE_ACTIVE_SLOT_KEY, String(nextPersistenceSlot));
      nextPersistenceSlot = nextPersistenceSlot === 0 ? 1 : 0;
      setPersistenceError(null);
    } catch (error) {
      setPersistenceError(
        "Autosave to localStorage failed. The current editor session may not survive a refresh until storage is freed.",
      );
      console.error("Failed to persist sprite editor state to localStorage.", error);
    }
  };

  const flushPersistedState = () => {
    if (typeof window === "undefined") return;
    if (persistenceTimer !== undefined) {
      window.clearTimeout(persistenceTimer);
      persistenceTimer = undefined;
    }
    if (!pendingPersistencePayload) return;
    writePersistedState(pendingPersistencePayload);
    pendingPersistencePayload = null;
  };

  const schedulePersistedState = (payload: string) => {
    if (typeof window === "undefined") return;
    pendingPersistencePayload = payload;
    if (persistenceTimer !== undefined) {
      window.clearTimeout(persistenceTimer);
    }
    persistenceTimer = window.setTimeout(() => {
      flushPersistedState();
    }, AUTOSAVE_DELAY_MS);
  };

  const fetchFolderSprites = async () => {
    const response = await fetch("/__sprite-editor__/sprites.json", { cache: "no-store" });
    if (!response.ok) {
      setFolderSprites([]);
      return;
    }
    const sprites = (await response.json()) as FolderSpriteSource[];
    setFolderSprites(sprites);
    // Preload dimensions for all folder sprites
    for (const sprite of sprites) {
      if (!folderSpriteSizeCache.has(sprite.url)) {
        void readImageSize(sprite.url).then((size) => {
          folderSpriteSizeCache.set(sprite.url, size);
        }).catch(() => {});
      }
    }
  };

  onMount(() => {
    void fetchFolderSprites();
    const timer = window.setInterval(() => {
      void fetchFolderSprites();
    }, 2500);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftHeld(false);
    };
    const onBlur = () => setShiftHeld(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersistedState();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", flushPersistedState);
    window.addEventListener("pagehide", flushPersistedState);
    document.addEventListener("visibilitychange", onVisibilityChange);
    onCleanup(() => {
      flushPersistedState();
      window.clearInterval(timer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", flushPersistedState);
      window.removeEventListener("pagehide", flushPersistedState);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    });
  });

  createEffect(() => {
    const workspace = workspaceRef();
    if (!workspace || restoredWorkspaceScroll) return;

    const { left, top } = workspaceScroll();
    const frame = window.requestAnimationFrame(() => {
      workspace.scrollTo({ left, top });
      restoredWorkspaceScroll = true;
    });

    onCleanup(() => window.cancelAnimationFrame(frame));
  });

  createEffect(() => {
    const serializedProject = serializeSpriteProject(project);
    const payload = JSON.stringify({
      version: PERSISTENCE_VERSION,
      savedAt: Date.now(),
      project: JSON.parse(serializedProject),
      ui: {
        selectedSceneId: selectedSceneId(),
        selectedNodeIds: selectedNodeIds(),
        viewportScale: viewportScale(),
        nodeStyleId: nodeStyleId(),
        collisionEditorId: collisionEditorId(),
        gridVisible: gridVisible(),
        gridSize: gridSize(),
        workspaceScroll: workspaceScroll(),
      },
    } satisfies PersistedEditorState);

    schedulePersistedState(payload);
  });

  const adjustViewportScale = (delta: number) => {
    setViewportScale((prev) => clamp(Math.round((prev + delta) * 100) / 100, 0.1, 4));
  };

  const beginPointerSession = (
    pointerId: number,
    move: (event: PointerEvent) => void,
    end?: () => void,
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
      setInteraction(null);
      end?.();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const updateScene = (updater: (scene: (typeof project.scenes)[number]) => void) => {
    setProject(
      produce((draft) => {
        const scene = draft.scenes.find((entry) => entry.id === selectedScene().id);
        if (!scene) return;
        updater(scene);
      }),
    );
  };

  const updateNode = (nodeId: string, updater: (node: SpriteNode) => void) => {
    updateScene((scene) => {
      const node = scene.nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      updater(node);
    });
  };

  const handleSelectNode = (nodeId: string, metaKey: boolean) => {
    if (metaKey) {
      setSelectedNodeIds((current) =>
        current.includes(nodeId) ? current.filter((entry) => entry !== nodeId) : [...current, nodeId],
      );
      return;
    }
    setSelectedNodeIds([nodeId]);
  };

  const handleStartDrag = (nodeId: string, event: PointerEvent) => {
    const node = selectedScene().nodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    if (event.metaKey || event.ctrlKey) {
      handleSelectNode(nodeId, true);
      return;
    }
    if (node.locked) {
      setSelectedNodeIds([nodeId]);
      return;
    }

    const activeIds = selectedNodeSet().has(nodeId) ? selectedNodeIds() : [nodeId];
    if (!selectedNodeSet().has(nodeId)) {
      setSelectedNodeIds([nodeId]);
    }
    const origins = Object.fromEntries(
      selectedScene()
        .nodes.filter((entry) => activeIds.includes(entry.id))
        .map((entry) => [entry.id, { x: entry.x, y: entry.y }]),
    );

    setInteraction({
      type: "drag",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeIds: activeIds,
      origins,
    });

    beginPointerSession(event.pointerId, (moveEvent) => {
      const scale = viewportScale();
      const deltaX = (moveEvent.clientX - event.clientX) / scale;
      const deltaY = (moveEvent.clientY - event.clientY) / scale;
      const gridSize = gridSize();
      setProject(
        produce((draft) => {
          const scene = draft.scenes.find((entry) => entry.id === selectedScene().id);
          if (!scene) return;
          for (const targetId of activeIds) {
            const target = scene.nodes.find((entry) => entry.id === targetId);
            const origin = origins[targetId];
            if (!target || !origin || target.locked) continue;
            target.x = snapToGrid(origin.x + deltaX, gridSize);
            target.y = snapToGrid(origin.y + deltaY, gridSize);
          }
        }),
      );
    });
  };

  const handleStartRotate = (nodeId: string, event: PointerEvent) => {
    event.stopPropagation();
    const node = selectedScene().nodes.find((entry) => entry.id === nodeId);
    const workspace = workspaceRef();
    if (!node || node.locked || !workspace) return;
    setSelectedNodeIds([nodeId]);
    const rect = workspace.getBoundingClientRect();
    const vScale = viewportScale();
    const centerSceneX = node.x + node.width / 2;
    const centerSceneY = node.y + node.height / 2;
    const centerX =
      rect.left + (WORKSPACE_PADDING + centerSceneX) * vScale - workspace.scrollLeft;
    const centerY =
      rect.top + (WORKSPACE_PADDING + centerSceneY) * vScale - workspace.scrollTop;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    setInteraction({
      type: "rotate",
      pointerId: event.pointerId,
      nodeId,
      centerX,
      centerY,
      startAngle,
      startRotation: node.rotation,
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

  const handleStartResize = (nodeId: string, handle: "nw" | "ne" | "sw" | "se", event: PointerEvent) => {
    event.stopPropagation();
    const node = selectedScene().nodes.find((entry) => entry.id === nodeId);
    if (!node || node.locked) return;
    setSelectedNodeIds([nodeId]);
    const origin = { x: node.x, y: node.y, width: node.width, height: node.height };
    setInteraction({
      type: "resize",
      pointerId: event.pointerId,
      nodeId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      origin,
    });

    beginPointerSession(event.pointerId, (moveEvent) => {
      const scale = viewportScale();
      const deltaX = (moveEvent.clientX - event.clientX) / scale;
      const deltaY = (moveEvent.clientY - event.clientY) / scale;
      const gridSize = gridSize();
      const keepAspect = !moveEvent.shiftKey;
      const aspectRatio = origin.width / origin.height;

      updateNode(nodeId, (draft) => {
        let rawW = origin.width;
        let rawH = origin.height;
        if (handle.includes("e")) rawW = origin.width + deltaX;
        if (handle.includes("w")) rawW = origin.width - deltaX;
        if (handle.includes("s")) rawH = origin.height + deltaY;
        if (handle.includes("n")) rawH = origin.height - deltaY;

        let nextWidth: number;
        let nextHeight: number;

        if (keepAspect && aspectRatio > 0) {
          const scaleFromW = rawW / origin.width;
          const scaleFromH = rawH / origin.height;
          const scaleFactor =
            Math.abs(scaleFromW - 1) >= Math.abs(scaleFromH - 1) ? scaleFromW : scaleFromH;
          let snappedW = Math.max(MIN_NODE_SIZE, snapToGrid(origin.width * scaleFactor, gridSize));
          const snapScale = snappedW / origin.width;
          let snappedH = Math.max(MIN_NODE_SIZE, Math.round(origin.height * snapScale));
          // if minimum clamp kicked in, re-derive the other dim from aspect
          if (snappedH === MIN_NODE_SIZE && snappedW !== MIN_NODE_SIZE) {
            snappedW = Math.max(MIN_NODE_SIZE, Math.round(snappedH * aspectRatio));
          }
          nextWidth = snappedW;
          nextHeight = snappedH;
        } else {
          nextWidth = Math.max(MIN_NODE_SIZE, rawW);
          nextHeight = Math.max(MIN_NODE_SIZE, rawH);
        }

        let nextX = origin.x;
        let nextY = origin.y;
        if (handle.includes("w")) nextX = origin.x + (origin.width - nextWidth);
        if (handle.includes("n")) nextY = origin.y + (origin.height - nextHeight);

        draft.x = Math.round(nextX);
        draft.y = Math.round(nextY);
        draft.width = Math.round(nextWidth);
        draft.height = Math.round(nextHeight);
      });
    });
  };

  const handleDropAsset = (event: DragEvent) => {
    event.preventDefault();
    const assetId = event.dataTransfer?.getData("application/x-sprite-asset");
    const folderAssetPayload = event.dataTransfer?.getData("application/x-sprite-folder-asset");
    const workspace = workspaceRef();
    const scene = selectedScene();
    if (!workspace) return;

    const placeAssetNode = (asset: SpriteAsset) => {
      const rect = workspace.getBoundingClientRect();
      const gridSize = gridSize();
      const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
      const scale = Math.min(1, capHeight / asset.height);
      const width = Math.round(asset.width * scale);
      const height = Math.round(asset.height * scale);
      const vScale = viewportScale();
      const pointerSceneX = (event.clientX - rect.left + workspace.scrollLeft) / vScale - WORKSPACE_PADDING;
      const pointerSceneY = (event.clientY - rect.top + workspace.scrollTop) / vScale - WORKSPACE_PADDING;
      const x = snapToGrid(pointerSceneX - width / 2, gridSize);
      const y = snapToGrid(pointerSceneY - height / 2, gridSize);
      const nodeId = nextId(
        "node",
        selectedScene().nodes.map((node) => node.id),
      );

      updateScene((draft) => {
        draft.nodes.push({
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
      });
      setSelectedNodeIds([nodeId]);
    };

    if (assetId) {
      const asset = project.assets[assetId];
      if (!asset) return;
      placeAssetNode(asset);
      return;
    }

    if (!folderAssetPayload) return;
    void (async () => {
      const source = JSON.parse(folderAssetPayload) as FolderSpriteSource;
      const existing = Object.values(project.assets).find(
        (asset) => asset.sourcePath && asset.sourcePath === source.sourcePath,
      );
      if (existing) {
        placeAssetNode(existing);
        return;
      }

      const size = await readImageSize(source.url);
      const nextAsset: SpriteAsset = {
        id: nextId("asset", Object.keys(project.assets)),
        kind: "image",
        fileName: source.fileName,
        width: size.width,
        height: size.height,
        mimeType: source.mimeType,
        sourcePath: source.sourcePath,
        url: source.url,
      };
      setProject("assets", nextAsset.id, nextAsset);
      placeAssetNode(nextAsset);
    })();
  };

  const handleImportAssets = async (files: FileList | null) => {
    if (!files?.length) return;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    for (const file of images) {
      const dataUrl = await readFileAsDataUrl(file);
      const size = await readImageSize(dataUrl);
      const assetId = nextId("asset", Object.keys(project.assets));
      setProject(
        "assets",
        assetId,
        {
          id: assetId,
          kind: "image",
          fileName: file.name,
          width: size.width,
          height: size.height,
          mimeType: file.type,
          dataUrl,
        },
      );
    }
  };

  const handleExport = async () => {
    const snapshot = unwrap(project);
    const embeddedAssets: Record<string, SpriteAsset> = {};
    for (const [assetId, asset] of Object.entries(snapshot.assets)) {
      if (asset.dataUrl) {
        // Already embedded — drop transient dev-server-only fields.
        embeddedAssets[assetId] = {
          id: asset.id,
          kind: asset.kind,
          fileName: asset.fileName,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          dataUrl: asset.dataUrl,
        };
        continue;
      }
      const fetchUrl = asset.url ?? asset.sourcePath;
      if (!fetchUrl) {
        throw new Error(`Asset ${assetId} has no url, sourcePath, or dataUrl to export.`);
      }
      const dataUrl = await fetchAsDataUrl(fetchUrl, asset.mimeType);
      embeddedAssets[assetId] = {
        id: asset.id,
        kind: asset.kind,
        fileName: asset.fileName,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType,
        dataUrl,
      };
    }
    const json = serializeSpriteProject({ ...snapshot, assets: embeddedAssets });
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
    setProject(nextProject);
    setSelectedSceneId(nextProject.scenes[0].id);
    setSelectedNodeIds([]);
  };

  const handleDeleteSelected = () => {
    const deletableIds = new Set(selectedUnlockedNodeIds());
    const lockedIds = new Set(
      selectedScene()
        .nodes.filter((node) => selectedNodeSet().has(node.id) && node.locked)
        .map((node) => node.id),
    );
    if (!deletableIds.size) return;
    updateScene((scene) => {
      scene.nodes = scene.nodes.filter((node) => !deletableIds.has(node.id));
    });
    setSelectedNodeIds([...lockedIds]);
    setNodeStyleId(null);
    setCollisionEditorId(null);
  };

  const sceneStyleInput = (
    key: keyof BackgroundStyle,
    label: string,
    type: "text" | "color" = "text",
  ) => (
    <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
      <span>{label}</span>
      <input
        class={
          type === "color"
            ? "h-8 w-full cursor-pointer rounded-lg border border-white/8 bg-white/5 p-0.5"
            : "w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
        }
        type={type}
        value={selectedScene().backgroundStyle[key] ?? (type === "color" ? "#151515" : "")}
        onInput={(event) => {
          const value = event.currentTarget.value.trim();
          updateScene((scene) => {
            if (value) {
              scene.backgroundStyle[key] = value;
            } else {
              delete scene.backgroundStyle[key];
            }
          });
        }}
      />
    </label>
  );

  const nodeStyleInput = (
    nodeId: string,
    key: keyof BackgroundStyle,
    label: string,
    type: "text" | "color" = "text",
  ) => {
    const node = () => selectedScene().nodes.find((entry) => entry.id === nodeId);
    return (
      <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
        <span>{label}</span>
        <input
          class={
            type === "color"
              ? "h-8 w-full cursor-pointer rounded-lg border border-white/8 bg-white/5 p-0.5"
              : "w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
          }
          type={type}
          value={node()?.style[key] ?? (type === "color" ? "#000000" : "")}
          onInput={(event) => {
            const value = event.currentTarget.value.trim();
            updateNode(nodeId, (draft) => {
              if (value) {
                draft.style[key] = value;
              } else {
                delete draft.style[key];
              }
            });
          }}
        />
      </label>
    );
  };

  return (
    <div class="flex min-h-screen flex-col bg-[#0a0a0b] text-gray-100 [color-scheme:dark] lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Show when={persistenceError()}>
        {(message) => (
          <div class="col-span-full border-b border-red-400/25 bg-red-500/12 px-4 py-2 text-xs text-red-100/92">
            {message()}
          </div>
        )}
      </Show>
      <aside class="flex h-screen max-h-screen flex-col gap-3 overflow-hidden border-b border-white/8 bg-[rgba(7,10,14,0.78)] p-4 backdrop-blur-xl lg:border-r lg:border-b-0 lg:sticky lg:top-0">
        <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 shrink-0">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-[10px] uppercase tracking-[0.22em] text-white/35">Sprite editor</div>
              <h1 class="text-[15px] font-semibold">Scene authoring</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              Export AST
            </Button>
          </div>

          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <label class="relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/8 bg-white/6 px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-white/70 transition hover:border-white/14 hover:bg-white/10 hover:text-white">
              <span>Import AST</span>
              <input
                class="hidden"
                type="file"
                accept=".json,.sprite.json"
                onChange={(event) => void handleImportProject(event.currentTarget.files?.[0])}
              />
            </label>
          </div>
        </div>

        <Collapsible defaultOpen class="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 shrink-0 group">
          <div class="mb-2.5 flex items-center justify-between gap-2">
            <CollapsibleTrigger class="flex min-w-0 flex-1 items-center gap-2 text-left">
              <ChevronDown class="h-3.5 w-3.5 text-white/40 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <div>
                <div class="text-[10px] uppercase tracking-[0.22em] text-white/35">Scenes</div>
                <h2 class="text-[15px] font-semibold">Sequence</h2>
              </div>
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="icon-sm"
              title="Add scene"
              onClick={() => {
                const id = nextId(
                  "scene",
                  project.scenes.map((scene) => scene.id),
                );
                setProject(
                  "scenes",
                  project.scenes.length,
                  createDefaultScene(id, `Scene ${project.scenes.length + 1}`),
                );
                setSelectedSceneId(id);
                setSelectedNodeIds([]);
              }}
            >
              <IconPlus />
            </Button>
          </div>

          <CollapsibleContent class="flex flex-col gap-1">
          <div class="flex flex-col gap-1">
            <For each={project.scenes}>
              {(scene, index) => (
                <div
                  class="flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-transparent px-2.5 py-2 transition hover:bg-white/4"
                  classList={{
                    "border-blue-400/35 bg-blue-400/8": scene.id === selectedSceneId(),
                  }}
                >
                  <button
                    class="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[13px] text-white"
                    onClick={() => {
                      setSelectedSceneId(scene.id);
                      setSelectedNodeIds([]);
                    }}
                  >
                    <span class="block truncate">{scene.name}</span>
                  </button>
                  <span class="inline-flex gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      title="Move up"
                      disabled={index() === 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setProject("scenes", swapAtIndex(project.scenes, index(), index() - 1));
                      }}
                    >
                      <IconArrowUp />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      title="Move down"
                      disabled={index() === project.scenes.length - 1}
                      onClick={(event) => {
                        event.stopPropagation();
                        setProject("scenes", swapAtIndex(project.scenes, index(), index() + 1));
                      }}
                    >
                      <IconArrowDown />
                    </Button>
                  </span>
                </div>
              )}
            </For>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              <span>Name</span>
              <input
                class="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
                value={selectedScene().name}
                onInput={(event) => updateScene((scene) => (scene.name = event.currentTarget.value))}
              />
            </label>
            <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              <span>Width</span>
              <input
                class="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
                type="number"
                min="64"
                value={selectedScene().size.width}
                onInput={(event) =>
                  updateScene((scene) => (scene.size.width = Math.max(64, Number(event.currentTarget.value) || 1920)))
                }
              />
            </label>
            <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              <span>Height</span>
              <input
                class="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
                type="number"
                min="64"
                value={selectedScene().size.height}
                onInput={(event) =>
                  updateScene((scene) =>
                    (scene.size.height = Math.max(64, Number(event.currentTarget.value) || 1080)),
                  )
                }
              />
            </label>
            <label class="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-[7px] text-[10px] uppercase tracking-[0.12em] text-white/40">
              <span>Show grid</span>
              <input
                class="m-0 accent-[#5f98ff]"
                type="checkbox"
                checked={gridVisible()}
                onChange={(event) => setGridVisible(event.currentTarget.checked)}
              />
            </label>
            <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
              <span>Grid size</span>
              <input
                class="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
                type="number"
                min="4"
                max="128"
                value={gridSize()}
                onInput={(event) => setGridSize(clamp(Number(event.currentTarget.value) || 32, 4, 128))}
              />
            </label>
          </div>

          <div class="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">Scene background</div>
          <div class="grid grid-cols-2 gap-1.5">
            {sceneStyleInput("backgroundColor", "Color", "color")}
            {sceneStyleInput("backgroundImage", "Image")}
            {sceneStyleInput("backgroundSize", "Size")}
            {sceneStyleInput("backgroundRepeat", "Repeat")}
            {sceneStyleInput("backgroundPosition", "Position")}
          </div>

          <Show when={project.scenes.length > 1}>
            <Button
              variant="destructive"
              size="sm"
              title="Delete scene"
              onClick={() => {
                const current = selectedScene();
                setProject(
                  "scenes",
                  project.scenes.filter((scene) => scene.id !== current.id),
                );
                const nextScene = project.scenes.find((scene) => scene.id !== current.id);
                if (nextScene) setSelectedSceneId(nextScene.id);
                setSelectedNodeIds([]);
              }}
            >
              <Trash2 />
            </Button>
          </Show>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 group">
          <div class="mb-2.5 flex items-center justify-between gap-2 shrink-0">
            <CollapsibleTrigger class="flex min-w-0 flex-1 items-center gap-2 text-left">
              <ChevronDown class="h-3.5 w-3.5 text-white/40 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
              <div>
                <div class="text-[10px] uppercase tracking-[0.22em] text-white/35">Assets</div>
                <h2 class="text-[15px] font-semibold">Drag into scene</h2>
              </div>
            </CollapsibleTrigger>
            <Button
              variant="outline"
              size="icon-sm"
              title="Refresh folder"
              onClick={() => void fetchFolderSprites()}
            >
              <IconRefresh />
            </Button>
          </div>
          <CollapsibleContent class="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div class="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">Folder sprites</div>
          <div class="flex flex-col gap-1">
            <For each={folderSprites()}>
              {(asset) => (
                <div
                  class="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-white/6 bg-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/4 select-none"
                  draggable={true}
                  onDragStart={(event) => {
                    event.dataTransfer?.setData("application/x-sprite-folder-asset", JSON.stringify(asset));
                    event.dataTransfer!.effectAllowed = "copy";
                    // Lookup existing asset or cached dimensions
                    const existing = Object.values(project.assets).find(
                      (a) => a.sourcePath && a.sourcePath === asset.sourcePath,
                    );
                    const cached = folderSpriteSizeCache.get(asset.url);
                    const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
                    if (existing) {
                      const scale = Math.min(1, capHeight / existing.height);
                      setDragGhost({
                        x: 0, y: 0,
                        width: Math.round(existing.width * scale),
                        height: Math.round(existing.height * scale),
                        imageUrl: asset.url,
                      });
                    } else if (cached) {
                      const scale = Math.min(1, capHeight / cached.height);
                      setDragGhost({
                        x: 0, y: 0,
                        width: Math.round(cached.width * scale),
                        height: Math.round(cached.height * scale),
                        imageUrl: asset.url,
                      });
                    } else {
                      // Start with no ghost, load dimensions async and update
                      setDragGhost(null);
                      void readImageSize(asset.url).then((size) => {
                        folderSpriteSizeCache.set(asset.url, size);
                        const scale = Math.min(1, capHeight / size.height);
                        setDragGhost((prev) => prev === null ? null : {
                          ...prev,
                          width: Math.round(size.width * scale),
                          height: Math.round(size.height * scale),
                        });
                      });
                      // Set a temporary ghost so position tracking works
                      setDragGhost({
                        x: 0, y: 0,
                        width: 64, height: 64,
                        imageUrl: asset.url,
                      });
                    }
                  }}
                  onDragEnd={() => setDragGhost(null)}
                >
                  <div class="pointer-events-none grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/6 bg-white/4">
                    <img
                      alt={asset.fileName}
                      class="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                      draggable={false}
                      src={asset.url}
                    />
                  </div>
                  <div class="pointer-events-none flex min-w-0 flex-col gap-0.5">
                    <strong class="truncate text-xs font-medium">{asset.fileName}</strong>
                    <span class="truncate text-[10px] text-white/35 [font-variant-numeric:tabular-nums]">
                      {asset.relativePath}
                    </span>
                  </div>
                </div>
              )}
            </For>
            <Show when={!folderSprites().length}>
              <div class="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/35">
                Put image files into <code>sprites/</code> at the repo root.
              </div>
            </Show>
          </div>

          <div class="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">Imported into project</div>
          <div class="flex flex-col gap-1">
            <For each={Object.values(project.assets)}>
              {(asset) => (
                <div
                  class="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-white/6 bg-transparent px-2 py-2 text-left transition hover:border-white/10 hover:bg-white/4 select-none"
                  draggable={true}
                  onDragStart={(event) => {
                    event.dataTransfer?.setData("application/x-sprite-asset", asset.id);
                    event.dataTransfer!.effectAllowed = "copy";
                    const capHeight = Math.max(80, Math.floor(window.innerHeight * 0.2));
                    const scale = Math.min(1, capHeight / asset.height);
                    setDragGhost({
                      x: 0,
                      y: 0,
                      width: Math.round(asset.width * scale),
                      height: Math.round(asset.height * scale),
                      imageUrl: getAssetUrl(asset),
                    });
                  }}
                  onDragEnd={() => setDragGhost(null)}
                >
                  <div class="pointer-events-none grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/6 bg-white/4">
                    <Show
                      when={getAssetUrl(asset)}
                      fallback={<div class="p-1.5 text-center text-[10px] text-white/40">{asset.fileName}</div>}
                    >
                      <img
                        alt={asset.fileName}
                        class="max-h-full max-w-full object-contain [image-rendering:pixelated]"
                        draggable={false}
                        src={getAssetUrl(asset)}
                      />
                    </Show>
                  </div>
                  <div class="pointer-events-none flex min-w-0 flex-col gap-0.5">
                    <strong class="truncate text-xs font-medium">{asset.fileName}</strong>
                    <span class="text-[10px] text-white/35 [font-variant-numeric:tabular-nums]">
                      {asset.width} × {asset.height}
                    </span>
                  </div>
                </div>
              )}
            </For>
            <Show when={!Object.keys(project.assets).length}>
              <div class="rounded-lg border border-dashed border-white/10 p-3 text-xs text-white/35">
                Dropped folder sprites show up here.
              </div>
            </Show>
          </div>
          </CollapsibleContent>
        </Collapsible>
      </aside>

      <main class="flex min-w-0 flex-col">
        <div class="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3">
          <div class="flex flex-col gap-0.5">
            <div class="text-[10px] uppercase tracking-[0.22em] text-white/35">Current scene</div>
            <strong class="text-sm">{selectedScene().name}</strong>
            <span class="text-[11px] text-white/35">
              {selectedScene().nodes.length} nodes • {selectedNodeIds().length} selected
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <div class="flex items-center gap-0.5 rounded-md border border-white/8 bg-white/6 p-0.5 text-[11px] text-white/70">
              <Button variant="ghost" size="icon-sm" title="Zoom out" onClick={() => adjustViewportScale(-0.1)}>
                <ZoomOut />
              </Button>
              <button
                class="min-w-[52px] rounded px-2 text-center text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white [font-variant-numeric:tabular-nums]"
                title="Reset zoom"
                onClick={() => setViewportScale(0.75)}
              >
                {Math.round(viewportScale() * 100)}%
              </button>
              <Button variant="ghost" size="icon-sm" title="Zoom in" onClick={() => adjustViewportScale(0.1)}>
                <ZoomIn />
              </Button>
            </div>
            <Button
              variant="destructive"
              size="icon-sm"
              title="Delete selection"
              disabled={!selectedUnlockedNodeIds().length}
              onClick={handleDeleteSelected}
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <div class="relative flex min-h-0 flex-1">
        <div
          ref={setWorkspaceRef}
          class="min-h-0 flex-1 overflow-auto"
          onScroll={(event) => {
            setWorkspaceScroll({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
            });
          }}
          onDragOver={(event) => {
            event.preventDefault();
            const workspace = workspaceRef();
            if (!workspace) return;

            const folderPayload = event.dataTransfer?.types.includes("application/x-sprite-folder-asset");
            const assetPayload = event.dataTransfer?.types.includes("application/x-sprite-asset");
            if (!folderPayload && !assetPayload) return;

            const rect = workspace.getBoundingClientRect();
            const gridSize = gridSize();
            const vScale = viewportScale();
            const rawX = (event.clientX - rect.left + workspace.scrollLeft) / vScale - WORKSPACE_PADDING;
            const rawY = (event.clientY - rect.top + workspace.scrollTop) / vScale - WORKSPACE_PADDING;

            const ghost = dragGhost();
            if (ghost) {
              setDragGhost({
                ...ghost,
                x: snapToGrid(rawX - ghost.width / 2, gridSize),
                y: snapToGrid(rawY - ghost.height / 2, gridSize),
              });
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragGhost(null);
            }
          }}
          onDrop={(event) => {
            handleDropAsset(event);
            setDragGhost(null);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const workspace = workspaceRef();
            if (!workspace) return;
            const rect = workspace.getBoundingClientRect();
            const vScale = viewportScale();
            const originX = (event.clientX - rect.left + workspace.scrollLeft) / vScale - WORKSPACE_PADDING;
            const originY = (event.clientY - rect.top + workspace.scrollTop) / vScale - WORKSPACE_PADDING;
            const additive = event.metaKey || event.ctrlKey || event.shiftKey;
            const baseSelection = additive ? selectedNodeIds() : [];
            if (!additive) setSelectedNodeIds([]);
            setInteraction({
              type: "marquee",
              pointerId: event.pointerId,
              originX,
              originY,
              currentX: originX,
              currentY: originY,
              additive,
              baseSelection,
            });
            beginPointerSession(event.pointerId, (moveEvent) => {
              const ws = workspaceRef();
              if (!ws) return;
              const wsRect = ws.getBoundingClientRect();
              const vs = viewportScale();
              const currentX = (moveEvent.clientX - wsRect.left + ws.scrollLeft) / vs - WORKSPACE_PADDING;
              const currentY = (moveEvent.clientY - wsRect.top + ws.scrollTop) / vs - WORKSPACE_PADDING;
              setInteraction((prev) => {
                if (!prev || prev.type !== "marquee") return prev;
                return { ...prev, currentX, currentY };
              });
              const minX = Math.min(originX, currentX);
              const minY = Math.min(originY, currentY);
              const maxX = Math.max(originX, currentX);
              const maxY = Math.max(originY, currentY);
              const hits = selectedScene()
                .nodes.filter(
                  (node) =>
                    node.x < maxX &&
                    node.x + node.width > minX &&
                    node.y < maxY &&
                    node.y + node.height > minY,
                )
                .map((node) => node.id);
              if (additive) {
                const merged = new Set(baseSelection);
                for (const id of hits) merged.add(id);
                setSelectedNodeIds([...merged]);
              } else {
                setSelectedNodeIds(hits);
              }
            });
          }}
        >
          <div
            class="relative min-h-full min-w-full"
            style={{
              width: `${(selectedScene().size.width + WORKSPACE_PADDING * 2) * viewportScale()}px`,
              height: `${(selectedScene().size.height + WORKSPACE_PADDING * 2) * viewportScale()}px`,
            }}
          >
          <div
            class="absolute top-0 left-0 origin-top-left"
            style={{
              width: `${selectedScene().size.width + WORKSPACE_PADDING * 2}px`,
              height: `${selectedScene().size.height + WORKSPACE_PADDING * 2}px`,
              transform: `scale(${viewportScale()})`,
            }}
          >
            <div
              class="absolute overflow-hidden border border-white/8"
              style={{
                left: `${WORKSPACE_PADDING}px`,
                top: `${WORKSPACE_PADDING}px`,
                width: `${selectedScene().size.width}px`,
                height: `${selectedScene().size.height}px`,
                ...createSceneBackground(selectedScene().backgroundStyle),
              }}
            >
              <Show when={gridVisible()}>
                <div
                  class="pointer-events-none absolute inset-0"
                  style={{
                    "background-image":
                      "linear-gradient(to right, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px)",
                    "background-size": `${gridSize()}px ${gridSize()}px`,
                  }}
                />
              </Show>
            </div>

            <Show when={dragGhost()}>
              {(ghost) => (
                <div
                  class="pointer-events-none absolute z-30 border border-dashed border-blue-400/60 opacity-45 [image-rendering:pixelated]"
                  style={{
                    left: `${WORKSPACE_PADDING + ghost().x}px`,
                    top: `${WORKSPACE_PADDING + ghost().y}px`,
                    width: `${ghost().width}px`,
                    height: `${ghost().height}px`,
                    "background-image": `url("${ghost().imageUrl}")`,
                    "background-size": "100% 100%",
                    "background-repeat": "no-repeat",
                    "background-position": "center",
                  }}
                />
              )}
            </Show>

            <Show when={marqueeRect()}>
              {(rect) => (
                <div
                  class="pointer-events-none absolute z-40 border-2 border-sky-300/90 bg-sky-400/15 shadow-[0_0_0_1px_rgba(125,211,252,0.35)]"
                  style={{
                    left: `${WORKSPACE_PADDING + rect().x}px`,
                    top: `${WORKSPACE_PADDING + rect().y}px`,
                    width: `${rect().width}px`,
                    height: `${rect().height}px`,
                  }}
                />
              )}
            </Show>

            <For each={selectedScene().nodes}>
              {(node) => {
                const asset = createMemo(() => project.assets[node.assetId]);
                const isSelected = createMemo(() => selectedNodeSet().has(node.id));
                return (
                  <div
                    class="absolute bg-transparent bg-center bg-no-repeat bg-[length:100%_100%] select-none touch-none [image-rendering:pixelated]"
                    classList={{
                      "outline outline-2 outline-offset-[2px] outline-amber-300 shadow-[0_0_0_6px_rgba(255,205,100,0.28),0_0_18px_4px_rgba(255,205,100,0.35)] z-20":
                        isSelected(),
                      "saturate-[0.9]": node.locked,
                    }}
                    style={{
                      left: `${WORKSPACE_PADDING + node.x}px`,
                      top: `${WORKSPACE_PADDING + node.y}px`,
                      width: `${node.width}px`,
                      height: `${node.height}px`,
                      opacity: String(node.opacity),
                      transform: `rotate(${node.rotation}deg)`,
                      ...createNodeBackground(asset(), node.style),
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      handleStartDrag(node.id, event);
                    }}
                  >
                    <Show when={!getAssetUrl(asset())}>
                      <div class="absolute inset-0 grid place-items-center bg-black/40 p-2 text-center text-[10px] text-white/40">
                        {asset()?.fileName ?? node.assetId}
                      </div>
                    </Show>

                    <Show when={hasAnyCollision(node.collisions)}>
                      <div
                        class="absolute inset-x-0 top-0 h-[3px] bg-emerald-400/18 opacity-25"
                        classList={{ "bg-emerald-400/92 opacity-100": node.collisions.top }}
                      />
                      <div
                        class="absolute inset-y-0 right-0 w-[3px] bg-emerald-400/18 opacity-25"
                        classList={{ "bg-emerald-400/92 opacity-100": node.collisions.right }}
                      />
                      <div
                        class="absolute inset-x-0 bottom-0 h-[3px] bg-emerald-400/18 opacity-25"
                        classList={{ "bg-emerald-400/92 opacity-100": node.collisions.bottom }}
                      />
                      <div
                        class="absolute inset-y-0 left-0 w-[3px] bg-emerald-400/18 opacity-25"
                        classList={{ "bg-emerald-400/92 opacity-100": node.collisions.left }}
                      />
                    </Show>

                    <Show when={node.locked}>
                      <div class="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded bg-amber-300/20 text-[#ffd991] ring-1 ring-amber-300/40">
                        <Lock class="h-3 w-3" />
                      </div>
                    </Show>

                    <Show when={isSelected() && selectedNodeIds().length === 1 && !node.locked}>
                      <div
                        class="absolute left-1/2 z-40 h-4 w-px -translate-x-1/2 bg-[#ffd58a]/70"
                        style={{ top: "-22px" }}
                      />
                      <div
                        class="absolute left-1/2 z-40 grid h-4 w-4 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-[rgba(45,25,15,0.6)] bg-[#ffd58a] text-[#2d190f]"
                        style={{ top: "-34px" }}
                        title="Rotate"
                        onPointerDown={(event) => handleStartRotate(node.id, event)}
                      >
                        <RotateCw class="h-2.5 w-2.5" />
                      </div>
                    </Show>

                    <Show when={isSelected() && selectedNodeIds().length === 1 && !node.locked}>
                      <div
                        class="absolute -top-[5px] -left-[5px] z-40 h-2.5 w-2.5 cursor-nwse-resize rounded-[2px] border border-[rgba(45,25,15,0.6)] bg-[#ffd58a]"
                        onPointerDown={(event) => handleStartResize(node.id, "nw", event)}
                      />
                      <div
                        class="absolute -top-[5px] -right-[5px] z-40 h-2.5 w-2.5 cursor-nesw-resize rounded-[2px] border border-[rgba(45,25,15,0.6)] bg-[#ffd58a]"
                        onPointerDown={(event) => handleStartResize(node.id, "ne", event)}
                      />
                      <div
                        class="absolute -bottom-[5px] -left-[5px] z-40 h-2.5 w-2.5 cursor-nesw-resize rounded-[2px] border border-[rgba(45,25,15,0.6)] bg-[#ffd58a]"
                        onPointerDown={(event) => handleStartResize(node.id, "sw", event)}
                      />
                      <div
                        class="absolute -right-[5px] -bottom-[5px] z-40 h-2.5 w-2.5 cursor-nwse-resize rounded-[2px] border border-[rgba(45,25,15,0.6)] bg-[#ffd58a]"
                        onPointerDown={(event) => handleStartResize(node.id, "se", event)}
                      />
                    </Show>
                  </div>
                );
              }}
            </For>

            <Show when={singleSelectedNode()}>
              {(node) => (
                <div
                  class="absolute z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border border-white/10 bg-[rgba(18,15,13,0.78)] p-[3px] shadow-[0_14px_36px_rgba(0,0,0,0.38)] backdrop-blur-xl"
                  style={{
                    left: `${toolbarPosition()!.left}px`,
                    top: `${toolbarPosition()!.top}px`,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <PopoverRoot
                    open={nodeStyleId() === node().id}
                    onOpenChange={(open) => setNodeStyleId(open ? node().id : null)}
                  >
                    <PopoverTrigger class="rounded-full border border-transparent bg-transparent px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60 transition hover:border-white/10 hover:bg-white/8 hover:text-white/90">
                      Style
                    </PopoverTrigger>
                    <PopoverContent side="top" collisionPadding={12} sticky>
                      <PopoverSection>
                        <strong class="text-xs font-semibold text-white/85">Node style</strong>
                        {nodeStyleInput(node().id, "backgroundColor", "Color", "color")}
                        {nodeStyleInput(node().id, "backgroundImage", "Image")}
                        {nodeStyleInput(node().id, "backgroundSize", "Size")}
                        {nodeStyleInput(node().id, "backgroundRepeat", "Repeat")}
                        {nodeStyleInput(node().id, "backgroundPosition", "Position")}
                        <label class="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
                          <span>Opacity</span>
                          <input
                            class="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            value={node().opacity}
                            onInput={(event) =>
                              updateNode(node().id, (draft) => {
                                draft.opacity = clamp(Number(event.currentTarget.value) || 0, 0, 1);
                              })
                            }
                          />
                        </label>
                      </PopoverSection>
                    </PopoverContent>
                  </PopoverRoot>

                  <PopoverRoot
                    open={collisionEditorId() === node().id}
                    onOpenChange={(open) => setCollisionEditorId(open ? node().id : null)}
                  >
                    <PopoverTrigger
                      class="grid h-7 w-7 place-items-center rounded-full border border-transparent bg-transparent text-white/60 transition hover:border-white/10 hover:bg-white/8 hover:text-white/90 aria-[pressed=true]:border-emerald-300/30 aria-[pressed=true]:bg-emerald-400/10 aria-[pressed=true]:text-emerald-200"
                      aria-pressed={hasAnyCollision(node().collisions)}
                      title="Collision sides"
                    >
                      <Power class="h-3.5 w-3.5" />
                    </PopoverTrigger>
                    <PopoverContent side="top" collisionPadding={12} sticky>
                      <PopoverSection>
                        <div class="flex items-center justify-between">
                          <strong class="text-xs font-semibold text-white/85">Collision sides</strong>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title={hasAnyCollision(node().collisions) ? "Disable all" : "Enable all"}
                            onClick={() =>
                              updateNode(node().id, (draft) => {
                                const next = !hasAnyCollision(draft.collisions);
                                draft.collisions.top = next;
                                draft.collisions.right = next;
                                draft.collisions.bottom = next;
                                draft.collisions.left = next;
                              })
                            }
                          >
                            <Power />
                          </Button>
                        </div>
                        <div class="grid grid-cols-4 gap-1.5">
                          <Button
                            variant={node().collisions.top ? "default" : "outline"}
                            size="icon"
                            title="Top"
                            onClick={() =>
                              updateNode(node().id, (draft) => {
                                draft.collisions.top = !draft.collisions.top;
                              })
                            }
                          >
                            <ArrowUpToLine />
                          </Button>
                          <Button
                            variant={node().collisions.right ? "default" : "outline"}
                            size="icon"
                            title="Right"
                            onClick={() =>
                              updateNode(node().id, (draft) => {
                                draft.collisions.right = !draft.collisions.right;
                              })
                            }
                          >
                            <ArrowRightToLine />
                          </Button>
                          <Button
                            variant={node().collisions.bottom ? "default" : "outline"}
                            size="icon"
                            title="Bottom"
                            onClick={() =>
                              updateNode(node().id, (draft) => {
                                draft.collisions.bottom = !draft.collisions.bottom;
                              })
                            }
                          >
                            <ArrowDownToLine />
                          </Button>
                          <Button
                            variant={node().collisions.left ? "default" : "outline"}
                            size="icon"
                            title="Left"
                            onClick={() =>
                              updateNode(node().id, (draft) => {
                                draft.collisions.left = !draft.collisions.left;
                              })
                            }
                          >
                            <ArrowLeftToLine />
                          </Button>
                        </div>
                      </PopoverSection>
                    </PopoverContent>
                  </PopoverRoot>

                  <Button
                    variant={node().locked ? "default" : "ghost"}
                    size="icon-sm"
                    title={node().locked ? "Unlock" : "Lock"}
                    onClick={() => updateNode(node().id, (draft) => (draft.locked = !draft.locked))}
                  >
                    {node().locked ? <Lock /> : <LockOpen />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    title="Delete"
                    disabled={!selectedUnlockedNodeIds().length}
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </Show>
          </div>
          </div>
        </div>

        <Show when={interaction()?.type === "resize"}>
          <div class="pointer-events-none absolute top-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70 shadow-md backdrop-blur">
            {shiftHeld() ? "Free-form resize" : "Hold Shift — free-form resize"}
          </div>
        </Show>

        </div>
      </main>
    </div>
  );
}
