import { describe, expect, it } from "vite-plus/test";
import {
  calculateResizeBounds,
  calculateRotationFromPointer,
  hitTestMarquee,
  snapToGrid,
} from "./geometry";

describe("geometry", () => {
  it("snaps values to the active grid", () => {
    expect(snapToGrid(33, 16)).toBe(32);
    expect(snapToGrid(40, 16)).toBe(48);
  });

  it("normalizes rotation and supports shift snapping", () => {
    const quarterTurn = Math.PI / 2;
    expect(calculateRotationFromPointer(170, 0, quarterTurn, false)).toBe(-100);
    expect(calculateRotationFromPointer(10, 0, quarterTurn, true)).toBe(105);
  });

  it("keeps aspect ratio by default and allows free-form resize", () => {
    expect(
      calculateResizeBounds({
        handle: "se",
        origin: { x: 10, y: 20, width: 64, height: 32 },
        deltaX: 16,
        deltaY: 4,
        gridSize: 16,
        keepAspect: true,
      }),
    ).toEqual({ x: 10, y: 20, width: 80, height: 40 });

    expect(
      calculateResizeBounds({
        handle: "nw",
        origin: { x: 10, y: 20, width: 64, height: 32 },
        deltaX: 20,
        deltaY: 10,
        gridSize: 16,
        keepAspect: false,
      }),
    ).toEqual({ x: 30, y: 30, width: 44, height: 22 });
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
