import { produce } from "immer";
import { useMemo } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { createEmptyProject, type SpriteNode } from "@msviderok/sprite-editor-ast";
import { DEFAULT_GRID_SIZE, DEFAULT_VIEWPORT_SCALE } from "./constants";
import { calculateToolbarPosition, getMarqueeRect } from "./geometry";
import { readPersistedEditorState, sanitizePersistedUiState } from "./persistence";
import type {
  EditorAction,
  EditorDispatch,
  EditorMutation,
  EditorSelectors,
  EditorState,
  PersistedEditorState,
} from "./types";

export function createInitialEditorState(restoredState: PersistedEditorState | null): EditorState {
  const initialProject = restoredState?.project ?? createEmptyProject();
  const initialUiState =
    restoredState?.ui ??
    sanitizePersistedUiState(
      {
        selectedSceneId: initialProject.scenes[0].id,
        selectedNodeIds: [],
        viewportScale: DEFAULT_VIEWPORT_SCALE,
        nodeStyleId: null,
        collisionEditorId: null,
        gridVisible: true,
        gridSize: DEFAULT_GRID_SIZE,
        workspaceScroll: {
          left: 0,
          top: 0,
        },
      },
      initialProject,
    );

  return {
    project: initialProject,
    selectedSceneId: initialUiState.selectedSceneId,
    selectedNodeIds: initialUiState.selectedNodeIds,
    viewportScale: initialUiState.viewportScale,
    nodeStyleId: initialUiState.nodeStyleId,
    collisionEditorId: initialUiState.collisionEditorId,
    gridVisible: initialUiState.gridVisible,
    gridSize: initialUiState.gridSize,
    workspaceScroll: initialUiState.workspaceScroll,
    interaction: null,
    folderSprites: [],
    dragGhost: null,
    shiftHeld: false,
    persistenceError: null,
  };
}

function sanitizeState(draft: EditorState) {
  const sanitized = sanitizePersistedUiState(
    {
      selectedSceneId: draft.selectedSceneId,
      selectedNodeIds: draft.selectedNodeIds,
      viewportScale: draft.viewportScale,
      nodeStyleId: draft.nodeStyleId,
      collisionEditorId: draft.collisionEditorId,
      gridVisible: draft.gridVisible,
      gridSize: draft.gridSize,
      workspaceScroll: draft.workspaceScroll,
    },
    draft.project,
  );

  draft.selectedSceneId = sanitized.selectedSceneId;
  draft.selectedNodeIds = sanitized.selectedNodeIds;
  draft.viewportScale = sanitized.viewportScale;
  draft.nodeStyleId = sanitized.nodeStyleId;
  draft.collisionEditorId = sanitized.collisionEditorId;
  draft.gridVisible = sanitized.gridVisible;
  draft.gridSize = sanitized.gridSize;
  draft.workspaceScroll = sanitized.workspaceScroll;
}

export const editorReducer = produce((draft: EditorState, action: EditorAction) => {
  switch (action.type) {
    case "mutate":
      action.mutate(draft);
      sanitizeState(draft);
      return;
    case "setInteraction":
      draft.interaction = action.interaction;
      return;
    case "setFolderSprites":
      draft.folderSprites = action.folderSprites;
      return;
    case "setDragGhost":
      draft.dragGhost = action.dragGhost;
      return;
    case "setShiftHeld":
      draft.shiftHeld = action.shiftHeld;
      return;
    case "setPersistenceError":
      draft.persistenceError = action.persistenceError;
      return;
  }
});

type EditorStoreState = {
  state: EditorState;
  dispatch: EditorDispatch;
};

type EditorStore = ReturnType<typeof createEditorStore>;

export function createEditorStore(
  restoredState: PersistedEditorState | null = readPersistedEditorState(),
) {
  return createStore<EditorStoreState>()((set) => ({
    state: createInitialEditorState(restoredState),
    dispatch: (action) =>
      set((current) => ({
        state: editorReducer(current.state, action),
      })),
  }));
}

let editorStore: EditorStore | null = null;

function getEditorStore() {
  if (!editorStore) {
    editorStore = createEditorStore();
  }

  return editorStore;
}

export function useEditorState() {
  const store = getEditorStore();
  const state = useStore(store, (snapshot) => snapshot.state);
  const dispatch = useStore(store, (snapshot) => snapshot.dispatch);

  const mutate = (mutation: EditorMutation) => {
    dispatch({ type: "mutate", mutate: mutation });
  };

  const selectors = useMemo<EditorSelectors>(() => {
    const selectedScene =
      state.project.scenes.find((scene) => scene.id === state.selectedSceneId) ??
      state.project.scenes[0];
    const selectedNodeSet = new Set(state.selectedNodeIds);
    const singleSelectedNode =
      state.selectedNodeIds.length === 1
        ? (selectedScene.nodes.find((node) => node.id === state.selectedNodeIds[0]) ?? null)
        : null;
    const selectedUnlockedNodeIds = selectedScene.nodes
      .filter((node) => selectedNodeSet.has(node.id) && !node.locked)
      .map((node) => node.id);
    const marqueeRect = getMarqueeRect(state.interaction);
    const currentSceneIndex = state.project.scenes.findIndex(
      (scene) => scene.id === selectedScene.id,
    );
    const toolbarPosition = singleSelectedNode
      ? calculateToolbarPosition(singleSelectedNode, state.viewportScale)
      : null;

    return {
      selectedScene,
      selectedNodeSet,
      singleSelectedNode,
      selectedUnlockedNodeIds,
      marqueeRect,
      currentSceneIndex,
      toolbarPosition,
    };
  }, [state]);

  const updateScene = (updater: (scene: EditorState["project"]["scenes"][number]) => void) => {
    mutate((draft) => {
      const scene = draft.project.scenes.find((entry) => entry.id === draft.selectedSceneId);
      if (!scene) return;
      updater(scene);
    });
  };

  const updateNode = (nodeId: string, updater: (node: SpriteNode) => void) => {
    updateScene((scene) => {
      const node = scene.nodes.find((entry) => entry.id === nodeId);
      if (!node) return;
      updater(node);
    });
  };

  return {
    state,
    dispatch,
    mutate,
    updateScene,
    updateNode,
    selectors,
  };
}
