import { normalizeRotation, type SpriteNode } from "@msviderok/sprite-editor-ast-schema";
import {
  DEFAULT_GRID_SIZE,
  DEFAULT_VIEWPORT_SCALE,
  GRID_SIZE_BREAKPOINTS,
  MAX_GRID_SIZE,
  MAX_VIEWPORT_SCALE,
  MIN_GRID_SIZE,
  MIN_NODE_SIZE,
  MIN_VIEWPORT_SCALE,
  WORKSPACE_PADDING,
} from "./constants";
import type { Interaction, MarqueeRect, ResizeHandle } from "./types";

export function nextId(prefix: string, ids: string[]) {
  const used = new Set(ids);
  let index = 1;
  while (used.has(`${prefix}_${index}`)) {
    index += 1;
  }
  return `${prefix}_${index}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampViewportScale(value: number) {
  return clamp(value, MIN_VIEWPORT_SCALE, MAX_VIEWPORT_SCALE);
}

export function clampGridSize(value: number) {
  const clampedValue = clamp(value, MIN_GRID_SIZE, MAX_GRID_SIZE);
  return GRID_SIZE_BREAKPOINTS.reduce((closest, breakpoint) => {
    return Math.abs(breakpoint - clampedValue) < Math.abs(closest - clampedValue)
      ? breakpoint
      : closest;
  }, GRID_SIZE_BREAKPOINTS[0]);
}

export function normalizeViewportScale(value: unknown) {
  return clampViewportScale(
    typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_VIEWPORT_SCALE,
  );
}

export function normalizeGridSize(value: unknown) {
  return clampGridSize(
    typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_GRID_SIZE,
  );
}

export function snapToGrid(value: number, grid: number) {
  return Math.round(value / grid) * grid;
}

export function swapAtIndex<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function getMarqueeRect(interaction: Interaction | null): MarqueeRect | null {
  if (!interaction || interaction.type !== "marquee") return null;
  const x = Math.min(interaction.originX, interaction.currentX);
  const y = Math.min(interaction.originY, interaction.currentY);
  const width = Math.abs(interaction.currentX - interaction.originX);
  const height = Math.abs(interaction.currentY - interaction.originY);
  return { x, y, width, height };
}

export function hitTestMarquee(nodes: SpriteNode[], rect: MarqueeRect) {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;

  return nodes
    .filter(
      (node) =>
        node.x < maxX && node.x + node.width > minX && node.y < maxY && node.y + node.height > minY,
    )
    .map((node) => node.id);
}

export function calculateToolbarPosition(node: SpriteNode, viewportScale: number) {
  return {
    left: (WORKSPACE_PADDING + node.x) * viewportScale,
    top: (WORKSPACE_PADDING + node.y) * viewportScale - 8,
  };
}

export function calculateRotationFromPointer(
  startRotation: number,
  startAngle: number,
  currentAngle: number,
  snapToIncrement: boolean,
) {
  const deltaDeg = ((currentAngle - startAngle) * 180) / Math.PI;
  let next = normalizeRotation(startRotation + deltaDeg);
  if (snapToIncrement) next = Math.round(next / 15) * 15;
  return next;
}

export function calculateResizeBounds(params: {
  handle: ResizeHandle;
  origin: { x: number; y: number; width: number; height: number };
  deltaX: number;
  deltaY: number;
  gridSize: number;
  keepAspect: boolean;
}) {
  const { handle, origin, deltaX, deltaY, gridSize, keepAspect } = params;
  let rawW = origin.width;
  let rawH = origin.height;

  if (handle.includes("e")) rawW = origin.width + deltaX;
  if (handle.includes("w")) rawW = origin.width - deltaX;
  if (handle.includes("s")) rawH = origin.height + deltaY;
  if (handle.includes("n")) rawH = origin.height - deltaY;

  let nextWidth: number;
  let nextHeight: number;
  const aspectRatio = origin.width / origin.height;

  if (keepAspect && aspectRatio > 0) {
    const scaleFromW = rawW / origin.width;
    const scaleFromH = rawH / origin.height;
    const scaleFactor =
      Math.abs(scaleFromW - 1) >= Math.abs(scaleFromH - 1) ? scaleFromW : scaleFromH;
    let snappedW = Math.max(MIN_NODE_SIZE, snapToGrid(origin.width * scaleFactor, gridSize));
    const snapScale = snappedW / origin.width;
    let snappedH = Math.max(MIN_NODE_SIZE, Math.round(origin.height * snapScale));
    if (snappedH === MIN_NODE_SIZE && snappedW !== MIN_NODE_SIZE) {
      snappedW = Math.max(MIN_NODE_SIZE, Math.round(snappedH * aspectRatio));
    }
    nextWidth = snappedW;
    nextHeight = snappedH;
  } else {
    nextWidth = Math.max(MIN_NODE_SIZE, rawW);
    nextHeight = Math.max(MIN_NODE_SIZE, rawH);
  }

  let nextX = origin.x;
  let nextY = origin.y;
  if (handle.includes("w")) nextX = origin.x + (origin.width - nextWidth);
  if (handle.includes("n")) nextY = origin.y + (origin.height - nextHeight);

  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight),
  };
}
