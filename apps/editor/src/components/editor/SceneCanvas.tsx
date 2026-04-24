import type { SpriteAsset, SpriteScene } from "../../../../../shared/ast";
import { createNodeBackground, createSceneBackground, getAssetUrl } from "@/editor/assets";
import { WORKSPACE_PADDING } from "@/editor/constants";
import type { DragGhost } from "@/editor/types";

type SceneCanvasProps = {
  scene: SpriteScene;
  assets: Record<string, SpriteAsset>;
  viewportScale: number;
  gridVisible: boolean;
  gridSize: number;
  dragGhost: DragGhost | null;
};

export function SceneCanvas(props: SceneCanvasProps) {
  const { scene, assets, viewportScale, gridVisible, gridSize, dragGhost } = props;

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{
        width: `${scene.size.width + WORKSPACE_PADDING * 2}px`,
        height: `${scene.size.height + WORKSPACE_PADDING * 2}px`,
        transform: `scale(${viewportScale})`,
      }}
    >
      <div
        className="absolute overflow-hidden border border-white/8"
        style={{
          left: `${WORKSPACE_PADDING}px`,
          top: `${WORKSPACE_PADDING}px`,
          width: `${scene.size.width}px`,
          height: `${scene.size.height}px`,
          ...createSceneBackground(scene.backgroundStyle),
        }}
      >
        {gridVisible ? (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px)",
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          />
        ) : null}
      </div>

      {dragGhost ? (
        <div
          className="pointer-events-none absolute z-30 border border-dashed border-blue-400/60 opacity-45 [image-rendering:pixelated]"
          style={{
            left: `${WORKSPACE_PADDING + dragGhost.x}px`,
            top: `${WORKSPACE_PADDING + dragGhost.y}px`,
            width: `${dragGhost.width}px`,
            height: `${dragGhost.height}px`,
            backgroundImage: `url("${dragGhost.imageUrl}")`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
      ) : null}

      {scene.nodes.map((node) => {
        const asset = assets[node.assetId];
        return (
          <div
            key={node.id}
            className={`absolute bg-transparent bg-center bg-no-repeat bg-[length:100%_100%] [image-rendering:pixelated] ${
              node.locked ? "saturate-[0.9]" : ""
            }`}
            style={{
              left: `${WORKSPACE_PADDING + node.x}px`,
              top: `${WORKSPACE_PADDING + node.y}px`,
              width: `${node.width}px`,
              height: `${node.height}px`,
              opacity: String(node.opacity),
              transform: `rotate(${node.rotation}deg)`,
              ...createNodeBackground(asset, node.style),
            }}
          >
            {!getAssetUrl(asset) ? (
              <div className="absolute inset-0 grid place-items-center bg-black/40 p-2 text-center text-[10px] text-white/40">
                {asset?.fileName ?? node.assetId}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
