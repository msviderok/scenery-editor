<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.

<!--VITE PLUS END-->

## Project Knowledge Base

Keep this section current when architecture, data model, persistence, or editor interaction rules change. Update it in the same change as the code whenever possible, and remove stale notes instead of appending contradictory history.

### Current implementation snapshot

- The original standalone HTML/Babel scene-builder prototype has been replaced. The current product lives in `apps/editor` as a React 19 + TypeScript + TanStack Start app running through Vite+.
- Shared project schema and serialization live in `packages/sprite-editor-ast-schema/src/index.ts` and are consumed via `@msviderok/sprite-editor-ast-schema`.
- Editor-only state, geometry, drag-and-drop helpers, asset utilities, and persistence live under `apps/editor/src/editor`.
- `apps/editor/src/components/editor/EditorApp.tsx` is the editor composition root, mounted from `apps/editor/src/routes/index.tsx`. Major UI ownership is:
  - `SceneTabs.tsx`: scene tabs and scene tab drag/reorder behavior
  - `AssetsPanel.tsx`: folder sprite browser, project asset list, refresh, uploads, drag sources
  - `Workspace.tsx`: pan/zoom workspace, node interactions, drop placement, keyboard shortcuts
  - `SceneCanvas.tsx`: scene background, grid, node rendering, drag ghost
  - `ScenesPanel.tsx`: scene settings and single-node property editing
  - `FloatingNodeToolbar.tsx`, `SelectionOverlay.tsx`, `NewSceneModal.tsx`: node actions, handles/selection UI, scene creation

### Stack and state

- Use Vite+ commands only; do not call `pnpm`, `npm`, or `yarn` directly for repo workflows.
- The editor uses React, Zustand vanilla stores, and Immer. `useEditorState.ts` owns the singleton editor store, reducer dispatch, mutation helper, and derived selectors.
- `useEditorEffects.ts` owns side effects:
  - fetches the UploadThing asset list from `/api/uploadthing/files`
  - refreshes folder sprite metadata on a 2.5s interval
  - restores workspace scroll after load
  - autosaves editor state to `localStorage`
  - tracks `Shift` state for interaction modifiers

### Data model

- `SpriteProject` shape in `packages/ast/src/index.ts` is the source of truth:
  - `schemaVersion: 1`
  - `assets: Record<string, SpriteAsset>`
  - `scenes: SpriteScene[]`
- `SpriteAsset` currently supports image assets only. An asset must carry one of `sourcePath`, `url`, or `dataUrl`.
- `SpriteScene` stores `id`, `name`, `size`, `backgroundStyle`, and `nodes`.
- `SpriteNode` stores placement and rendering state: `assetId`, `x`, `y`, `width`, `height`, `rotation`, `opacity`, `locked`, `flipH`, `flipV`, `tint`, `collisions`, and CSS-like background style overrides.
- Serialize and validate through the shared AST helpers instead of hand-rolling JSON contracts.

### Interaction model

- The workspace uses world coordinates with a centered scene and a separate pan offset. `Workspace.tsx` handles screen/world conversion.
- Viewport scale defaults to `0.75` and clamps to `0.1..4`. Grid size defaults to `4` and is clamped to `2..32` using the `GRID_SIZE_BREAKPOINTS` list.
- Nodes support drag, resize, rotate, and marquee selection through the `Interaction` union in `apps/editor/src/editor/types.ts`.
- Resize behavior snaps to the active grid and preserves the node's current aspect ratio by default. Holding `Shift` switches resize into free-form mode, and the properties panel exposes a revert action that restores the asset's original aspect ratio.
- Workspace zoom supports both explicit `Shift` + wheel zooming and macOS trackpad pinch-to-zoom. Pinch gestures are detected via `wheel` events with `ctrlKey === true`, with Safari/WebKit `gesturestart` / `gesturechange` / `gestureend` listeners layered in as a fallback.
- Keyboard behavior:
  - `Space`: temporary pan mode
  - `Escape`: clear selection
  - `Delete` / `Backspace`: delete selected unlocked nodes
- Shift is used as an interaction modifier and is tracked in editor state rather than read ad hoc inside every handler.

### Assets, import/export, and persistence

- UploadThing storage is exposed to the app through the TanStack Start server route at `/api/uploadthing/files`.
- Dragging an UploadThing asset into the workspace lazily creates a project asset if one with the same `url` does not already exist.
- Uploading images sends them to UploadThing, records their natural dimensions, and inserts URL-backed assets into `project.assets`.
- Export uses `buildEmbeddedExportProject()` and `serializeEmbeddedProject()` so every asset is embedded as a data URL in the exported JSON.
- Import parses the JSON through `parseSpriteProject()` and resets selection plus editor UI state that depends on the previous project.
- Custom AST preview also lives in `apps/editor` through the `/preview/imported` route, which previews the imported project's first scene without mutating editor state or autosave.
- Autosave uses double-buffered React-specific `localStorage` slots:
  - active key: `sprite-editor-react:persistence:active-slot`
  - slots: `sprite-editor-react:persistence:slot-0` and `sprite-editor-react:persistence:slot-1`
- The persistence reader also understands the older Solid persistence keys for migration compatibility.

### Product behavior carried forward from the prototype

- The visual direction remains a dark editor UI with an accent-driven selection/highlight system.
- Scene authoring is still centered on multi-scene editing, drag-and-drop asset placement, per-node property editing, collision toggles, flips, tinting, layering, and duplication.
- The properties panel still exposes the core controls from the original handoff: opacity, rotation, tint, background repeat/size, scene size, and node dimensions/position.

### Known caveats

- Marquee hit testing and resize bounds are axis-aligned; rotation is normalized for display/rendering, but rotated nodes do not get rotation-aware selection or resize math.
- `MIN_NODE_SIZE` is `4` and `MIN_SCENE_SIZE` is `64`; maintain those guardrails unless there is a deliberate schema or UX change.
- Autosave failure is non-fatal but important. The UI exposes `persistenceError`; preserve that path when changing persistence behavior.
