<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

## Project Knowledge Base

Keep this section current when architecture, data model, persistence, or editor interaction rules change. Update it in the same change as the code whenever possible, and remove stale notes instead of appending contradictory history.

### Current implementation snapshot

- The original standalone HTML/Babel scene-builder prototype has been replaced. The current product lives in `apps/editor` as a React 19 + TypeScript + Vite+ app.
- Shared project schema and serialization live in `packages/ast/src/index.ts` and are consumed via `@msviderok/sprite-editor-ast`.
- Editor-only state, geometry, drag-and-drop helpers, asset utilities, and persistence live under `apps/editor/src/editor`.
- `apps/editor/src/App.tsx` is the composition root. Major UI ownership is:
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
  - fetches the folder sprite manifest from `/__sprite-editor__/sprites.json`
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
- Keyboard behavior:
  - `Space`: temporary pan mode
  - `Escape`: clear selection
  - `Delete` / `Backspace`: delete selected unlocked nodes
- Shift is used as an interaction modifier and is tracked in editor state rather than read ad hoc inside every handler.

### Assets, import/export, and persistence

- The `sprites/` folder is exposed to the app through the manifest route `/__sprite-editor__/sprites.json`.
- Dragging a folder sprite into the workspace lazily creates a project asset if one with the same `sourcePath` does not already exist.
- Uploading images reads them as data URLs and records their natural dimensions before inserting them into `project.assets`.
- Export uses `buildEmbeddedExportProject()` and `serializeEmbeddedProject()` so every asset is embedded as a data URL in the exported JSON.
- Import parses the JSON through `parseSpriteProject()` and resets selection plus editor UI state that depends on the previous project.
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
