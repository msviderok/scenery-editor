import { describe, expect, it } from "vite-plus/test";
import { createEmptyProject, serializeSpriteProject } from "@msviderok/sprite-editor-ast-schema";
import {
  REACT_PERSISTENCE_ACTIVE_SLOT_KEY,
  REACT_PERSISTENCE_SLOT_KEYS,
  SOLID_PERSISTENCE_ACTIVE_SLOT_KEY,
  SOLID_PERSISTENCE_SLOT_KEYS,
} from "./constants";
import {
  createPersistedPayload,
  getNextPersistenceSlot,
  readPersistedEditorState,
  sanitizePersistedUiState,
  writePersistedPayload,
} from "./persistence";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe("persistence", () => {
  it("sanitizes editor UI state", () => {
    const project = createEmptyProject();
    project.scenes[0].nodes.push({
      id: "node_1",
      assetId: "asset_1",
      x: 0,
      y: 0,
      width: 32,
      height: 32,
      rotation: 0,
      opacity: 1,
      locked: false,
      flipH: false,
      flipV: false,
      tint: null,
      collisions: { top: false, right: false, bottom: false, left: false },
      style: {},
    });

    expect(
      sanitizePersistedUiState(
        {
          selectedSceneId: "missing",
          selectedNodeIds: ["node_1", "missing"],
          viewportScale: 99,
          nodeStyleId: "node_1",
          collisionEditorId: "missing",
          gridVisible: false,
          gridSize: 999,
          workspaceScroll: { left: -2, top: 14 },
        },
        project,
      ),
    ).toEqual({
      selectedSceneId: project.scenes[0].id,
      selectedNodeIds: ["node_1"],
      viewportScale: 4,
      nodeStyleId: "node_1",
      collisionEditorId: null,
      gridVisible: false,
      gridSize: 32,
      workspaceScroll: {
        left: 0,
        top: 14,
      },
    });
  });

  it("falls back to the Solid namespace when React storage is empty", () => {
    const storage = new MemoryStorage();
    const project = createEmptyProject();
    storage.setItem(
      SOLID_PERSISTENCE_SLOT_KEYS[0],
      JSON.stringify({
        version: 1,
        savedAt: 1,
        project: JSON.parse(serializeSpriteProject(project)),
        ui: {
          selectedSceneId: project.scenes[0].id,
          selectedNodeIds: [],
          viewportScale: 0.75,
          nodeStyleId: null,
          collisionEditorId: null,
          gridVisible: true,
          gridSize: 4,
          workspaceScroll: { left: 12, top: 34 },
        },
      }),
    );
    storage.setItem(SOLID_PERSISTENCE_ACTIVE_SLOT_KEY, "0");

    expect(readPersistedEditorState(storage)?.ui.workspaceScroll).toEqual({ left: 12, top: 34 });
  });

  it("writes into alternating React slots", () => {
    const storage = new MemoryStorage();

    expect(getNextPersistenceSlot(storage)).toBe(0);
    expect(writePersistedPayload(storage, '{"first":true}', 0)).toBe(1);
    expect(storage.getItem(REACT_PERSISTENCE_ACTIVE_SLOT_KEY)).toBe("0");
    expect(storage.getItem(REACT_PERSISTENCE_SLOT_KEYS[0])).toBe('{"first":true}');

    expect(writePersistedPayload(storage, '{"second":true}', 1)).toBe(0);
    expect(storage.getItem(REACT_PERSISTENCE_ACTIVE_SLOT_KEY)).toBe("1");
    expect(storage.getItem(REACT_PERSISTENCE_SLOT_KEYS[1])).toBe('{"second":true}');
  });

  it("preserves linked scene background assets through persisted payloads", () => {
    const project = createEmptyProject();
    project.assets.asset_1 = {
      id: "asset_1",
      kind: "image",
      fileName: "background.png",
      width: 640,
      height: 320,
      dataUrl: "data:image/png;base64,abc",
    };
    project.scenes[0].backgroundAssetId = "asset_1";
    project.scenes[0].backgroundStyle.backgroundImage = 'url("data:image/png;base64,abc")';
    project.scenes[0].backgroundStyle.backgroundSize = "100% 100%";
    project.scenes[0].backgroundStyle.backgroundRepeat = "no-repeat";
    project.scenes[0].backgroundStyle.backgroundPosition = "center";

    const payload = createPersistedPayload({
      project,
      selectedSceneId: project.scenes[0].id,
      selectedNodeIds: [],
      viewportScale: 0.75,
      nodeStyleId: null,
      collisionEditorId: null,
      gridVisible: true,
      gridSize: 4,
      workspaceScroll: { left: 0, top: 0 },
      interaction: null,
      dragGhost: null,
      shiftHeld: false,
      persistenceError: null,
      previewOpen: false,
      backgroundSelected: false,
    });

    const storage = new MemoryStorage();
    writePersistedPayload(storage, payload, 0);

    expect(readPersistedEditorState(storage)?.project.scenes[0].backgroundAssetId).toBe("asset_1");
  });
});
