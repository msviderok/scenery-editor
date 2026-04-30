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

type SceneAssetComponent = {
  assetId: string;
  componentName: string;
  asset: SpriteAsset | undefined;
};

type StyleValue = string | number;
type StyleEntries = Array<[string, StyleValue | undefined]>;
type AssetComponentPropValue = string | boolean | null | Record<string, boolean>;

const SCENE_CLASS = "relative shrink-0 overflow-hidden [image-rendering:pixelated]";
const ASSET_LAYER_CLASS = "absolute inset-0";
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
    return targets.map((target) => ({
      fileName: target.fileName,
      content: renderSceneFile(project, target, options.framework),
      mimeType: "text/typescript-jsx" as const,
    }));
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
  return `${renderTypeImport(framework)}

${renderAssetComponentPropsType()}

${targets
  .map((target) => renderSceneComponent(project, target.scene, target.componentName, framework))
  .join("\n\n")}
`;
}

function renderSceneFile(
  project: SpriteProject,
  target: SceneExportTarget,
  framework: ComponentExportFramework,
) {
  return `${renderTypeImport(framework)}

${renderAssetComponentPropsType()}

${renderSceneComponent(project, target.scene, target.componentName, framework)}
`;
}

function renderTypeImport(framework: ComponentExportFramework) {
  return framework === "solid"
    ? 'import { type ParentProps } from "solid-js";'
    : 'import { type PropsWithChildren } from "react";';
}

function renderAssetComponentPropsType() {
  return `type AssetComponentProps = {
  backgroundColor?: string;
  backgroundSize?: string;
  backgroundRepeat?: string;
  backgroundPosition?: string;
  flipH?: boolean;
  flipV?: boolean;
  tint?: string | null;
  collisions?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
};`;
}

function renderSceneComponent(
  project: SpriteProject,
  scene: SpriteScene,
  componentName: string,
  framework: ComponentExportFramework,
) {
  const classAttr = framework === "solid" ? "class" : "className";
  const signature =
    framework === "solid"
      ? `${componentName}(props: ParentProps<{}>)`
      : `${componentName}({ children }: PropsWithChildren<{}>)`;
  const childrenExpression = framework === "solid" ? "props.children" : "children";
  const assetComponents = createSceneAssetComponents(scene, project, componentName);
  const assetComponentById = new Map(
    assetComponents.map((component) => [component.assetId, component]),
  );
  const renderedAssetComponents = assetComponents
    .map((component) => renderAssetComponent(component, framework))
    .join("\n\n");

  return `${renderedAssetComponents}

export function ${signature} {
  return (
    <div
      ${classAttr}=${stringLiteral(SCENE_CLASS)}
      style={${renderStyleObject(createSceneStyleEntries(scene.backgroundStyle, scene), framework)}}
    >
      <div ${classAttr}=${stringLiteral(ASSET_LAYER_CLASS)}>
${scene.nodes
  .map((node) => renderNode(node, assetComponentById.get(node.assetId), framework, 8))
  .join("\n")}
      </div>
      {${childrenExpression}}
    </div>
  );
}`;
}

function renderNode(
  node: SpriteNode,
  assetComponent: SceneAssetComponent | undefined,
  framework: ComponentExportFramework,
  indentSize: number,
) {
  const classAttr = framework === "solid" ? "class" : "className";
  const indent = " ".repeat(indentSize);
  const childIndent = " ".repeat(indentSize + 2);
  const componentName = assetComponent?.componentName ?? "MissingAsset";
  const props = renderComponentProps(createAssetComponentProps(node));
  const lines = [
    `${indent}<div`,
    `${indent}  ${classAttr}=${stringLiteral(NODE_CLASS)}`,
    `${indent}  style={${renderStyleObject(createNodeStyleEntries(node), framework)}}`,
    `${indent}>`,
    `${childIndent}<${componentName}${props} />`,
  ];

  lines.push(`${indent}</div>`);
  return lines.join("\n");
}

function renderAssetComponent(component: SceneAssetComponent, framework: ComponentExportFramework) {
  const classAttr = framework === "solid" ? "class" : "className";
  const styleEntries = createAssetComponentStyleEntries(component.asset, framework);
  const missingAssetUrl = !getAssetUrl(component.asset);
  const fallbackLabel = component.asset?.fileName ?? component.assetId;

  return `function ${component.componentName}(props: AssetComponentProps) {
  const hasCollision =
    props.collisions?.top ||
    props.collisions?.right ||
    props.collisions?.bottom ||
    props.collisions?.left;

  return (
    <>
      <div
        ${classAttr}=${stringLiteral(NODE_IMAGE_CLASS)}
        style={{ ${styleEntries.join(", ")} }}
      />
${missingAssetUrl ? `      <div ${classAttr}=${stringLiteral(MISSING_ASSET_CLASS)}>${escapeJsxText(fallbackLabel)}</div>\n` : ""}      {props.tint ? (
        <div ${classAttr}=${stringLiteral(TINT_CLASS)} style={{ background: props.tint }} />
      ) : null}
      {hasCollision ? <div ${classAttr}=${stringLiteral(COLLISION_CLASS)} /> : null}
    </>
  );
}`;
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

function createAssetComponentStyleEntries(
  asset: SpriteAsset | undefined,
  framework: ComponentExportFramework,
) {
  const fallbackSize =
    asset && asset.width > 0 && asset.height > 0
      ? `${asset.width}px ${asset.height}px`
      : "100% 100%";
  const assetUrl = getAssetUrl(asset);
  const backgroundImage = assetUrl ? `url("${assetUrl}")` : undefined;
  const entries = [
    ["backgroundColor", 'props.backgroundColor ?? "transparent"'],
    ["backgroundImage", backgroundImage ? stringLiteral(backgroundImage) : undefined],
    [
      "backgroundSize",
      `props.backgroundSize ?? (props.backgroundRepeat && props.backgroundRepeat !== "no-repeat" ? ${stringLiteral(
        fallbackSize,
      )} : "100% 100%")`,
    ],
    ["backgroundRepeat", 'props.backgroundRepeat ?? "no-repeat"'],
    ["backgroundPosition", 'props.backgroundPosition ?? "center"'],
    ["transform", "`scale(${props.flipH ? -1 : 1}, ${props.flipV ? -1 : 1})`"],
  ];

  return entries
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([key, value]) => {
      const outputKey = framework === "solid" ? camelToKebab(key) : key;
      return `${renderObjectKey(outputKey)}: ${value}`;
    });
}

function createAssetComponentProps(node: SpriteNode): Record<string, AssetComponentPropValue> {
  const props: Record<string, AssetComponentPropValue> = {};

  if (node.style.backgroundColor && node.style.backgroundColor !== "transparent") {
    props.backgroundColor = node.style.backgroundColor;
  }

  if (node.style.backgroundSize) {
    props.backgroundSize = node.style.backgroundSize;
  }

  if (node.style.backgroundRepeat && node.style.backgroundRepeat !== "no-repeat") {
    props.backgroundRepeat = node.style.backgroundRepeat;
  }

  if (node.style.backgroundPosition && node.style.backgroundPosition !== "center") {
    props.backgroundPosition = node.style.backgroundPosition;
  }

  if (node.flipH) {
    props.flipH = true;
  }

  if (node.flipV) {
    props.flipV = true;
  }

  if (node.tint) {
    props.tint = node.tint;
  }

  const collisions = Object.fromEntries(
    Object.entries(node.collisions).filter((entry): entry is [string, true] => entry[1] === true),
  );
  if (Object.keys(collisions).length > 0) {
    props.collisions = collisions;
  }

  return props;
}

function renderComponentProps(props: Record<string, AssetComponentPropValue>) {
  const rendered = Object.entries(props)
    .map(([name, value]) => renderJsxProp(name, value))
    .filter(Boolean);

  return rendered.length > 0 ? ` ${rendered.join(" ")}` : "";
}

function renderJsxProp(name: string, value: AssetComponentPropValue) {
  if (value === null) return "";
  if (typeof value === "string") return `${name}=${stringLiteral(value)}`;
  if (typeof value === "boolean") return value ? name : "";

  const entries = Object.entries(value)
    .filter((entry) => entry[1])
    .map(([key]) => `${key}: true`);
  return entries.length > 0 ? `${name}={{ ${entries.join(", ")} }}` : "";
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

function createSceneAssetComponents(
  scene: SpriteScene,
  project: SpriteProject,
  sceneComponentName: string,
): SceneAssetComponent[] {
  const usedAssetIds = new Set<string>();
  const usedComponentNames = new Set<string>();
  const components: SceneAssetComponent[] = [];

  for (const node of scene.nodes) {
    if (usedAssetIds.has(node.assetId)) continue;
    usedAssetIds.add(node.assetId);

    const asset = project.assets[node.assetId];
    const assetName = asset
      ? toComponentNamePart(asset.fileName) || toComponentNamePart(asset.id) || "Asset"
      : toComponentNamePart(node.assetId) || "Missing";
    const componentName = uniqueName(
      `${sceneComponentName}${assetName || "Missing"}Asset`,
      usedComponentNames,
    );

    components.push({
      assetId: node.assetId,
      componentName,
      asset,
    });
  }

  return components;
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

function toComponentNamePart(value: string) {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const name = words.map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join("");
  if (!name) return "";
  return /^[0-9]/.test(name) ? `Asset${name}` : name;
}

function toKebabCase(value: string) {
  return (value.match(/[A-Za-z0-9]+/g) ?? []).map((word) => word.toLowerCase()).join("-");
}

function createSingleFileName(projectName: string | undefined) {
  const base = projectName ? toKebabCase(projectName) : "";
  return `${base || "sprite-scenes"}.tsx`;
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

function escapeJsxText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
