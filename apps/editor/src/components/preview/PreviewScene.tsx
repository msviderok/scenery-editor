import { useLayoutEffect, useRef } from "react";
import type { SpriteProject, SpriteScene } from "@msviderok/sprite-editor-ast-schema";
import {
  createNodeBackgroundStyle,
  createSceneBackgroundStyle,
  getAssetUrl,
} from "@/editor/preview-style";

type PreviewSceneProps = {
  project: SpriteProject;
  scene: SpriteScene;
};

export function PreviewScene({ project, scene }: PreviewSceneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [scene.id]);

  return (
    <div ref={scrollRef} className="absolute inset-0 overflow-auto">
      <div className="flex h-max min-h-full w-max min-w-full [align-items:safe_center] [justify-content:safe_center]">
        <div
          className="relative shrink-0 overflow-hidden [image-rendering:pixelated]"
          style={{
            width: `${scene.size.width}px`,
            height: `${scene.size.height}px`,
            ...createSceneBackgroundStyle(scene.backgroundStyle),
          }}
        >
          {scene.nodes.map((node) => {
            const asset = project.assets[node.assetId];
            const assetUrl = getAssetUrl(asset);
            const hasCollision =
              node.collisions.top ||
              node.collisions.right ||
              node.collisions.bottom ||
              node.collisions.left;
            return (
              <div
                key={node.id}
                className="absolute origin-center"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                  opacity: String(node.opacity),
                  transform: `rotate(${node.rotation}deg)`,
                }}
              >
                <div
                  className="absolute inset-0 origin-center [image-rendering:pixelated]"
                  style={{
                    ...createNodeBackgroundStyle(asset, node.style),
                    transform: `scale(${node.flipH ? -1 : 1}, ${node.flipV ? -1 : 1})`,
                  }}
                />
                {!assetUrl ? (
                  <div className="absolute inset-0 grid place-items-center bg-orange-300/80 p-2 text-[10px] font-semibold uppercase tracking-wider text-orange-950">
                    {asset?.fileName ?? node.assetId}
                  </div>
                ) : null}
                {node.tint ? (
                  <div
                    className="absolute inset-0 opacity-45 mix-blend-multiply"
                    style={{ background: node.tint }}
                  />
                ) : null}
                {hasCollision ? (
                  <div className="absolute inset-0 border border-emerald-400/80 shadow-[0_0_8px_rgba(104,224,154,0.5)]" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
