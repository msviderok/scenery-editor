import { ChevronDown, ArrowDown as IconArrowDown, ArrowUp as IconArrowUp, Plus as IconPlus, Trash2 } from "lucide-react";
import { type BackgroundStyle, type SpriteProject } from "../../../../../shared/ast";
import { MIN_SCENE_SIZE } from "@/editor/constants";
import { clampGridSize } from "@/editor/geometry";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type ScenesPanelProps = {
  project: SpriteProject;
  selectedScene: SpriteProject["scenes"][number];
  selectedSceneId: string;
  gridVisible: boolean;
  gridSize: number;
  onAddScene: () => void;
  onDeleteScene: () => void;
  onSelectScene: (sceneId: string) => void;
  onMoveScene: (from: number, to: number) => void;
  onUpdateScene: (updater: (scene: SpriteProject["scenes"][number]) => void) => void;
  onSetGridVisible: (visible: boolean) => void;
  onSetGridSize: (gridSize: number) => void;
};

function SceneStyleInput(props: {
  selectedScene: SpriteProject["scenes"][number];
  onUpdateScene: (updater: (scene: SpriteProject["scenes"][number]) => void) => void;
  property: keyof BackgroundStyle;
  label: string;
  type?: "text" | "color";
}) {
  const { selectedScene, onUpdateScene, property, label, type = "text" } = props;
  return (
    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
      <span>{label}</span>
      <input
        className={
          type === "color"
            ? "h-8 w-full cursor-pointer rounded-lg border border-white/8 bg-white/5 p-0.5"
            : "w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
        }
        type={type}
        value={selectedScene.backgroundStyle[property] ?? (type === "color" ? "#151515" : "")}
        onChange={(event) => {
          const value = event.currentTarget.value.trim();
          onUpdateScene((scene) => {
            if (value) {
              scene.backgroundStyle[property] = value;
            } else {
              delete scene.backgroundStyle[property];
            }
          });
        }}
      />
    </label>
  );
}

export function ScenesPanel(props: ScenesPanelProps) {
  const {
    project,
    selectedScene,
    selectedSceneId,
    gridVisible,
    gridSize,
    onAddScene,
    onDeleteScene,
    onSelectScene,
    onMoveScene,
    onUpdateScene,
    onSetGridVisible,
    onSetGridSize,
  } = props;

  return (
    <Collapsible defaultOpen className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 shrink-0 group">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className="h-3.5 w-3.5 text-white/40 transition-transform duration-200 group-data-[panel-open=false]:-rotate-90" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Scenes</div>
            <h2 className="text-[15px] font-semibold">Sequence</h2>
          </div>
        </CollapsibleTrigger>
        <Button variant="outline" size="icon-sm" title="Add scene" onClick={onAddScene}>
          <IconPlus />
        </Button>
      </div>

      <CollapsibleContent className="flex flex-col gap-1">
        <div className="flex flex-col gap-1">
          {project.scenes.map((scene, index) => (
            <div
              key={scene.id}
              className={`flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-transparent px-2.5 py-2 transition hover:bg-white/4 ${
                scene.id === selectedSceneId ? "border-blue-400/35 bg-blue-400/8" : ""
              }`}
            >
              <button
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-left text-[13px] text-white"
                onClick={() => onSelectScene(scene.id)}
              >
                <span className="block truncate">{scene.name}</span>
              </button>
              <span className="inline-flex gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  title="Move up"
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveScene(index, index - 1);
                  }}
                >
                  <IconArrowUp />
                </Button>
                <Button
                  variant="outline"
                  size="icon-xs"
                  title="Move down"
                  disabled={index === project.scenes.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveScene(index, index + 1);
                  }}
                >
                  <IconArrowDown />
                </Button>
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Name</span>
            <input
              className="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
              value={selectedScene.name}
              onChange={(event) => onUpdateScene((scene) => void (scene.name = event.currentTarget.value))}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Width</span>
            <input
              className="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
              type="number"
              min={MIN_SCENE_SIZE}
              value={selectedScene.size.width}
              onChange={(event) =>
                onUpdateScene(
                  (scene) =>
                    void (scene.size.width = Math.max(MIN_SCENE_SIZE, Number(event.currentTarget.value) || 1920))
                )
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Height</span>
            <input
              className="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
              type="number"
              min={MIN_SCENE_SIZE}
              value={selectedScene.size.height}
              onChange={(event) =>
                onUpdateScene(
                  (scene) =>
                    void (scene.size.height = Math.max(MIN_SCENE_SIZE, Number(event.currentTarget.value) || 1080))
                )
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-[7px] text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Show grid</span>
            <input
              className="m-0 accent-[#5f98ff]"
              type="checkbox"
              checked={gridVisible}
              onChange={(event) => onSetGridVisible(event.currentTarget.checked)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
            <span>Grid size</span>
            <input
              className="w-full rounded-lg border border-white/8 bg-white/5 px-2 py-[7px] text-xs text-white outline-none transition normal-case tracking-normal focus:border-white/16 focus:bg-white/8"
              type="number"
              min="4"
              max="128"
              value={gridSize}
              onChange={(event) => onSetGridSize(clampGridSize(Number(event.currentTarget.value) || 32))}
            />
          </label>
        </div>

        <div className="mt-3 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
          Scene background
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <SceneStyleInput selectedScene={selectedScene} onUpdateScene={onUpdateScene} property="backgroundColor" label="Color" type="color" />
          <SceneStyleInput selectedScene={selectedScene} onUpdateScene={onUpdateScene} property="backgroundImage" label="Image" />
          <SceneStyleInput selectedScene={selectedScene} onUpdateScene={onUpdateScene} property="backgroundSize" label="Size" />
          <SceneStyleInput selectedScene={selectedScene} onUpdateScene={onUpdateScene} property="backgroundRepeat" label="Repeat" />
          <SceneStyleInput selectedScene={selectedScene} onUpdateScene={onUpdateScene} property="backgroundPosition" label="Position" />
        </div>

        {project.scenes.length > 1 ? (
          <Button variant="destructive" size="sm" title="Delete scene" onClick={onDeleteScene}>
            <Trash2 />
          </Button>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
