import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { parseSpriteProject, type SpriteProject } from "@msviderok/sprite-editor-ast-schema";
import {
  createNodeBackgroundStyle,
  createSceneBackgroundStyle,
  fitSceneToViewport,
  getAssetUrl,
} from "./preview";

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
  const stageRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<SpriteProject | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const viewport = useViewportSize(stageRef);

  const selectedScene = project
    ? (project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0] ?? null)
    : null;

  const selectedSceneIndex =
    project && selectedScene
      ? project.scenes.findIndex((scene) => scene.id === selectedScene.id)
      : -1;

  const scale = selectedScene ? fitSceneToViewport(selectedScene, viewport) : 1;

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

      <header className="topbar">
        <div>
          <p className="eyebrow">Sprite Editor Playground</p>
          <h1>Fullscreen AST Preview</h1>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            {project ? "Replace AST" : "Import AST"}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              void handleToggleFullscreen();
            }}
            disabled={!project}
          >
            {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          </button>
        </div>
      </header>

      {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}

      {project && selectedScene ? (
        <>
          <nav className="scene-strip" aria-label="Scenes">
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
          </nav>

          <main ref={stageRef} className="stage">
            <div className="scene-metadata">
              <span>
                {selectedScene.size.width} x {selectedScene.size.height}
              </span>
              <span>{selectedScene.nodes.length} nodes</span>
              <span>Arrow keys switch scenes</span>
            </div>

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
          </main>
        </>
      ) : (
        <main className="empty-state">
          <div className="empty-card">
            <p className="eyebrow">Ready</p>
            <h2>Import an exported sprite AST to preview it edge-to-edge.</h2>
            <p>
              The playground parses the shared schema directly, scales the active scene to the
              viewport, and preserves node tint, flips, repeat settings, and scene backgrounds.
            </p>
            <button
              type="button"
              className="primary-button"
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
