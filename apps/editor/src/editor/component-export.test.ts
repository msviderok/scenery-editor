import { describe, expect, it, vi } from "vite-plus/test";
import { createDefaultScene, createEmptyProject } from "@msviderok/sprite-editor-ast-schema";
import { buildComponentExportFiles } from "./component-export";

describe("component export", () => {
  it("exports Solid TSX by default with Tailwind classes and inline authored geometry", async () => {
    const project = createProjectWithNode();

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(file.fileName).toBe("sprite-scenes.tsx");
    expect(file.content).toContain('class="relative shrink-0 overflow-hidden');
    expect(file.content).not.toContain("className=");
    expect(file.content).toContain('"background-color": "#223344"');
    expect(file.content).toContain('left: "12px"');
    expect(file.content).toContain('transform: "rotate(30deg)"');
    expect(file.content).toContain('transform: "scale(-1, 1)"');
    expect(file.content).toContain("absolute inset-0 origin-center [image-rendering:pixelated]");
  });

  it("exports React TSX with className", async () => {
    const project = createProjectWithNode();

    const [file] = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "single-file",
    });

    expect(file.content).toContain('className="relative shrink-0 overflow-hidden');
    expect(file.content).toContain('backgroundColor: "#223344"');
    expect(file.content).not.toContain('"background-color"');
  });

  it("exports multiple scenes and a registry in a single file", async () => {
    const project = createProjectWithNode();
    project.scenes.push(createDefaultScene("scene_2", "Boss Room"));

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(file.content).toContain("export function Scene1()");
    expect(file.content).toContain("export function BossRoom()");
    expect(file.content).toContain("export const scenes = [");
    expect(file.content).toContain('{ id: "scene_2", name: "Boss Room", Component: BossRoom }');
  });

  it("exports separate scene files and an index barrel", async () => {
    const project = createProjectWithNode();
    project.scenes[0].name = "Level";
    project.scenes.push(createDefaultScene("scene_2", "Level"));

    const files = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "separate-files",
    });

    expect(files.map((file) => file.fileName)).toEqual(["level.tsx", "level2.tsx", "index.ts"]);
    expect(files[0].content).toContain("export function Level()");
    expect(files[1].content).toContain("export function Level2()");
    expect(files[2].content).toContain('import { Level } from "./level";');
    expect(files[2].content).toContain('import { Level2 } from "./level2";');
    expect(files[2].content).toContain("export { Level, Level2 };");
    expect(files[2].content).toContain("Component: Level2");
  });

  it("embeds remote assets before generating TSX", async () => {
    const project = createProjectWithNode();
    project.assets.asset_1 = {
      ...project.assets.asset_1,
      dataUrl: undefined,
      url: "/sprite.png",
    };

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(new Blob(["sprite"], { type: "image/png" }), { status: 200 });
    });

    const [file] = await buildComponentExportFiles(
      project,
      { framework: "react", layout: "single-file" },
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledWith("/sprite.png");
    expect(file.content).toContain("data:image/png;base64,");
    expect(file.content).not.toContain("/sprite.png");
  });

  it("preserves style overrides, tint, collisions, missing asset fallback, and safe names", async () => {
    const project = createProjectWithNode();
    project.scenes[0].name = "123 !!!";
    project.scenes[0].nodes[0].assetId = "missing_asset";
    project.scenes[0].nodes[0].tint = "#ff0000";
    project.scenes[0].nodes[0].collisions.left = true;
    project.scenes[0].nodes[0].style = {
      backgroundColor: "#112233",
      backgroundRepeat: "repeat-x",
      backgroundSize: "8px 8px",
      backgroundPosition: "top left",
    };

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(file.content).toContain("export function Scene1()");
    expect(file.content).toContain('"background-color": "#112233"');
    expect(file.content).toContain('"background-repeat": "repeat-x"');
    expect(file.content).toContain('"background-size": "8px 8px"');
    expect(file.content).toContain("missing_asset");
    expect(file.content).toContain("absolute inset-0 opacity-45 mix-blend-multiply");
    expect(file.content).toContain("border border-emerald-400/80");
  });
});

function createProjectWithNode() {
  const project = createEmptyProject();
  project.scenes[0].backgroundStyle = {
    backgroundColor: "#223344",
    backgroundSize: "cover",
  };
  project.assets.asset_1 = {
    id: "asset_1",
    kind: "image",
    fileName: "sprite.png",
    width: 16,
    height: 24,
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,abc",
  };
  project.scenes[0].nodes.push({
    id: "node_1",
    assetId: "asset_1",
    x: 12,
    y: 20,
    width: 32,
    height: 48,
    rotation: 30,
    opacity: 0.75,
    locked: false,
    flipH: true,
    flipV: false,
    tint: null,
    collisions: { top: false, right: false, bottom: false, left: false },
    style: {
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
    },
  });

  return project;
}
