import type {
  BackgroundStyle,
  SpriteAsset,
  SpriteNode,
  SpriteProject,
  SpriteScene,
} from "@msviderok/sprite-editor-ast-schema";
import { getAssetUrl } from "./assets";

export type ComponentExportFramework = "solid" | "react";
export type ComponentExportLayout = "single-file" | "separate-files";

export type ComponentExportOptions = {
  framework: ComponentExportFramework;
  layout: ComponentExportLayout;
  projectName?: string;
};

export type ComponentExportFile = {
  fileName: string;
  content: string;
  mimeType: "text/typescript-jsx";
};

type SceneExportTarget = {
  scene: SpriteScene;
  componentName: string;
  fileName: string;
};

type StyleValue = string | number;
type StyleEntries = Array<[string, StyleValue | undefined]>;

const SCENE_CLASS = "relative shrink-0 overflow-hidden [image-rendering:pixelated]";
const NODE_CLASS = "absolute origin-center";
const NODE_IMAGE_CLASS = "absolute inset-0 origin-center [image-rendering:pixelated]";
const TINT_CLASS = "absolute inset-0 opacity-45 mix-blend-multiply";
const COLLISION_CLASS =
  "absolute inset-0 border border-emerald-400/80 shadow-[0_0_8px_rgba(104,224,154,0.5)]";
const MISSING_ASSET_CLASS =
  "absolute inset-0 grid place-items-center bg-orange-300/80 p-2 text-[10px] font-semibold uppercase tracking-wider text-orange-950";

export async function buildComponentExportFiles(
  project: SpriteProject,
  options: ComponentExportOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<ComponentExportFile[]> {
  void fetchImpl;
  const targets = createSceneExportTargets(project.scenes);

  if (options.layout === "separate-files") {
    return [
      ...targets.map((target) => ({
        fileName: target.fileName,
        content: renderSceneFile(project, target, options.framework),
        mimeType: "text/typescript-jsx" as const,
      })),
      {
        fileName: "index.ts",
        content: renderIndexFile(targets),
        mimeType: "text/typescript-jsx",
      },
    ];
  }

  return [
    {
      fileName: createSingleFileName(options.projectName),
      content: renderSingleFile(project, targets, options.framework),
      mimeType: "text/typescript-jsx",
    },
  ];
}

function renderSingleFile(
  project: SpriteProject,
  targets: SceneExportTarget[],
  framework: ComponentExportFramework,
) {
  return `${targets
    .map((target) => renderSceneComponent(project, target.scene, target.componentName, framework))
    .join("\n\n")}

${renderSceneRegistry(targets)}
`;
}

function renderSceneFile(
  project: SpriteProject,
  target: SceneExportTarget,
  framework: ComponentExportFramework,
) {
  return `${renderSceneComponent(project, target.scene, target.componentName, framework)}
`;
}

function renderIndexFile(targets: SceneExportTarget[]) {
  const imports = targets
    .map(
      (target) => `import { ${target.componentName} } from "./${stripExtension(target.fileName)}";`,
    )
    .join("\n");
  const exports = `export { ${targets.map((target) => target.componentName).join(", ")} };`;

  return `${imports}

${exports}

${renderSceneRegistry(targets)}
`;
}

function renderSceneRegistry(targets: SceneExportTarget[]) {
  const entries = targets
    .map(
      (target) =>
        `  { id: ${stringLiteral(target.scene.id)}, name: ${stringLiteral(
          target.scene.name,
        )}, Component: ${target.componentName} },`,
    )
    .join("\n");

  return `export const scenes = [
${entries}
];`;
}

function renderSceneComponent(
  project: SpriteProject,
  scene: SpriteScene,
  componentName: string,
  framework: ComponentExportFramework,
) {
  const classAttr = framework === "solid" ? "class" : "className";

  return `export function ${componentName}() {
  return (
    <div
      ${classAttr}=${stringLiteral(SCENE_CLASS)}
      style={${renderStyleObject(createSceneStyleEntries(scene.backgroundStyle, scene), framework)}}
    >
${scene.nodes.map((node) => renderNode(project, node, framework, 6)).join("\n")}
    </div>
  );
}`;
}

function renderNode(
  project: SpriteProject,
  node: SpriteNode,
  framework: ComponentExportFramework,
  indentSize: number,
) {
  const classAttr = framework === "solid" ? "class" : "className";
  const asset = project.assets[node.assetId];
  const hasCollision =
    node.collisions.top || node.collisions.right || node.collisions.bottom || node.collisions.left;
  const indent = " ".repeat(indentSize);
  const childIndent = " ".repeat(indentSize + 2);
  const lines = [
    `${indent}<div`,
    `${indent}  ${classAttr}=${stringLiteral(NODE_CLASS)}`,
    `${indent}  style={${renderStyleObject(createNodeStyleEntries(node), framework)}}`,
    `${indent}>`,
    `${childIndent}<div`,
    `${childIndent}  ${classAttr}=${stringLiteral(NODE_IMAGE_CLASS)}`,
    `${childIndent}  style={${renderStyleObject(
      [
        ...createNodeBackgroundStyleEntries(asset, node.style),
        ["transform", `scale(${node.flipH ? -1 : 1}, ${node.flipV ? -1 : 1})`],
      ],
      framework,
    )}}`,
    `${childIndent}/>`,
  ];

  if (!getAssetUrl(asset)) {
    lines.push(
      `${childIndent}<div ${classAttr}=${stringLiteral(MISSING_ASSET_CLASS)}>${stringLiteral(
        asset?.fileName ?? node.assetId,
      )}</div>`,
    );
  }

  if (node.tint) {
    lines.push(
      `${childIndent}<div ${classAttr}=${stringLiteral(TINT_CLASS)} style={${renderStyleObject(
        [["background", node.tint]],
        framework,
      )}} />`,
    );
  }

  if (hasCollision) {
    lines.push(`${childIndent}<div ${classAttr}=${stringLiteral(COLLISION_CLASS)} />`);
  }

  lines.push(`${indent}</div>`);
  return lines.join("\n");
}

function createSceneStyleEntries(style: BackgroundStyle, scene: SpriteScene): StyleEntries {
  return [
    ["width", px(scene.size.width)],
    ["height", px(scene.size.height)],
    ["backgroundColor", style.backgroundColor ?? "#151515"],
    ["backgroundImage", style.backgroundImage],
    ["backgroundSize", style.backgroundSize],
    ["backgroundRepeat", style.backgroundRepeat],
    ["backgroundPosition", style.backgroundPosition],
  ];
}

function createNodeStyleEntries(node: SpriteNode): StyleEntries {
  return [
    ["left", px(node.x)],
    ["top", px(node.y)],
    ["width", px(node.width)],
    ["height", px(node.height)],
    ["opacity", String(node.opacity)],
    ["transform", `rotate(${node.rotation}deg)`],
  ];
}

function createNodeBackgroundStyleEntries(
  asset: SpriteAsset | undefined,
  style: BackgroundStyle,
): StyleEntries {
  const repeat = style.backgroundRepeat ?? "no-repeat";
  const fallbackSize =
    repeat !== "no-repeat" && asset ? `${asset.width}px ${asset.height}px` : "100% 100%";

  return [
    ["backgroundColor", style.backgroundColor ?? "transparent"],
    [
      "backgroundImage",
      style.backgroundImage ?? (asset ? `url("${getAssetUrl(asset)}")` : undefined),
    ],
    ["backgroundSize", style.backgroundSize ?? fallbackSize],
    ["backgroundRepeat", repeat],
    ["backgroundPosition", style.backgroundPosition ?? "center"],
  ];
}

function renderStyleObject(entries: StyleEntries, framework: ComponentExportFramework) {
  const renderedEntries = entries
    .filter((entry): entry is [string, StyleValue] => entry[1] !== undefined)
    .map(([key, value]) => {
      const outputKey = framework === "solid" ? camelToKebab(key) : key;
      return `${renderObjectKey(outputKey)}: ${typeof value === "number" ? value : stringLiteral(value)}`;
    });

  return `{ ${renderedEntries.join(", ")} }`;
}

function renderObjectKey(key: string) {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : stringLiteral(key);
}

function createSceneExportTargets(scenes: SpriteScene[]): SceneExportTarget[] {
  const usedComponents = new Set<string>();
  const usedFiles = new Set<string>();

  return scenes.map((scene, index) => {
    const fallback = `Scene${index + 1}`;
    const componentName = uniqueName(toPascalCase(scene.name) || fallback, usedComponents);
    const fileName = `${uniqueName(toKebabCase(scene.name) || `scene-${index + 1}`, usedFiles)}.tsx`;

    return {
      scene,
      componentName,
      fileName,
    };
  });
}

function uniqueName(base: string, used: Set<string>) {
  let next = base;
  let index = 2;

  while (used.has(next)) {
    next = `${base}${index}`;
    index += 1;
  }

  used.add(next);
  return next;
}

function toPascalCase(value: string) {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const name = words.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join("");
  if (!name || /^[0-9]/.test(name)) return "";
  return name;
}

function toKebabCase(value: string) {
  return (value.match(/[A-Za-z0-9]+/g) ?? []).map((word) => word.toLowerCase()).join("-");
}

function createSingleFileName(projectName: string | undefined) {
  const base = projectName ? toKebabCase(projectName) : "";
  return `${base || "sprite-scenes"}.tsx`;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

function camelToKebab(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function px(value: number) {
  return `${value}px`;
}

function stringLiteral(value: string) {
  return JSON.stringify(value);
}
