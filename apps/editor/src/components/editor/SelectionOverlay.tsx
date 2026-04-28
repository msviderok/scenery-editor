import { Lock } from "lucide-react";
import type { SpriteAsset, SpriteScene } from "@msviderok/sprite-editor-ast-schema";
import type { MarqueeRect, ResizeHandle } from "@/editor/types";

type SelectionOverlayProps = {
  scene: SpriteScene;
  assets: Record<string, SpriteAsset>;
  selectedNodeIds: string[];
  selectedNodeSet: Set<string>;
  marqueeRect: MarqueeRect | null;
  onNodePointerDown: (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (
    nodeId: string,
    handle: ResizeHandle,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
};

const handlePositions: Array<{
  handle: ResizeHandle;
  className: string;
}> = [
  { handle: "nw", className: "-left-[4px] -top-[4px] cursor-nwse-resize" },
  { handle: "n", className: "left-1/2 -top-[4px] -translate-x-1/2 cursor-ns-resize" },
  { handle: "ne", className: "-right-[4px] -top-[4px] cursor-nesw-resize" },
  { handle: "e", className: "right-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize" },
  { handle: "se", className: "-right-[4px] -bottom-[4px] cursor-nwse-resize" },
  { handle: "s", className: "bottom-[-4px] left-1/2 -translate-x-1/2 cursor-ns-resize" },
  { handle: "sw", className: "-left-[4px] -bottom-[4px] cursor-nesw-resize" },
  { handle: "w", className: "left-[-4px] top-1/2 -translate-y-1/2 cursor-ew-resize" },
];

export function SelectionOverlay(props: SelectionOverlayProps) {
  const {
    scene,
    assets,
    selectedNodeIds,
    selectedNodeSet,
    marqueeRect,
    onNodePointerDown,
    onResizePointerDown,
  } = props;

  return (
    <div className="absolute left-0 top-0 z-20 h-full w-full pointer-events-none">
      {marqueeRect ? (
        <div
          className="absolute border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
          style={{
            left: `${marqueeRect.x}px`,
            top: `${marqueeRect.y}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
          }}
        />
      ) : null}

      {scene.nodes.map((node) => {
        const selected = selectedNodeSet.has(node.id);
        const singleSelected = selected && selectedNodeIds.length === 1;
        const asset = assets[node.assetId];

        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: `${node.x}px`,
              top: `${node.y}px`,
              width: `${node.width}px`,
              height: `${node.height}px`,
              transform: `rotate(${node.rotation}deg)`,
              transformOrigin: "center center",
              pointerEvents: "auto",
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onNodePointerDown(node.id, event);
            }}
          >
            <div
              className={`absolute inset-0 ${
                singleSelected
                  ? "outline outline-2 outline-[var(--accent)]"
                  : selected
                    ? "outline outline-2 outline-dashed outline-[var(--accent)]"
                    : ""
              }`}
              style={{ outlineOffset: "1px" }}
            />

            {selected ? (
              <div className="absolute -top-8 left-0 max-w-[min(260px,calc(100%+120px))] overflow-hidden text-ellipsis whitespace-nowrap border border-black/80 bg-[var(--accent)] px-2 py-[3px] font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.12em] text-black shadow-[2px_2px_0_#000]">
                {asset?.fileName ?? node.assetId}
              </div>
            ) : null}

            {node.locked ? (
              <div className="absolute right-1 top-1 grid h-4 w-4 place-items-center border border-black/70 bg-black/65 text-white/90">
                <Lock className="h-2.5 w-2.5" />
              </div>
            ) : null}

            {singleSelected && !node.locked
              ? handlePositions.map(({ handle, className }) => (
                  <div
                    key={handle}
                    className={`absolute h-2 w-2 border border-black/80 bg-[var(--accent)] ${className}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onResizePointerDown(node.id, handle, event);
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
