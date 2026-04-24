import { describe, expect, it } from "vite-plus/test";
import { createDefaultScene, createEmptyProject } from "../../../../shared/ast";
import { editorReducer, createInitialEditorState } from "./useEditorState";

describe("editorReducer", () => {
  it("handles scene add, reorder, delete, and selection", () => {
    let state = createInitialEditorState(null);

    state = editorReducer(state, {
      type: "mutate",
      mutate(draft) {
        const id = "scene_2";
        draft.project.scenes.push(createDefaultScene(id, "Scene 2"));
        draft.selectedSceneId = id;
      },
    });

    expect(state.project.scenes).toHaveLength(2);
    expect(state.selectedSceneId).toBe("scene_2");

    state = editorReducer(state, {
      type: "mutate",
      mutate(draft) {
        const [sceneA, sceneB] = draft.project.scenes;
        draft.project.scenes = [sceneB, sceneA];
      },
    });

    expect(state.project.scenes[0].id).toBe("scene_2");

    state = editorReducer(state, {
      type: "mutate",
      mutate(draft) {
        draft.project.scenes = draft.project.scenes.filter((scene) => scene.id !== "scene_2");
      },
    });

    expect(state.project.scenes).toHaveLength(1);
    expect(state.selectedSceneId).toBe(state.project.scenes[0].id);
  });

  it("handles node state, view state, and AST import resets", () => {
    const project = createEmptyProject();
    project.assets.asset_1 = {
      id: "asset_1",
      kind: "image",
      fileName: "sprite.png",
      width: 32,
      height: 32,
      dataUrl: "data:image/png;base64,abc",
    };
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
      collisions: { top: false, right: false, bottom: false, left: false },
      style: {},
    });

    let state = createInitialEditorState({
      version: 1,
      savedAt: 0,
      project,
      ui: {
        selectedSceneId: project.scenes[0].id,
        selectedNodeIds: ["node_1"],
        viewportScale: 0.75,
        nodeStyleId: null,
        collisionEditorId: null,
        gridVisible: true,
        gridSize: 32,
        workspaceScroll: { left: 0, top: 0 },
      },
    });

    state = editorReducer(state, {
      type: "mutate",
      mutate(draft) {
        draft.selectedNodeIds = [];
        draft.selectedNodeIds.push("node_1");
        draft.project.scenes[0].nodes[0].locked = true;
        draft.project.scenes[0].nodes[0].collisions.left = true;
        draft.project.scenes[0].nodes[0].style.backgroundRepeat = "repeat-x";
        draft.project.scenes[0].nodes[0].opacity = 0.5;
        draft.viewportScale = 1.25;
        draft.gridVisible = false;
        draft.gridSize = 48;
      },
    });

    expect(state.selectedNodeIds).toEqual(["node_1"]);
    expect(state.project.scenes[0].nodes[0].locked).toBe(true);
    expect(state.project.scenes[0].nodes[0].collisions.left).toBe(true);
    expect(state.project.scenes[0].nodes[0].style.backgroundRepeat).toBe("repeat-x");
    expect(state.project.scenes[0].nodes[0].opacity).toBe(0.5);
    expect(state.viewportScale).toBe(1.25);
    expect(state.gridVisible).toBe(false);
    expect(state.gridSize).toBe(48);

    const importedProject = createEmptyProject();
    state = editorReducer(state, {
      type: "mutate",
      mutate(draft) {
        draft.project = importedProject;
        draft.selectedSceneId = importedProject.scenes[0].id;
        draft.selectedNodeIds = [];
        draft.nodeStyleId = null;
        draft.collisionEditorId = null;
        draft.viewportScale = 0.75;
      },
    });

    expect(state.project).toEqual(importedProject);
    expect(state.selectedSceneId).toBe(importedProject.scenes[0].id);
    expect(state.selectedNodeIds).toEqual([]);
    expect(state.viewportScale).toBe(0.75);
  });
});
