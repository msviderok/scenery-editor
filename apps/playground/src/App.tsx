import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { parseSpriteProject, type SpriteProject } from "@msviderok/sprite-editor-ast-schema";
import { createNodeBackgroundStyle, createSceneBackgroundStyle, getAssetUrl } from "./preview";

type ViewportSize = {
  width: number;
  height: number;
};

function useViewportSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<ViewportSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<SpriteProject | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewport = useViewportSize(viewportRef);

  const selectedScene = project
    ? (project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0] ?? null)
    : null;

  const selectedSceneIndex =
    project && selectedScene
      ? project.scenes.findIndex((scene) => scene.id === selectedScene.id)
      : -1;

  // const scale = selectedScene ? fitSceneToViewport(selectedScene, viewport, 0) : 1;
  const scale = 1;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!project) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!project.scenes.length) return;

      const currentIndex = Math.max(0, selectedSceneIndex);
      const nextIndex =
        event.key === "ArrowRight"
          ? (currentIndex + 1) % project.scenes.length
          : (currentIndex - 1 + project.scenes.length) % project.scenes.length;
      setSelectedSceneId(project.scenes[nextIndex].id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [project, selectedSceneIndex]);

  const importProject = async (file: File | undefined) => {
    if (!file) return;

    try {
      const text = await file.text();
      const nextProject = parseSpriteProject(JSON.parse(text));
      setProject(nextProject);
      setSelectedSceneId(nextProject.scenes[0]?.id ?? null);
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

  const handleToggleFullscreen = async () => {
    if (!shellRef.current) return;

    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
      return;
    }

    await shellRef.current.requestFullscreen();
  };

  return (
    <div ref={shellRef} className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(event) => {
          void handleFileChange(event);
        }}
      />

      {project && selectedScene ? (
        <main
          ref={viewportRef}
          className="player-shell"
          style={createSceneBackgroundStyle(selectedScene.backgroundStyle)}
        >
          <div className="player-backdrop" />
          <div className="player-overlay player-overlay-top">
            <div className="info-cluster">
              <p className="eyebrow">Sprite Editor Playground</p>
              <h1 className="scene-title">{selectedScene.name}</h1>
              <div className="scene-metadata">
                <span>
                  {selectedScene.size.width} x {selectedScene.size.height}
                </span>
                <span>{selectedScene.nodes.length} nodes</span>
                <span>{project.scenes.length} scenes</span>
              </div>
            </div>

            <div className="toolbar">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                Replace AST
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void handleToggleFullscreen();
                }}
              >
                {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="player-overlay player-overlay-error">
              <div className="error-banner">{errorMessage}</div>
            </div>
          ) : null}

          <div
            className="scene-frame"
            style={{
              width: `${selectedScene.size.width * scale}px`,
              height: `${selectedScene.size.height * scale}px`,
            }}
          >
            <div
              className="scene-canvas"
              style={{
                width: `${selectedScene.size.width}px`,
                height: `${selectedScene.size.height}px`,
                transform: `scale(${scale})`,
                ...createSceneBackgroundStyle(selectedScene.backgroundStyle),
              }}
            >
              {selectedScene.nodes.map((node) => {
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
                      <div
                        className="scene-node-tint"
                        style={{
                          background: node.tint,
                        }}
                      />
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

          {project.scenes.length > 1 ? (
            <nav className="player-overlay player-overlay-bottom" aria-label="Scenes">
              <div className="scene-strip">
                {project.scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    className={scene.id === selectedScene.id ? "scene-pill active" : "scene-pill"}
                    onClick={() => setSelectedSceneId(scene.id)}
                  >
                    <span>{scene.name}</span>
                    <small>
                      {index + 1}/{project.scenes.length}
                    </small>
                  </button>
                ))}
              </div>
            </nav>
          ) : null}
        </main>
      ) : (
        <main ref={viewportRef} className="empty-state">
          <div className="player-overlay player-overlay-top">
            <div className="info-cluster">
              <p className="eyebrow">Sprite Editor Playground</p>
              <h1 className="scene-title">Scene-first AST preview</h1>
            </div>

            <div className="toolbar">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                Import AST
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div className="player-overlay player-overlay-error">
              <div className="error-banner">{errorMessage}</div>
            </div>
          ) : null}

          <div className="empty-card">
            <p className="eyebrow">Ready</p>
            <h2>Import a sprite AST and the scene becomes the app.</h2>
            <p>
              The active scene renders at its native aspect ratio, scales to the full viewport, and
              keeps the controls as overlays instead of layout chrome.
            </p>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              Choose JSON file
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
