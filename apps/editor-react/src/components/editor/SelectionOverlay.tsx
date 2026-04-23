import { Lock, RotateCw } from "lucide-react";
import { hasAnyCollision, type SpriteScene } from "../../../../../shared/ast";
import { WORKSPACE_PADDING } from "@/editor/constants";
import type { MarqueeRect, ResizeHandle } from "@/editor/types";

type SelectionOverlayProps = {
  scene: SpriteScene;
  viewportScale: number;
  selectedNodeIds: string[];
  selectedNodeSet: Set<string>;
  marqueeRect: MarqueeRect | null;
  onNodePointerDown: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onRotatePointerDown: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (
    nodeId: string,
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLDivElement>
  ) => void;
};

export function SelectionOverlay(props: SelectionOverlayProps) {
  const {
    scene,
    viewportScale,
    selectedNodeIds,
    selectedNodeSet,
    marqueeRect,
    onNodePointerDown,
    onRotatePointerDown,
    onResizePointerDown,
  } = props;

  return (
    <div
      className="absolute top-0 left-0"
      style={{
        width: `${(scene.size.width + WORKSPACE_PADDING * 2) * viewportScale}px`,
        height: `${(scene.size.height + WORKSPACE_PADDING * 2) * viewportScale}px`,
      }}
    >
      {marqueeRect ? (
        <div
          className="pointer-events-none absolute z-40 border-2 border-sky-300/90 bg-sky-400/15 shadow-[0_0_0_1px_rgba(125,211,252,0.35)]"
          style={{
            left: `${(WORKSPACE_PADDING + marqueeRect.x) * viewportScale}px`,
            top: `${(WORKSPACE_PADDING + marqueeRect.y) * viewportScale}px`,
            width: `${marqueeRect.width * viewportScale}px`,
            height: `${marqueeRect.height * viewportScale}px`,
          }}
        />
      ) : null}

      {scene.nodes.map((node) => {
        const isSelected = selectedNodeSet.has(node.id);
        return (
          <div
            key={node.id}
            className={`absolute select-none touch-none ${
              isSelected
                ? "outline outline-2 outline-offset-[2px] outline-amber-300 shadow-[0_0_0_6px_rgba(255,205,100,0.28),0_0_18px_4px_rgba(255,205,100,0.35)] z-20"
                : ""
            }`}
            style={{
              left: `${(WORKSPACE_PADDING + node.x) * viewportScale}px`,
              top: `${(WORKSPACE_PADDING + node.y) * viewportScale}px`,
              width: `${node.width * viewportScale}px`,
              height: `${node.height * viewportScale}px`,
              transform: `rotate(${node.rotation}deg)`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onNodePointerDown(node.id, event);
            }}
          >
            {hasAnyCollision(node.collisions) ? (
              <>
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-amber-300/20 opacity-25 ${
                    node.collisions.top ? "bg-amber-300/90 opacity-100" : ""
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-amber-300/20 opacity-25 ${
                    node.collisions.right ? "bg-amber-300/90 opacity-100" : ""
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-amber-300/20 opacity-25 ${
                    node.collisions.bottom ? "bg-amber-300/90 opacity-100" : ""
                  }`}
                />
                <div
                  className={`pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-amber-300/20 opacity-25 ${
                    node.collisions.left ? "bg-amber-300/90 opacity-100" : ""
                  }`}
                />
              </>
            ) : null}

            {node.locked ? (
              <div className="pointer-events-none absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded bg-amber-300/20 text-[#ffd991] ring-1 ring-amber-300/40">
                <Lock className="h-3 w-3" />
              </div>
            ) : null}

            {isSelected && selectedNodeIds.length === 1 && !node.locked ? (
              <>
                <div
                  className="pointer-events-none absolute left-1/2 z-40 h-4 w-px -translate-x-1/2 bg-[#ffd58a]/70"
                  style={{ top: "-22px" }}
                />
                <div
                  className="absolute left-1/2 z-40 grid h-4 w-4 -translate-x-1/2 cursor-grab place-items-center rounded-full border border-[rgba(45,25,15,0.6)] bg-[#ffd58a] text-[#2d190f]"
                  style={{ top: "-34px" }}
                  title="Rotate"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onRotatePointerDown(node.id, event);
                  }}
                >
                  <RotateCw className="h-2.5 w-2.5" />
                </div>
                {(
                  [
                    ["nw", "-top-[5px] -left-[5px] cursor-nwse-resize"],
                    ["ne", "-top-[5px] -right-[5px] cursor-nesw-resize"],
                    ["sw", "-bottom-[5px] -left-[5px] cursor-nesw-resize"],
                    ["se", "-right-[5px] -bottom-[5px] cursor-nwse-resize"],
                  ] as const
                ).map(([handle, className]) => (
                  <div
                    key={handle}
                    className={`absolute z-40 h-2.5 w-2.5 rounded-[2px] border border-[rgba(45,25,15,0.6)] bg-[#ffd58a] ${className}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onResizePointerDown(node.id, handle, event);
                    }}
                  />
                ))}
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
