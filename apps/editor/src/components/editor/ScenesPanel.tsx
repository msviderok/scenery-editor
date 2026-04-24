import type { SpriteAsset, SpriteNode, SpriteProject } from "../../../../../shared/ast";

type ScenesPanelProps = {
  selectedScene: SpriteProject["scenes"][number];
  selectedNode: SpriteNode | null;
  selectedAsset: SpriteAsset | null;
  onUpdateScene: (updater: (scene: SpriteProject["scenes"][number]) => void) => void;
  onUpdateNode: (nodeId: string, updater: (node: SpriteNode) => void) => void;
};

const fieldLabelClass =
  "font-[var(--font-ui)] text-[9px] font-bold uppercase tracking-[0.14em] text-white/38";
const textInputClass =
  "sb-input h-7 px-2 font-mono text-[11px] [font-variant-numeric:tabular-nums]";

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function ScenesPanel(props: ScenesPanelProps) {
  const { selectedScene, selectedNode, selectedAsset, onUpdateScene, onUpdateNode } = props;

  if (!selectedNode || !selectedAsset) {
    return (
      <div className="min-h-0 shrink-0 overflow-y-auto border-t border-white/10 px-3 py-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
            Scene
          </span>
          <span className="font-mono text-[10px] text-[var(--accent)]">
            {selectedScene.size.width} × {selectedScene.size.height}
          </span>
        </div>

        <label className="mb-2 flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Name</span>
          <input
            value={selectedScene.name}
            className={`${textInputClass} font-[var(--font-ui)] text-white`}
            onChange={(event) =>
              onUpdateScene((scene) => {
                scene.name = event.currentTarget.value;
              })
            }
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Width</span>
            <input
              type="number"
              min={64}
              value={selectedScene.size.width}
              className={textInputClass}
              onChange={(event) =>
                onUpdateScene((scene) => {
                  scene.size.width = Math.max(64, parseNumber(event.currentTarget.value, 1280));
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Height</span>
            <input
              type="number"
              min={64}
              value={selectedScene.size.height}
              className={textInputClass}
              onChange={(event) =>
                onUpdateScene((scene) => {
                  scene.size.height = Math.max(64, parseNumber(event.currentTarget.value, 720));
                })
              }
            />
          </label>
        </div>
      </div>
    );
  }

  const rotationValue = ((selectedNode.rotation % 360) + 360) % 360;

  return (
    <div className="min-h-0 max-h-[48vh] shrink-0 overflow-y-auto border-t border-white/10 px-3 py-3">
      <div className="mb-3 min-w-0">
        <span className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
          Properties
        </span>
        <div className="mt-1 truncate font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
          {selectedAsset.fileName}
        </div>
      </div>

      <label className="mb-3 flex flex-col gap-1.5">
        <span className={fieldLabelClass}>Opacity</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={selectedNode.opacity}
            className="accent-[var(--accent)]"
            onChange={(event) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.opacity = Math.max(0, Math.min(1, Number(event.currentTarget.value) || 0));
              })
            }
          />
          <span className="w-10 text-right font-mono text-[10px] text-white/58">
            {Math.round(selectedNode.opacity * 100)}%
          </span>
        </div>
      </label>

      <div className="mb-3 flex flex-col gap-1.5">
        <span className={fieldLabelClass}>Rotation</span>
        <div className="grid grid-cols-[minmax(0,1fr)_52px] items-end gap-2">
          <input
            type="number"
            value={rotationValue}
            className={textInputClass}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.rotation = parseNumber(event.currentTarget.value, rotationValue);
              })
            }
          />
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              className="sb-icon-button h-7 w-full text-[10px]"
              onClick={() =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.rotation -= 45;
                })
              }
            >
              -45
            </button>
            <button
              type="button"
              className="sb-icon-button h-7 w-full text-[10px]"
              onClick={() =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.rotation += 45;
                })
              }
            >
              +45
            </button>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <span className={fieldLabelClass}>Tint</span>
        <div className="grid grid-cols-[minmax(0,1fr)_70px] items-end gap-2">
          <input
            type="color"
            value={selectedNode.tint ?? "#ffffff"}
            className="h-8 w-full cursor-pointer border border-white/14 bg-transparent p-1"
            onChange={(event) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.tint = event.currentTarget.value;
              })
            }
          />
          <button
            type="button"
            className="sb-button sb-button-compact sb-button-muted h-8 px-2.5 text-[10px]"
            onClick={() =>
              onUpdateNode(selectedNode.id, (node) => {
                node.tint = null;
              })
            }
          >
            {selectedNode.tint ? "Clear" : "None"}
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabelClass}>Repeat</span>
          <select
            value={selectedNode.style.backgroundRepeat ?? "no-repeat"}
            className={textInputClass}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.style.backgroundRepeat = event.currentTarget.value;
              })
            }
          >
            <option value="no-repeat">None</option>
            <option value="repeat">Repeat</option>
            <option value="repeat-x">Repeat X</option>
            <option value="repeat-y">Repeat Y</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabelClass}>BG Size</span>
          <select
            value={selectedNode.style.backgroundSize ?? "contain"}
            className={textInputClass}
            onChange={(event) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.style.backgroundSize = event.currentTarget.value;
              })
            }
          >
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="auto">Auto</option>
            <option value="32px">32px</option>
            <option value="64px">64px</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabelClass}>X / Y</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={Math.round(selectedNode.x)}
              className={textInputClass}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.x = parseNumber(event.currentTarget.value, node.x);
                })
              }
            />
            <input
              type="number"
              value={Math.round(selectedNode.y)}
              className={textInputClass}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.y = parseNumber(event.currentTarget.value, node.y);
                })
              }
            />
          </div>
        </label>

        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabelClass}>W / H</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={4}
              value={Math.round(selectedNode.width)}
              className={textInputClass}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.width = Math.max(4, parseNumber(event.currentTarget.value, node.width));
                })
              }
            />
            <input
              type="number"
              min={4}
              value={Math.round(selectedNode.height)}
              className={textInputClass}
              onChange={(event) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.height = Math.max(4, parseNumber(event.currentTarget.value, node.height));
                })
              }
            />
          </div>
        </label>
      </div>
    </div>
  );
}
