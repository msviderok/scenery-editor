import type { Draft } from "immer";
import type { SpriteNode, SpriteProject } from "@msviderok/sprite-editor-ast-schema";

export type ResizeHandle = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

export type Interaction =
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
      handle: ResizeHandle;
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

export type MarqueeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FolderSpriteSource = {
  id: string;
  fileName: string;
  relativePath: string;
  sourcePath: string;
  url: string;
  mimeType: string;
};

export type DragGhost = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl: string;
};

export type PersistedEditorUiState = {
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

export type PersistedEditorState = {
  version: number;
  savedAt: number;
  project: SpriteProject;
  ui: PersistedEditorUiState;
};

export type EditorState = PersistedEditorUiState & {
  project: SpriteProject;
  interaction: Interaction | null;
  folderSprites: FolderSpriteSource[];
  dragGhost: DragGhost | null;
  shiftHeld: boolean;
  persistenceError: string | null;
};

export type EditorMutation = (draft: Draft<EditorState>) => void;

export type EditorAction =
  | { type: "mutate"; mutate: EditorMutation }
  | { type: "setInteraction"; interaction: Interaction | null }
  | { type: "setFolderSprites"; folderSprites: FolderSpriteSource[] }
  | { type: "setDragGhost"; dragGhost: DragGhost | null }
  | { type: "setShiftHeld"; shiftHeld: boolean }
  | { type: "setPersistenceError"; persistenceError: string | null };

export type EditorDispatch = (action: EditorAction) => void;

export type EditorSelectors = {
  selectedScene: SpriteProject["scenes"][number];
  selectedNodeSet: Set<string>;
  singleSelectedNode: SpriteNode | null;
  selectedUnlockedNodeIds: string[];
  marqueeRect: MarqueeRect | null;
  currentSceneIndex: number;
  toolbarPosition: {
    left: number;
    top: number;
  } | null;
};
