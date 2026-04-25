import { Layers3, Plus, X } from "lucide-react";
import { useMemo } from "react";
import { useDragDropMonitor } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { SpriteProject } from "../../../../../shared/ast";
import {
  DND_TYPE_SCENE_TAB,
  SCENE_TABS_GROUP_ID,
  isSceneTabDragData,
  type SceneTabDragData,
} from "@/editor/dnd";

type SceneTabsProps = {
  scenes: SpriteProject["scenes"];
  activeSceneId: string;
  onSelect: (sceneId: string) => void;
  onClose: (sceneId: string) => void;
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
};

function SortableSceneTab(props: {
  scene: SpriteProject["scenes"][number];
  index: number;
  active: boolean;
  canClose: boolean;
  onSelect: (sceneId: string) => void;
  onClose: (sceneId: string) => void;
}) {
  const { scene, index, active, canClose, onSelect, onClose } = props;
  const { ref, isDragging, isDropTarget } = useSortable<SceneTabDragData>({
    id: scene.id,
    index,
    type: DND_TYPE_SCENE_TAB,
    group: SCENE_TABS_GROUP_ID,
    data: {
      kind: DND_TYPE_SCENE_TAB,
      sceneId: scene.id,
      sceneName: scene.name,
      sceneWidth: scene.size.width,
      sceneHeight: scene.size.height,
    },
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`group relative flex h-full min-w-0 shrink-0 touch-none items-center gap-2 border-r border-white/10 px-3 text-left transition-[color,opacity,background-color] ${
        active
          ? "bg-[#232323] text-white"
          : "bg-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/78"
      } ${isDragging ? "opacity-35" : ""} ${isDropTarget && !isDragging ? "bg-white/[0.06]" : ""}`}
      onClick={() => onSelect(scene.id)}
    >
      {active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]" /> : null}

      <span className="max-w-[160px] truncate font-[var(--font-ui)] text-[13px] font-semibold">
        {scene.name}
      </span>
      <span className="shrink-0 font-mono text-[10px] text-white/38">
        {scene.size.width}×{scene.size.height}
      </span>

      {canClose ? (
        <button
          type="button"
          className="grid h-4 w-4 shrink-0 place-items-center text-white/28 transition-colors group-hover:text-white/56 hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onClose(scene.id);
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </button>
  );
}

export function SceneTabs(props: SceneTabsProps) {
  const { scenes, activeSceneId, onSelect, onClose, onAdd, onReorder } = props;
  const sceneIndexes = useMemo(
    () => new Map(scenes.map((scene, index) => [scene.id, index])),
    [scenes],
  );

  useDragDropMonitor({
    onDragEnd(event) {
      const sourceData = event.operation.source?.data;
      const targetData = event.operation.target?.data;

      if (!isSceneTabDragData(sourceData) || !isSceneTabDragData(targetData)) {
        return;
      }

      const from = sceneIndexes.get(sourceData.sceneId);
      const to = sceneIndexes.get(targetData.sceneId);

      if (from == null || to == null || from === to) {
        return;
      }

      onReorder(from, to);
    },
  });

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
          return (
            <SortableSceneTab
              key={scene.id}
              scene={scene}
              index={index}
              active={scene.id === activeSceneId}
              canClose={scenes.length > 1}
              onSelect={onSelect}
              onClose={onClose}
            />
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
