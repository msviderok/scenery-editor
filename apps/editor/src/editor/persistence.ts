import {
  createEmptyProject,
  parseSpriteProject,
  serializeSpriteProject,
} from "@msviderok/sprite-editor-ast";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_VIEWPORT_SCALE,
  PERSISTENCE_VERSION,
  REACT_PERSISTENCE_ACTIVE_SLOT_KEY,
  REACT_PERSISTENCE_SLOT_KEYS,
  SOLID_PERSISTENCE_ACTIVE_SLOT_KEY,
  SOLID_PERSISTENCE_SLOT_KEYS,
} from "./constants";
import { clampGridSize, clampViewportScale } from "./geometry";
import type { EditorState, PersistedEditorState, PersistedEditorUiState } from "./types";

function parseStoredJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function sanitizePersistedUiState(
  value: unknown,
  project = createEmptyProject(),
): PersistedEditorUiState {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const selectedSceneId =
    typeof record.selectedSceneId === "string" && sceneIds.has(record.selectedSceneId)
      ? record.selectedSceneId
      : project.scenes[0].id;
  const selectedScene =
    project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0];
  const nodeIds = new Set(selectedScene.nodes.map((node) => node.id));
  const selectedNodeIds = Array.isArray(record.selectedNodeIds)
    ? record.selectedNodeIds.filter(
        (entry): entry is string => typeof entry === "string" && nodeIds.has(entry),
      )
    : [];
  const nodeStyleId =
    typeof record.nodeStyleId === "string" && nodeIds.has(record.nodeStyleId)
      ? record.nodeStyleId
      : null;
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
    viewportScale: clampViewportScale(
      typeof record.viewportScale === "number" && Number.isFinite(record.viewportScale)
        ? record.viewportScale
        : DEFAULT_VIEWPORT_SCALE,
    ),
    nodeStyleId,
    collisionEditorId,
    gridVisible: typeof record.gridVisible === "boolean" ? record.gridVisible : true,
    gridSize: clampGridSize(
      typeof record.gridSize === "number" && Number.isFinite(record.gridSize)
        ? record.gridSize
        : DEFAULT_GRID_SIZE,
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

function readSlotState(
  storage: Storage,
  activeKey: string,
  slotKeys: readonly [string, string],
): PersistedEditorState | null {
  const activeSlot = storage.getItem(activeKey);
  const slotOrder =
    activeSlot === "0" || activeSlot === "1"
      ? [Number(activeSlot), Number(activeSlot) === 0 ? 1 : 0]
      : [0, 1];

  for (const slot of slotOrder) {
    const parsed = parseStoredJson(storage.getItem(slotKeys[slot]));
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

export function readPersistedEditorState(
  storage: Storage | null = globalThis.localStorage ?? null,
) {
  if (!storage) return null;
  return (
    readSlotState(storage, REACT_PERSISTENCE_ACTIVE_SLOT_KEY, REACT_PERSISTENCE_SLOT_KEYS) ??
    readSlotState(storage, SOLID_PERSISTENCE_ACTIVE_SLOT_KEY, SOLID_PERSISTENCE_SLOT_KEYS)
  );
}

export function getNextPersistenceSlot(storage: Storage | null = globalThis.localStorage ?? null) {
  if (!storage) return 0 as const;
  const activeSlot = storage.getItem(REACT_PERSISTENCE_ACTIVE_SLOT_KEY);
  return (activeSlot === "0" ? 1 : 0) as 0 | 1;
}

export function createPersistedPayload(state: EditorState) {
  return JSON.stringify({
    version: PERSISTENCE_VERSION,
    savedAt: Date.now(),
    project: JSON.parse(serializeSpriteProject(state.project)),
    ui: {
      selectedSceneId: state.selectedSceneId,
      selectedNodeIds: state.selectedNodeIds,
      viewportScale: state.viewportScale,
      nodeStyleId: state.nodeStyleId,
      collisionEditorId: state.collisionEditorId,
      gridVisible: state.gridVisible,
      gridSize: state.gridSize,
      workspaceScroll: state.workspaceScroll,
    },
  } satisfies PersistedEditorState);
}

export function writePersistedPayload(storage: Storage, payload: string, slot: 0 | 1): 0 | 1 {
  storage.setItem(REACT_PERSISTENCE_SLOT_KEYS[slot], payload);
  storage.setItem(REACT_PERSISTENCE_ACTIVE_SLOT_KEY, String(slot));
  return (slot === 0 ? 1 : 0) as 0 | 1;
}
