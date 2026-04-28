export const WORKSPACE_PADDING = 0;
export const MIN_NODE_SIZE = 4;
export const MIN_SCENE_SIZE = 64;
export const AUTOSAVE_DELAY_MS = 120;
export const PERSISTENCE_VERSION = 1;
export const DEFAULT_VIEWPORT_SCALE = 0.75;
export const DEFAULT_GRID_SIZE = 4;
export const GRID_SIZE_BREAKPOINTS = [2, 4, 8, 12, 16, 20, 24, 28, 32] as const;
export const MIN_VIEWPORT_SCALE = 0.1;
export const MAX_VIEWPORT_SCALE = 4;
export const SHIFT_SCROLL_ZOOM_SPEED = 0.02;
export const TRACKPAD_PINCH_ZOOM_SENSITIVITY = 0.0025;
export const MIN_GRID_SIZE = 2;
export const MAX_GRID_SIZE = 32;

export const REACT_PERSISTENCE_ACTIVE_SLOT_KEY = "sprite-editor-react:persistence:active-slot";
export const REACT_PERSISTENCE_SLOT_KEYS = [
  "sprite-editor-react:persistence:slot-0",
  "sprite-editor-react:persistence:slot-1",
] as const;

export const SOLID_PERSISTENCE_ACTIVE_SLOT_KEY = "sprite-editor:persistence:active-slot";
export const SOLID_PERSISTENCE_SLOT_KEYS = [
  "sprite-editor:persistence:slot-0",
  "sprite-editor:persistence:slot-1",
] as const;

export const SPRITES_MANIFEST_ROUTE = "/__sprite-editor__/sprites.json";
export const PROJECT_ASSET_MIME = "application/x-sprite-asset";
export const FOLDER_ASSET_MIME = "application/x-sprite-folder-asset";

export const SCENE_PRESETS = [
  { width: 640, height: 360 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
  { width: 800, height: 600 },
] as const;
