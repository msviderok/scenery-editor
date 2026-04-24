# 2D Scene Builder — Design & Functionality Handoff

## Overview

A single-page application (SPA) 2D scene authoring tool built with React (via Babel standalone) in a single self-contained HTML file. The tool allows users to compose 2D game scenes by dragging assets onto a canvas, configuring per-asset properties, and managing multiple scenes simultaneously.

---

## Tech Stack

| Layer     | Choice                                    | Reason                                        |
| --------- | ----------------------------------------- | --------------------------------------------- |
| Framework | React 18 (UMD + Babel standalone)         | No build step; single HTML file delivery      |
| Styling   | Vanilla CSS (custom properties)           | Full control, no runtime overhead             |
| Icons     | Inline SVG paths (Lucide-style)           | Zero dependency, perfectly crisp at all sizes |
| Fonts     | Space Grotesk + Space Mono (Google Fonts) | Neobrutalist character; mono for data/labels  |
| State     | React useState/useCallback/useMemo        | Flat, predictable state tree                  |

---

## Design Decisions

### Theme: Dark Neobrutalism

The app uses a **dark neobrutalist** aesthetic with a **pastel accent color** system.

Key principles:

- **Stark dark backgrounds**: `#0c0c0c` base, `#171717` surfaces, `#202020` elevated surfaces
- **Hard borders**: `1.5–2px solid` borders everywhere, no border-radius beyond `2px`
- **Box shadows are offset, not blurred**: `3px 3px 0 #000` — the neobrutalist signature
- **No gradients** on UI chrome; only structural depth through layering
- **Pastel accents** that pop against the dark background without being aggressive

### Accent Color System

Four pastel accent options, user-selectable via Tweaks panel:

| Name                  | Hex       |
| --------------------- | --------- |
| Pastel Pink (default) | `#ff8fab` |
| Mint Green            | `#68e09a` |
| Soft Lavender         | `#b4a4f8` |
| Warm Peach            | `#ffb380` |

The accent color is applied via a single CSS custom property `--accent`, updated at runtime via `document.documentElement.style.setProperty`. This drives: active tab underline, selected asset outlines, resize handles, asset toolbar active states, snap toggle, neo-buttons, property panel focus rings, and the logo color.

### Typography

- **UI labels, buttons, headers**: Space Grotesk (humanist sans, weight 600–700)
- **Monospace data** (filenames, dimensions, zoom%, X/Y coords): Space Mono
- **All caps + wide letter-spacing** for section headers and labels (`font-size: 9–10px`, `letter-spacing: .06–.1em`)
- **No text smaller than 9px**

### Layout Architecture

```
body (flex column, 100vh)
  └── #root (flex:1, flex column)
        ├── .tb (top bar, 42px fixed)
        │     ├── .tb-logo (152px, flex-shrink:0)
        │     ├── .tabs (flex:1, scrollable)
        │     └── .tb-right (import/export)
        └── .layout (flex:1, flex row, min-height:0)
              ├── .sb (sidebar, 176px fixed)
              └── .cv-area (flex:1, flex column)
                    └── .cv-vp (flex:1, the canvas viewport)
```

**Critical**: `min-height:0` on `.layout` and `#root` is required to prevent flex children from overflowing their container. Without it, the canvas gets 0 height.

### Canvas Model

- The **scene** is a fixed-size div (e.g. 1280×720px) positioned absolutely inside a "world" div
- The world div receives a CSS `transform: translate(panX, panY) scale(zoom)` — this is the standard "infinite canvas" pattern
- `transform-origin: 0 0` so zoom anchors to the top-left of the world (mouse position is used to compute the correct pan offset during zoom)
- Grid lines are CSS `background-image` repeating linear gradients — no canvas element used

---

## Component Breakdown

### `App` (root)

**State owned here:**

```js
scenes: [{id, name, w, h, assets: []}]   // all scenes
activeId: string                          // active scene id
selected: string[]                        // selected asset ids
showModal: boolean                        // new scene modal
toast: string | null                      // toast message
snapEnabled: boolean                      // snap to grid toggle
gridSize: number                          // 16 | 32 | 64
library: LibraryCategory[]               // asset library (default + uploaded)
showTweaks: boolean                       // tweaks panel visibility
accent: string                            // current accent hex
```

**Key callbacks (all memoized with useCallback):**

- `updScene(scene)` — replaces a scene in the array by id
- `updAsset(asset)` — updates a single asset within the active scene
- `delAsset(id)` — removes asset by id, clears from selection
- `dropAsset(asset)` — appends new asset to active scene
- `dupAsset(id)` — clones asset with +20px offset, selects the clone
- `bringForward(id)` / `sendBack(id)` — increments/decrements `zIndex`
- `closeScene(id)` — removes scene, switches to adjacent tab

---

### `TopBar`

- Logo (fixed 152px width, accent-colored)
- Scene tabs (scrollable, active tab has accent underline `::after`)
- New scene button (`+` icon)
- Import / Export buttons (placeholder — `onClick` fires a toast; wire up your own handler via `setToast` or replace the `onClick` entirely)

**To wire Import/Export**: find these two buttons in `App`'s JSX return and replace the `onClick` with your actual handler:

```jsx
<button onClick={()=>setToast('Import AST — wire up your handler here')}>
<button onClick={()=>setToast('Export AST — wire up your handler here')}>
```

---

### `Sidebar`

**Props:** `library, onDragStart, onUpload, selectedAsset, onPropChange, snapEnabled, onSnapToggle, gridSize, onGridSizeChange`

Contains:

1. **Assets header** with upload icon button
2. **Grid controls row**: snap toggle (icon button) + grid size select (16/32/64px)
3. **Asset tree**: collapsible folders, each item is `draggable`
4. **Upload zone**: click triggers file input; also accessible via header icon
5. **PropPanel** (rendered at bottom when an asset is selected)

**Folder open state** is local to Sidebar (`useState`), keyed by category id. Default: Backgrounds + Objects open, Characters + Textures collapsed.

**Drag start**: `e.dataTransfer.setData('assetId', item.id)` — the canvas drop handler reads this.

**Upload**: creates `URL.createObjectURL(file)` for each file, appends to an "Uploaded" category (created on first upload).

---

### `PropPanel`

**Props:** `asset, onChange`

Renders when exactly one asset is selected. All inputs call `onChange({...asset, [key]: value})`.

| Property  | Input Type                  | Notes                                              |
| --------- | --------------------------- | -------------------------------------------------- |
| Opacity   | `range` 0–1                 | Displays as percentage                             |
| Rotation  | Number input + ±45° buttons | In degrees, 0–359                                  |
| Tint      | `color` picker              | Rendered as multiply blend overlay; "None" if null |
| BG Repeat | `select`                    | no-repeat / repeat / repeat-x / repeat-y           |
| BG Size   | `select`                    | contain / cover / auto / 32px / 64px               |
| X / Y     | Number inputs               | World-space coordinates in pixels                  |
| W / H     | Number inputs               | Minimum 4px                                        |

---

### `PlacedAsset`

**Props:** `asset, selected, multiSel, onSelect, onUpdate, onDelete, onBringForward, onSendBack, zoom, snapEnabled, gridSize`

**Rendering:**

- Outer `div.pa`: positioned absolutely at `(asset.x, asset.y)`, rotated via `transform: rotate(Ndeg)`
- Inner `div.pa-body`: applies `flipH`/`flipV` via `scaleX(-1)`/`scaleY(-1)` transform, renders background color or image
- Tint overlay: absolute `div` with `background: asset.tint`, `opacity: 0.45`, `mix-blend-mode: multiply`
- Collision overlay: absolute `div` with green border + inset glow
- Lock icon: shown top-right when `asset.locked`

**Selection states:**

- `.sel`: 2px solid accent outline (single select)
- `.multi-sel`: 2px dashed accent outline (part of multi-select)

**Asset label** (`.pa-label`): shown above the asset when selected, accent background, black text.

**Drag to move** (mousedown → mousemove → mouseup on document):

- Delta divided by `zoom` to convert screen pixels → world pixels
- Snap applied after conversion: `Math.round(v / gridSize) * gridSize`
- Locked assets: `onSelect` fires but drag is skipped

**Resize handles**: 8 handles (4 corners + 4 edges). Each handle's `onMouseDown` starts a resize:

- Corner handles modify both axes
- Edge handles modify one axis
- Northwest/North/West handles also adjust `x`/`y` to keep opposite corner fixed
- Same snap logic applied

**Mini asset toolbar** (`.at`): appears 34px above the asset when selected. Contains:
| Button | Action | Active state |
|---|---|---|
| Lock/Unlock | Toggles `asset.locked` | Highlighted when locked |
| Collision | Toggles `asset.collision` | Highlighted when on |
| Flip H | Toggles `asset.flipH` | Highlighted when on |
| Flip V | Toggles `asset.flipV` | Highlighted when on |
| Bring Forward | `zIndex + 1` | — |
| Send Back | `zIndex - 1` (min 0) | — |
| Duplicate | Clones asset +20px offset | — |
| Delete | Removes asset | Red color |

All toolbar buttons call `e.stopPropagation()` to prevent canvas deselect.

---

### `Canvas`

**Props:** `scene, selected, onSelect, onUpdateAsset, onDeleteAsset, onDropAsset, onBringForward, onSendBack, onDupAsset, snapEnabled, gridSize`

**Local state:** `zoom` (default 1), `pan` ({x, y}), `marquee` (null or {x,y,w,h})

**Refs:** `vpRef` (viewport DOM node), `spaceDown` (boolean, for space+drag pan), `marqRef` (marquee start coords)

#### Zoom

- **Shift + scroll wheel**: zooms around mouse cursor
- Formula: `newZoom = clamp(oldZoom * factor, 0.08, 8)`
- Pan is adjusted to keep the mouse position fixed in world space: `newPan.x = mouseX - (mouseX - oldPan.x) * newZoom / oldZoom`

#### Pan

- **Scroll (no modifier)**: `pan.x -= deltaX`, `pan.y -= deltaY` (natural trackpad scrolling)
- **Space + left-drag** or **middle-mouse drag**: classic pan

#### Scene centering

On scene change (`useEffect` on `scene.id`): pan is set to center the scene in the viewport.

#### Marquee select

- `mousedown` on empty canvas starts marquee
- `mousemove` updates marquee rect
- `mouseup` finds all assets whose bounding box intersects the marquee; selects them
- Minimum 5px drag to trigger selection (avoids accidental select on click)

#### Drag-and-drop from sidebar

- `onDragOver`: `e.preventDefault()` to allow drop
- `onDrop`: reads `assetId` from dataTransfer, resolves library item, computes world position (accounting for pan + zoom), snaps, creates asset via `makeAsset()`

#### Keyboard shortcuts (document-level listeners)

| Key                    | Action                     |
| ---------------------- | -------------------------- |
| `Space` (hold)         | Pan mode (cursor → grab)   |
| `Delete` / `Backspace` | Delete all selected assets |
| `Escape`               | Deselect all               |

#### Multi-select status bar

When `selected.length > 1`, a floating bar appears at the bottom center of the canvas showing count + a delete-all button.

#### Zoom indicator

Fixed `div` at bottom-right of viewport showing current zoom as percentage.

---

### `NewSceneModal`

- Backdrop click closes modal
- Preset grid (4 presets + "Custom…" toggle)
- Custom size: two number inputs (W × H)
- Name input with Enter key submit
- Creates scene with `uid()` id, switches active scene

---

### `TweaksPanel`

Implements the Tweaks protocol for the host environment:

1. On mount: `window.parent.postMessage({type: '__edit_mode_available'}, '*')`
2. Listens for `__activate_edit_mode` / `__deactivate_edit_mode`
3. On close button: posts `__edit_mode_dismissed`
4. On accent change: posts `__edit_mode_set_keys` with `{accent: hex}`

`TWEAK_DEFAULTS` block is a valid JSON object between `/*EDITMODE-BEGIN*/` and `/*EDITMODE-END*/` markers — the host can rewrite this to persist tweak values across sessions.

---

## Data Structures

### Asset Library Category

```js
{
  id: string,        // 'backgrounds' | 'objects' | 'characters' | 'textures' | 'uploaded'
  label: string,     // Display name
  items: LibItem[]
}
```

### Library Item

```js
{
  id: string,        // e.g. 'obj_crate'
  name: string,      // e.g. 'crate.png'
  color: string,     // Fallback color hex (used when no imgSrc)
  w: number,         // Default width when dropped
  h: number,         // Default height when dropped
  imgSrc?: string,   // Object URL (uploaded images only)
}
```

### Scene

```js
{
  id: string,
  name: string,
  w: number,         // Scene width in px
  h: number,         // Scene height in px
  assets: Asset[]
}
```

### Asset (placed on canvas)

```js
{
  id: string,        // uid()
  libId: string,     // Source library item id
  name: string,      // Display name (filename)
  x: number,         // World X position
  y: number,         // World Y position
  w: number,         // Width in px
  h: number,         // Height in px
  zIndex: number,    // Layer order (higher = in front)
  rotation: number,  // Degrees 0–359
  opacity: number,   // 0–1
  flipH: boolean,
  flipV: boolean,
  collision: boolean,
  locked: boolean,
  tint: string|null, // Hex color or null
  bgRepeat: string,  // CSS background-repeat value
  bgSize: string,    // CSS background-size value
  color: string,     // Fallback display color
  imgSrc: string|null // Object URL for uploaded images
}
```

---

## Extension Points

### Wiring Import / Export

Replace the two button `onClick` handlers in `App`'s JSX:

```jsx
// Export: serialize scene state
onClick={()=>{
  const data = JSON.stringify(scenes.find(s=>s.id===activeId));
  // send `data` to your handler
}}

// Import: deserialize and replace scene
onClick={()=>{
  // receive data, parse, call:
  updScene(parsedScene);
}}
```

### Adding Real Image Assets

Add items to `LIBRARY_DEFAULT` with an `imgSrc` field pointing to a hosted image URL. The canvas will render it as a CSS `background-image`.

### Persisting State

Currently all state is in-memory. To persist across sessions, serialize `scenes` + `library` to `localStorage` on change:

```js
useEffect(() => {
  localStorage.setItem("sb_scenes", JSON.stringify(scenes));
}, [scenes]);
```

And rehydrate in `useState` initial value.

### Custom Asset Categories

Add new category objects to `LIBRARY_DEFAULT`:

```js
{id:'props', label:'Props', items:[
  {id:'prop_sign', name:'sign.png', color:'#aaa', w:32, h:64}
]}
```

---

## Known Limitations

1. **Resize + rotation**: Resize handles use axis-aligned math. Resizing a rotated asset will produce skewed results. This is standard in basic 2D editors and would require a full transform decomposition to fix.
2. **No undo/redo**: State mutations are not tracked in a history stack.
3. **No asset name editing**: Asset names are inherited from the library and not editable per-instance.
4. **Uploaded image dimensions**: Uploaded images default to 96×96px; actual image dimensions are not read automatically.
