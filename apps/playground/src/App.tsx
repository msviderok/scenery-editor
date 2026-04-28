import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { parseSpriteProject, type SpriteProject } from "@msviderok/sprite-editor-ast-schema";
import { createNodeBackgroundStyle, createSceneBackgroundStyle, getAssetUrl } from "./preview";

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<SpriteProject | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scene = project?.scenes[0] ?? null;

  const reset = () => {
    setProject(null);
    setErrorMessage(null);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [scene]);

  const importProject = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const next = parseSpriteProject(JSON.parse(text));
      setProject(next);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to parse AST.");
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await importProject(file);
    event.target.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />

      {project && scene ? (
        <main className="player">
          <div ref={scrollRef} className="scene-scroll">
            <div
              className="scene-canvas"
              style={{
                width: `${scene.size.width}px`,
                height: `${scene.size.height}px`,
                ...createSceneBackgroundStyle(scene.backgroundStyle),
              }}
            >
              {scene.nodes.map((node) => {
                const asset = project.assets[node.assetId];
                const assetUrl = getAssetUrl(asset);
                return (
                  <div
                    key={node.id}
                    className="scene-node"
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
                      className="scene-node-image"
                      style={{
                        ...createNodeBackgroundStyle(asset, node.style),
                        transform: `scale(${node.flipH ? -1 : 1}, ${node.flipV ? -1 : 1})`,
                      }}
                    />
                    {!assetUrl ? (
                      <div className="scene-node-fallback">{asset?.fileName ?? node.assetId}</div>
                    ) : null}
                    {node.tint ? (
                      <div className="scene-node-tint" style={{ background: node.tint }} />
                    ) : null}
                    {node.collisions.top ||
                    node.collisions.right ||
                    node.collisions.bottom ||
                    node.collisions.left ? (
                      <div className="scene-node-collision" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="floating-controls">
            <button type="button" className="ctrl" onClick={reset}>
              Reset
            </button>
            <button type="button" className="ctrl" onClick={openPicker}>
              Change file
            </button>
          </div>

          {errorMessage ? <div className="error-toast">{errorMessage}</div> : null}
        </main>
      ) : (
        <main className="empty">
          <button type="button" className="cta" onClick={openPicker}>
            Select scene file
          </button>
          {errorMessage ? <div className="error-toast">{errorMessage}</div> : null}
        </main>
      )}
    </div>
  );
}
