import { describe, expect, it } from "vite-plus/test";
import { readSpriteProjectFromFile } from "./readSpriteProjectFromFile";

describe("readSpriteProjectFromFile", () => {
  it("parses a valid sprite project file", async () => {
    const file = new File(
      [
        JSON.stringify({
          schemaVersion: 1,
          assets: {},
          scenes: [
            {
              id: "scene_1",
              name: "Scene 1",
              size: { width: 1280, height: 720 },
              backgroundStyle: { backgroundColor: "#111220" },
              nodes: [],
            },
          ],
        }),
      ],
      "scene.sprite.json",
      { type: "application/json" },
    );

    const project = await readSpriteProjectFromFile(file);

    expect(project.scenes[0]?.id).toBe("scene_1");
  });

  it("throws for invalid JSON", async () => {
    const file = new File(["not-json"], "broken.json", { type: "application/json" });

    await expect(readSpriteProjectFromFile(file)).rejects.toThrow();
  });

  it("throws for schema-invalid payloads", async () => {
    const file = new File(
      [JSON.stringify({ schemaVersion: 1, assets: {}, scenes: [] })],
      "bad.json",
      {
        type: "application/json",
      },
    );

    await expect(readSpriteProjectFromFile(file)).rejects.toThrow();
  });
});
