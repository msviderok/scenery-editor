import { z } from "zod";

export const backgroundStyleSchema = z
  .object({
    backgroundColor: z.string().optional(),
    backgroundImage: z.string().optional(),
    backgroundSize: z.string().optional(),
    backgroundRepeat: z.string().optional(),
    backgroundPosition: z.string().optional(),
  })
  .strict();

export const collisionSchema = z
  .object({
    top: z.boolean(),
    right: z.boolean(),
    bottom: z.boolean(),
    left: z.boolean(),
  })
  .strict();

export const spriteAssetSchema = z
  .object({
    id: z.string(),
    kind: z.literal("image"),
    fileName: z.string(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    mimeType: z.string().optional(),
    sourcePath: z.string().optional(),
    dataUrl: z.string().optional(),
    url: z.string().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.sourcePath && !value.dataUrl && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Asset must include either sourcePath, dataUrl, or url.",
      });
    }
  });

export const spriteNodeSchema = z
  .object({
    id: z.string(),
    assetId: z.string(),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite(),
    opacity: z.number().finite().min(0).max(1),
    locked: z.boolean(),
    flipH: z.boolean().default(false),
    flipV: z.boolean().default(false),
    tint: z.string().nullable().default(null),
    collisions: collisionSchema,
    style: backgroundStyleSchema,
  })
  .strict();

export const spriteSceneSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    size: z
      .object({
        width: z.number().finite().positive(),
        height: z.number().finite().positive(),
      })
      .strict(),
    backgroundStyle: backgroundStyleSchema,
    nodes: z.array(spriteNodeSchema),
  })
  .strict();

export const spriteProjectSchema = z
  .object({
    schemaVersion: z.literal(1),
    assets: z.record(z.string(), spriteAssetSchema),
    scenes: z.array(spriteSceneSchema).min(1),
  })
  .strict();

export type BackgroundStyle = z.infer<typeof backgroundStyleSchema>;
export type SpriteCollision = z.infer<typeof collisionSchema>;
export type SpriteAsset = z.infer<typeof spriteAssetSchema>;
export type SpriteNode = z.infer<typeof spriteNodeSchema>;
export type SpriteScene = z.infer<typeof spriteSceneSchema>;
export type SpriteProject = z.infer<typeof spriteProjectSchema>;

export type ResolvedSpriteAsset = SpriteAsset & {
  resolvedUrl: string;
};

export type ResolvedSpriteProject = Omit<SpriteProject, "assets"> & {
  assets: Record<string, ResolvedSpriteAsset>;
};

export function createDefaultCollision(): SpriteCollision {
  return {
    top: false,
    right: false,
    bottom: false,
    left: false,
  };
}

export function hasAnyCollision(collision: SpriteCollision): boolean {
  return collision.top || collision.right || collision.bottom || collision.left;
}

export function createDefaultScene(id = "scene_1", name = "Scene 1"): SpriteScene {
  return {
    id,
    name,
    size: {
      width: 1280,
      height: 720,
    },
    backgroundStyle: {
      backgroundColor: "#111220",
    },
    nodes: [],
  };
}

export function createEmptyProject(): SpriteProject {
  return {
    schemaVersion: 1,
    assets: {},
    scenes: [createDefaultScene()],
  };
}

export function parseSpriteProject(input: unknown): SpriteProject {
  return spriteProjectSchema.parse(input);
}

export function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const mod = ((value % 360) + 360) % 360;
  return mod > 180 ? mod - 360 : mod;
}

function normalizeBackgroundStyle(style: BackgroundStyle): BackgroundStyle {
  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    backgroundSize: style.backgroundSize,
    backgroundRepeat: style.backgroundRepeat,
    backgroundPosition: style.backgroundPosition,
  };
}

function normalizeCollision(collision: SpriteCollision): SpriteCollision {
  return {
    top: collision.top,
    right: collision.right,
    bottom: collision.bottom,
    left: collision.left,
  };
}

function normalizeSpriteProject(project: SpriteProject): SpriteProject {
  return {
    schemaVersion: project.schemaVersion,
    assets: Object.fromEntries(
      Object.entries(project.assets).map(([assetId, asset]) => [
        assetId,
        {
          id: asset.id,
          kind: asset.kind,
          fileName: asset.fileName,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType,
          sourcePath: asset.sourcePath,
          dataUrl: asset.dataUrl,
          url: asset.url,
        },
      ]),
    ),
    scenes: project.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      size: {
        width: scene.size.width,
        height: scene.size.height,
      },
      backgroundStyle: normalizeBackgroundStyle(scene.backgroundStyle),
      nodes: scene.nodes.map((node) => ({
        id: node.id,
        assetId: node.assetId,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        rotation: node.rotation,
        opacity: node.opacity,
        locked: node.locked,
        flipH: node.flipH ?? false,
        flipV: node.flipV ?? false,
        tint: node.tint ?? null,
        collisions: normalizeCollision(node.collisions),
        style: normalizeBackgroundStyle(node.style),
      })),
    })),
  };
}

export function serializeSpriteProject(project: SpriteProject): string {
  return JSON.stringify(spriteProjectSchema.parse(normalizeSpriteProject(project)), null, 2);
}
