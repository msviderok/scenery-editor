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
    expect(file.content).toContain('import { type ParentProps } from "solid-js";');
    expect(file.content).toContain('class="relative shrink-0 overflow-hidden');
    expect(file.content).not.toContain("className=");
    expect(file.content).toContain("export function Scene1(props: ParentProps<{}>)");
    expect(file.content).toContain('      <div class="absolute inset-0">');
    expect(file.content).toContain("      {props.children}");
    expect(file.content).toContain('"background-color": "#223344"');
    expect(file.content).toContain('left: "12px"');
    expect(file.content).toContain('transform: "rotate(30deg)"');
    expect(file.content).toContain(
      "transform: `scale(${props.flipH ? -1 : 1}, ${props.flipV ? -1 : 1})`",
    );
    expect(file.content).toContain("<Scene1SpritePngAsset flipH />");
    expect(file.content).toContain("absolute inset-0 origin-center [image-rendering:pixelated]");
  });

  it("exports React TSX with className", async () => {
    const project = createProjectWithNode();

    const [file] = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "single-file",
    });

    expect(file.content).toContain('import { type PropsWithChildren } from "react";');
    expect(file.content).toContain('className="relative shrink-0 overflow-hidden');
    expect(file.content).toContain("export function Scene1({ children }: PropsWithChildren<{}>)");
    expect(file.content).toContain('      <div className="absolute inset-0">');
    expect(file.content).toContain("      {children}");
    expect(file.content).toContain('backgroundColor: "#223344"');
    expect(file.content).not.toContain('"background-color"');
  });

  it("exports multiple scenes as named functions in a single file", async () => {
    const project = createProjectWithNode();
    project.scenes.push(createDefaultScene("scene_2", "Boss Room"));

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(file.content).toContain("export function Scene1(props: ParentProps<{}>)");
    expect(file.content).toContain("export function BossRoom(props: ParentProps<{}>)");
    expect(file.content).not.toContain("export const scenes");
    expect(file.content).not.toContain("Component: BossRoom");
  });

  it("exports separate scene files without an index barrel", async () => {
    const project = createProjectWithNode();
    project.scenes[0].name = "Level";
    project.scenes.push(createDefaultScene("scene_2", "Level"));

    const files = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "separate-files",
    });

    expect(files.map((file) => file.fileName)).toEqual(["level.tsx", "level2.tsx"]);
    expect(files[0].content).toContain('import { type PropsWithChildren } from "react";');
    expect(files[0].content).toContain(
      "export function Level({ children }: PropsWithChildren<{}>)",
    );
    expect(files[1].content).toContain(
      "export function Level2({ children }: PropsWithChildren<{}>)",
    );
  });

  it("preserves remote asset URLs when generating TSX", async () => {
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

    expect(fetchMock).not.toHaveBeenCalled();
    expect(file.content).toContain("/sprite.png");
    expect(file.content).not.toContain("data:image/png;base64,");
    expect(file.content).not.toContain("backgroundImage?: string");
    expect(file.content).not.toContain("props.backgroundImage");
  });

  it("uses asset-safe component names for uploaded filenames that start with digits", async () => {
    const project = createProjectWithNode();
    project.assets.asset_1 = {
      ...project.assets.asset_1,
      fileName: "4096-map.png",
      url: "https://utfs.io/f/file-key",
      dataUrl: undefined,
    };

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(file.content).toContain("function Scene1Asset4096MapPngAsset(");
    expect(file.content).toContain("<Scene1Asset4096MapPngAsset");
    expect(file.content).not.toContain("function Scene1MissingAsset(");
    expect(file.content).not.toContain("function Scene1MissingAssetAsset(");
  });

  it("dedupes duplicate asset nodes into one internal component", async () => {
    const project = createProjectWithNode();
    project.scenes[0].nodes.push({
      ...project.scenes[0].nodes[0],
      id: "node_2",
      x: 44,
      y: 52,
      width: 64,
      height: 96,
      rotation: 15,
      opacity: 0.5,
      flipH: false,
    });

    const [file] = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "single-file",
    });

    expect(countOccurrences(file.content, "function Scene1SpritePngAsset(")).toBe(1);
    expect(countOccurrences(file.content, "<Scene1SpritePngAsset")).toBe(2);
    expect(file.content).toContain('left: "12px"');
    expect(file.content).toContain('left: "44px"');
    expect(file.content).toContain('width: "64px"');
    expect(file.content).toContain('opacity: "0.5"');
    expect(file.content).toContain('transform: "rotate(15deg)"');
  });

  it("passes visual differences as internal component props", async () => {
    const project = createProjectWithNode();
    project.scenes[0].nodes[0] = {
      ...project.scenes[0].nodes[0],
      flipH: true,
      flipV: true,
      tint: "#ff0000",
      collisions: { top: false, right: false, bottom: false, left: true },
      style: {
        backgroundColor: "#112233",
        backgroundRepeat: "repeat-x",
        backgroundSize: "8px 8px",
        backgroundPosition: "top left",
      },
    };
    project.scenes[0].nodes.push({
      ...project.scenes[0].nodes[0],
      id: "node_2",
      x: 44,
      tint: null,
      flipH: false,
      flipV: false,
      collisions: { top: false, right: true, bottom: false, left: false },
      style: {},
    });

    const [file] = await buildComponentExportFiles(project, {
      framework: "solid",
      layout: "single-file",
    });

    expect(countOccurrences(file.content, "function Scene1SpritePngAsset(")).toBe(1);
    expect(file.content).toContain(
      '<Scene1SpritePngAsset backgroundColor="#112233" backgroundSize="8px 8px" backgroundRepeat="repeat-x" backgroundPosition="top left" flipH flipV tint="#ff0000" collisions={{ left: true }} />',
    );
    expect(file.content).toContain("<Scene1SpritePngAsset collisions={{ right: true }} />");
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

    expect(file.content).toContain("export function Scene1(props: ParentProps<{}>)");
    expect(file.content).toContain(
      '<Scene1MissingAssetAsset backgroundColor="#112233" backgroundSize="8px 8px" backgroundRepeat="repeat-x" backgroundPosition="top left" flipH tint="#ff0000" collisions={{ left: true }} />',
    );
    expect(file.content).toContain("missing_asset");
    expect(file.content).toContain("absolute inset-0 opacity-45 mix-blend-multiply");
    expect(file.content).toContain("border border-emerald-400/80");
  });

  it("dedupes missing asset nodes by missing asset id", async () => {
    const project = createProjectWithNode();
    project.scenes[0].nodes[0].assetId = "missing_asset";
    project.scenes[0].nodes.push({
      ...project.scenes[0].nodes[0],
      id: "node_2",
      x: 44,
    });

    const [file] = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "single-file",
    });

    expect(countOccurrences(file.content, "function Scene1MissingAssetAsset(")).toBe(1);
    expect(countOccurrences(file.content, "<Scene1MissingAssetAsset")).toBe(2);
    expect(file.content).toContain("missing_asset");
  });

  it("keeps asset component dedupe scoped per scene", async () => {
    const project = createProjectWithNode();
    project.scenes.push(createDefaultScene("scene_2", "Boss Room"));
    project.scenes[1].nodes.push({
      ...project.scenes[0].nodes[0],
      id: "node_2",
      x: 4,
      y: 8,
    });

    const [file] = await buildComponentExportFiles(project, {
      framework: "react",
      layout: "single-file",
    });

    expect(file.content).toContain("function Scene1SpritePngAsset(");
    expect(file.content).toContain("function BossRoomSpritePngAsset(");
    expect(file.content).toContain("<Scene1SpritePngAsset");
    expect(file.content).toContain("<BossRoomSpritePngAsset");
  });
});

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

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
