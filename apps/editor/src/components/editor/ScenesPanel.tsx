import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { MIN_NODE_SIZE, MIN_SCENE_SIZE } from "@/editor/constants";
import { restoreAspectRatio } from "@/editor/geometry";
import type { SpriteAsset, SpriteNode, SpriteProject } from "@msviderok/sprite-editor-ast-schema";

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
  "h-7 border border-white/14 bg-white/[0.03] px-2 font-mono text-[11px] text-[var(--foreground)] outline-none [font-variant-numeric:tabular-nums] focus:border-[var(--accent)] focus:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_45%,transparent)]";

function parseBackgroundSize(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
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
            <NumberField
              integer
              minValue={MIN_SCENE_SIZE}
              value={selectedScene.size.width}
              className={textInputClass}
              onValueChange={(value) =>
                onUpdateScene((scene) => {
                  scene.size.width = value;
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabelClass}>Height</span>
            <NumberField
              integer
              minValue={MIN_SCENE_SIZE}
              value={selectedScene.size.height}
              className={textInputClass}
              onValueChange={(value) =>
                onUpdateScene((scene) => {
                  scene.size.height = value;
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
          <NumberField
            value={rotationValue}
            className={textInputClass}
            onValueChange={(value) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.rotation = value;
              })
            }
          />
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="iconButton"
              type="button"
              className="h-7 w-full text-[10px]"
              onClick={() =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.rotation -= 45;
                })
              }
            >
              -45
            </Button>
            <Button
              variant="iconButton"
              type="button"
              className="h-7 w-full text-[10px]"
              onClick={() =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.rotation += 45;
                })
              }
            >
              +45
            </Button>
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
          <Button
            variant="muted"
            size="compact"
            type="button"
            className="h-8 px-2.5 text-[10px]"
            onClick={() =>
              onUpdateNode(selectedNode.id, (node) => {
                node.tint = null;
              })
            }
          >
            {selectedNode.tint ? "Clear" : "None"}
          </Button>
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
          <NumberField
            integer
            minValue={1}
            value={parseBackgroundSize(selectedNode.style.backgroundSize, selectedAsset.width)}
            className={textInputClass}
            onValueChange={(value) =>
              onUpdateNode(selectedNode.id, (node) => {
                node.style.backgroundSize = `${value}px ${value}px`;
              })
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={fieldLabelClass}>W / H</span>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              integer
              minValue={MIN_NODE_SIZE}
              value={selectedNode.width}
              className={textInputClass}
              onValueChange={(value) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.width = value;
                })
              }
            />
            <NumberField
              integer
              minValue={MIN_NODE_SIZE}
              value={selectedNode.height}
              className={textInputClass}
              onValueChange={(value) =>
                onUpdateNode(selectedNode.id, (node) => {
                  node.height = value;
                })
              }
            />
          </div>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={fieldLabelClass}>Aspect</span>
          <Button
            variant="muted"
            size="compact"
            type="button"
            className="h-7 px-2 text-[10px]"
            onClick={() => {
              const restoredSize = restoreAspectRatio(
                { width: selectedNode.width, height: selectedNode.height },
                { width: selectedAsset.width, height: selectedAsset.height },
              );

              onUpdateNode(selectedNode.id, (node) => {
                node.width = restoredSize.width;
                node.height = restoredSize.height;
              });
            }}
          >
            Revert Ratio
          </Button>
        </div>
      </div>
    </div>
  );
}
