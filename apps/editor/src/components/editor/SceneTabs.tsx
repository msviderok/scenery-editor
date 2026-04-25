import { Layers3, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  onRename: (sceneId: string, name: string) => void;
};

function SortableSceneTab(props: {
  scene: SpriteProject["scenes"][number];
  index: number;
  active: boolean;
  canClose: boolean;
  onSelect: (sceneId: string) => void;
  onClose: (sceneId: string) => void;
  onRename: (sceneId: string, name: string) => void;
}) {
  const { scene, index, active, canClose, onSelect, onClose, onRename } = props;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(scene.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraftName(scene.name);
  }, [editing, scene.name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== scene.name) {
      onRename(scene.id, trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraftName(scene.name);
    setEditing(false);
  };
  const { ref, isDragging, isDropTarget } = useSortable<SceneTabDragData>({
    id: scene.id,
    index,
    type: DND_TYPE_SCENE_TAB,
    group: SCENE_TABS_GROUP_ID,
    disabled: editing,
    data: {
      kind: DND_TYPE_SCENE_TAB,
      sceneId: scene.id,
      sceneName: scene.name,
      sceneWidth: scene.size.width,
      sceneHeight: scene.size.height,
    },
  });

  return (
    <Button
      ref={ref}
      type="button"
      className={`group relative flex h-full min-w-0 shrink-0 touch-none items-center gap-2 border-r border-white/10 px-3 text-left transition-[color,opacity,background-color] ${
        active
          ? "bg-[#232323] text-white"
          : "bg-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/78"
      } ${isDragging ? "opacity-35" : ""} ${isDropTarget && !isDragging ? "bg-white/[0.06]" : ""}`}
      onClick={() => {
        if (!editing) onSelect(scene.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (active) setEditing(true);
      }}
    >
      {active ? <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]" /> : null}

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draftName}
          className="max-w-[160px] min-w-[40px] bg-transparent font-[var(--font-ui)] text-[13px] font-semibold text-white outline-none"
          onChange={(event) => setDraftName(event.currentTarget.value)}
          onBlur={commit}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        />
      ) : (
        <span className="max-w-[160px] truncate font-[var(--font-ui)] text-[13px] font-semibold">
          {scene.name}
        </span>
      )}
      <span className="shrink-0 font-mono text-[10px] text-white/38">
        {scene.size.width}×{scene.size.height}
      </span>

      {canClose ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                className="grid h-4 w-4 shrink-0 place-items-center text-white/28 transition-colors group-hover:text-white/56 hover:text-white"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(scene.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            }
          />
          <TooltipContent>Close scene</TooltipContent>
        </Tooltip>
      ) : null}
    </Button>
  );
}

export function SceneTabs(props: SceneTabsProps) {
  const { scenes, activeSceneId, onSelect, onClose, onAdd, onReorder, onRename } = props;
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
              onRename={onRename}
            />
          );
        })}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                className="grid h-full w-10 shrink-0 place-items-center text-white/45 transition-colors hover:bg-white/[0.04] hover:text-[var(--accent)]"
                onClick={onAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>New scene</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
