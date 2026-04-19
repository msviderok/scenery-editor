import { For, Show, createMemo, createSignal } from "solid-js";
import sampleProject from "./scene.sprite.json";
import type { BackgroundStyle, ResolvedSpriteAsset, SpriteCollision, SpriteNode, SpriteScene } from "../../../shared/ast";

function hasAnyCollision(c: SpriteCollision) {
  return c.top || c.right || c.bottom || c.left;
}

function createBackgroundStyle(style: BackgroundStyle) {
  return {
    "background-color": style.backgroundColor ?? "transparent",
    "background-image": style.backgroundImage,
    "background-size": style.backgroundSize,
    "background-repeat": style.backgroundRepeat,
    "background-position": style.backgroundPosition,
  };
}

function createNodeStyle(node: SpriteNode, asset: ResolvedSpriteAsset | undefined) {
  const backgroundImage = node.style.backgroundImage ?? (asset ? `url("${asset.resolvedUrl}")` : undefined);

  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`,
    opacity: String(node.opacity),
    transform: `rotate(${node.rotation}deg)`,
    "background-color": node.style.backgroundColor ?? "transparent",
    "background-image": backgroundImage,
    "background-size": node.style.backgroundSize ?? "100% 100%",
    "background-repeat": node.style.backgroundRepeat ?? "no-repeat",
    "background-position": node.style.backgroundPosition ?? "center",
  };
}

export default function App() {
  const [selectedSceneId, setSelectedSceneId] = createSignal(sampleProject.scenes[0]?.id ?? "");

  const selectedScene = createMemo<SpriteScene>(() => {
    return sampleProject.scenes.find((scene) => scene.id === selectedSceneId()) ?? sampleProject.scenes[0];
  });

  const assetEntries = createMemo(() => Object.values(sampleProject.assets));

  return (
    <main class="page">
      <section class="hero">
        <p class="eyebrow">Vite Plugin Playground</p>
        <h1>Load exported AST files through the plugin and inspect resolved assets.</h1>
        <p>
          This app imports <code>src/scene.sprite.json</code> using{" "}
          <code>@msviderok/sprite-editor-vite</code>. Replace that file with your own exported AST to
          test the plugin against a real scene.
        </p>
        <div class="meta">
          <span>{sampleProject.scenes.length} scene(s)</span>
          <span>{assetEntries().length} asset(s)</span>
          <span>
            Source file: <code>apps/plugin-playground/src/scene.sprite.json</code>
          </span>
        </div>
      </section>

      <section class="layout">
        <div class="panel">
          <h2>Scene Preview</h2>
          <div class="scene-tabs">
            <For each={sampleProject.scenes}>
              {(scene) => (
                <button
                  class="scene-tab"
                  classList={{ active: scene.id === selectedSceneId() }}
                  onClick={() => setSelectedSceneId(scene.id)}
                >
                  {scene.name}
                </button>
              )}
            </For>
          </div>

          <Show when={selectedScene()}>
            {(scene) => (
              <div class="viewport-shell">
                <div
                  class="scene-frame"
                  style={{
                    width: `${scene().size.width}px`,
                    height: `${scene().size.height}px`,
                    ...createBackgroundStyle(scene().backgroundStyle),
                  }}
                >
                  <For each={scene().nodes}>
                    {(node) => {
                      const asset = createMemo(() => sampleProject.assets[node.assetId]);

                      return (
                        <div
                          class="node"
                          classList={{ locked: node.locked }}
                          style={createNodeStyle(node, asset())}
                          title={`${node.id} -> ${asset()?.fileName ?? node.assetId}`}
                        >
                          <Show when={hasAnyCollision(node.collisions)}>
                            <div class="collision top" classList={{ active: node.collisions.top }} />
                            <div class="collision right" classList={{ active: node.collisions.right }} />
                            <div class="collision bottom" classList={{ active: node.collisions.bottom }} />
                            <div class="collision left" classList={{ active: node.collisions.left }} />
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>
              </div>
            )}
          </Show>
        </div>

        <aside class="panel sidebar">
          <h3>Resolved Assets</h3>
          <div class="asset-list">
            <For each={assetEntries()}>
              {(asset) => (
                <article class="asset-card">
                  <div class="asset-preview">
                    <img src={asset.resolvedUrl} alt={asset.fileName} />
                  </div>
                  <div class="asset-meta">
                    <strong>{asset.fileName}</strong>
                    <span>
                      {asset.width} × {asset.height}
                    </span>
                    <span>
                      URL: <code>{asset.resolvedUrl}</code>
                    </span>
                    <Show when={asset.dataUrl}>
                      <span>Source: embedded data URL</span>
                    </Show>
                    <Show when={asset.sourcePath}>
                      <span>
                        Source path: <code>{asset.sourcePath}</code>
                      </span>
                    </Show>
                  </div>
                </article>
              )}
            </For>
          </div>
        </aside>
      </section>
    </main>
  );
}
