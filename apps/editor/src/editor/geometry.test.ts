import { describe, expect, it } from "vite-plus/test";
import {
  clampGridSize,
  calculateResizeBounds,
  calculateRotationFromPointer,
  hitTestMarquee,
  restoreAspectRatio,
  snapToGrid,
} from "./geometry";

describe("geometry", () => {
  it("snaps values to the active grid", () => {
    expect(snapToGrid(33, 16)).toBe(32);
    expect(snapToGrid(40, 16)).toBe(48);
  });

  it("snaps grid sizes to the supported breakpoints", () => {
    expect(clampGridSize(1)).toBe(2);
    expect(clampGridSize(3)).toBe(2);
    expect(clampGridSize(5)).toBe(4);
    expect(clampGridSize(10)).toBe(8);
    expect(clampGridSize(14)).toBe(12);
    expect(clampGridSize(19)).toBe(20);
    expect(clampGridSize(27)).toBe(28);
    expect(clampGridSize(99)).toBe(32);
  });

  it("normalizes rotation and supports shift snapping", () => {
    const quarterTurn = Math.PI / 2;
    expect(calculateRotationFromPointer(170, 0, quarterTurn, false)).toBe(-100);
    expect(calculateRotationFromPointer(10, 0, quarterTurn, true)).toBe(105);
  });

  it("snaps resize to grid while preserving aspect ratio by default", () => {
    expect(
      calculateResizeBounds({
        handle: "se",
        origin: { x: 10, y: 20, width: 64, height: 32 },
        deltaX: 16,
        deltaY: 4,
        gridSize: 16,
        freeForm: false,
      }),
    ).toEqual({ x: 10, y: 20, width: 80, height: 40 });
  });

  it("allows free-form resize with shift", () => {
    expect(
      calculateResizeBounds({
        handle: "nw",
        origin: { x: 10, y: 20, width: 64, height: 32 },
        deltaX: 20,
        deltaY: 10,
        gridSize: 16,
        freeForm: true,
      }),
    ).toEqual({ x: 30, y: 30, width: 44, height: 22 });
  });

  it("restores the closest size for the original aspect ratio", () => {
    expect(restoreAspectRatio({ width: 100, height: 100 }, { width: 64, height: 32 })).toEqual({
      width: 100,
      height: 50,
    });
    expect(restoreAspectRatio({ width: 30, height: 100 }, { width: 64, height: 32 })).toEqual({
      width: 30,
      height: 15,
    });
    expect(restoreAspectRatio({ width: 40, height: 220 }, { width: 32, height: 64 })).toEqual({
      width: 110,
      height: 220,
    });
  });

  it("hit-tests marquee selection against node bounds", () => {
    const nodes = [
      {
        id: "node_1",
        assetId: "asset_1",
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        rotation: 0,
        opacity: 1,
        locked: false,
        flipH: false,
        flipV: false,
        tint: null,
        collisions: { top: false, right: false, bottom: false, left: false },
        style: {},
      },
      {
        id: "node_2",
        assetId: "asset_2",
        x: 100,
        y: 100,
        width: 32,
        height: 32,
        rotation: 0,
        opacity: 1,
        locked: false,
        flipH: false,
        flipV: false,
        tint: null,
        collisions: { top: false, right: false, bottom: false, left: false },
        style: {},
      },
    ];

    expect(hitTestMarquee(nodes, { x: 10, y: 10, width: 70, height: 70 })).toEqual(["node_1"]);
    expect(hitTestMarquee(nodes, { x: 90, y: 90, width: 64, height: 64 })).toEqual(["node_2"]);
  });
});
