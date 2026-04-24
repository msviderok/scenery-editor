import { Layers3, Plus, X } from "lucide-react";
import { useState } from "react";
import type { SpriteProject } from "../../../../../shared/ast";

type SceneTabsProps = {
  scenes: SpriteProject["scenes"];
  activeSceneId: string;
  onSelect: (sceneId: string) => void;
  onClose: (sceneId: string) => void;
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
};

export function SceneTabs(props: SceneTabsProps) {
  const { scenes, activeSceneId, onSelect, onClose, onAdd, onReorder } = props;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (event: React.DragEvent, index: number) => {
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 0, 0);
    queueMicrotask(() => {
      document.body.removeChild(ghost);
    });
  };

  return (
    <>
      <div className="flex w-[168px] shrink-0 items-center gap-2 border-r border-white/10 px-3">
        <Layers3 className="h-4 w-4 shrink-0 text-[var(--accent)]" />
        <span className="truncate font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          Scene Builder
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto border-r border-white/10 [scrollbar-width:none]">
        {scenes.map((scene, index) => {
          const active = scene.id === activeSceneId;
          const dragging = dragIndex === index;
          const dropTarget = dragOverIndex === index && dragIndex !== index;

          return (
            <button
              key={scene.id}
              draggable
              type="button"
              className={`group relative flex h-full min-w-0 shrink-0 items-center gap-2 border-r border-white/10 px-3 text-left transition-colors ${
                active
                  ? "bg-[#232323] text-white"
                  : "bg-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/78"
              } ${dragging ? "opacity-40" : ""}`}
              onClick={() => onSelect(scene.id)}
              onDragStart={(event) => handleDragStart(event, index)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex !== null && dragIndex !== index) {
                  onReorder(dragIndex, index);
                }
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
            >
              {active ? (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]" />
              ) : null}
              {dropTarget ? (
                <span className="absolute inset-y-[7px] left-0 w-px bg-[var(--accent)]" />
              ) : null}

              <span className="max-w-[160px] truncate font-[var(--font-ui)] text-[13px] font-semibold">
                {scene.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-white/38">
                {scene.size.width}×{scene.size.height}
              </span>

              {scenes.length > 1 ? (
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center text-white/28 transition-colors group-hover:text-white/56 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(scene.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          type="button"
          title="New scene"
          className="grid h-full w-10 shrink-0 place-items-center text-white/45 transition-colors hover:bg-white/[0.04] hover:text-[var(--accent)]"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
