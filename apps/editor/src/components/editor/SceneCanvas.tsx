import type { SpriteAsset, SpriteScene } from "@msviderok/sprite-editor-ast";
import { createNodeBackground, createSceneBackground, getAssetUrl } from "@/editor/assets";
import type { DragGhost } from "@/editor/types";

type SceneCanvasProps = {
  scene: SpriteScene;
  assets: Record<string, SpriteAsset>;
  gridVisible: boolean;
  gridSize: number;
  dragGhost: DragGhost | null;
  dropTargetActive: boolean;
};

export function SceneCanvas(props: SceneCanvasProps) {
  const { scene, assets, gridVisible, gridSize, dragGhost, dropTargetActive } = props;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{
        width: `${scene.size.width}px`,
        height: `${scene.size.height}px`,
      }}
    >
      <div
        className="absolute inset-0 overflow-hidden border bg-[#111220] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_28px_48px_rgba(0,0,0,0.38)]"
        style={{
          ...createSceneBackground(scene.backgroundStyle),
          borderColor: dropTargetActive
            ? "color-mix(in srgb, var(--accent) 80%, transparent)"
            : "rgba(255,255,255,0.2)",
          boxShadow: dropTargetActive
            ? "0 0 0 1px rgba(255,255,255,0.04), 0 0 0 2px color-mix(in srgb, var(--accent) 38%, transparent), 0 28px 48px rgba(0,0,0,0.38)"
            : "0 0 0 1px rgba(255,255,255,0.04), 0 28px 48px rgba(0,0,0,0.38)",
        }}
      >
        {gridVisible ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.06) 0 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 0 1px, transparent 1px)",
              backgroundSize: `${gridSize}px ${gridSize}px`,
            }}
          />
        ) : null}

        {scene.nodes.map((node) => {
          const asset = assets[node.assetId];
          const assetUrl = getAssetUrl(asset);

          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                opacity: String(node.opacity),
                transform: `rotate(${node.rotation}deg)`,
                transformOrigin: "center center",
              }}
            >
              <div
                className="absolute inset-0 [image-rendering:pixelated]"
                style={{
                  ...createNodeBackground(asset, node.style),
                  transform: `scale(${node.flipH ? -1 : 1}, ${node.flipV ? -1 : 1})`,
                  transformOrigin: "center center",
                }}
              />

              {!assetUrl ? (
                <div className="absolute inset-0 grid place-items-center bg-[#a27a3e] p-2 text-center font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.12em] text-black/65">
                  {asset?.fileName ?? node.assetId}
                </div>
              ) : null}

              {node.tint ? (
                <div
                  className="absolute inset-0"
                  style={{
                    background: node.tint,
                    opacity: 0.45,
                    mixBlendMode: "multiply",
                  }}
                />
              ) : null}

              {node.collisions.top ||
              node.collisions.right ||
              node.collisions.bottom ||
              node.collisions.left ? (
                <div className="absolute inset-0 border border-[#68e09a] shadow-[inset_0_0_0_1px_rgba(104,224,154,0.75)]" />
              ) : null}
            </div>
          );
        })}
      </div>

      {dragGhost ? (
        <div
          className="absolute z-30 border border-dashed border-[var(--accent)]/70 opacity-55 [image-rendering:pixelated]"
          style={{
            left: `${dragGhost.x}px`,
            top: `${dragGhost.y}px`,
            width: `${dragGhost.width}px`,
            height: `${dragGhost.height}px`,
            backgroundImage: `url("${dragGhost.imageUrl}")`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
      ) : null}
    </div>
  );
}
