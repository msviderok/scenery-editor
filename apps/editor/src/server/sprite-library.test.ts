import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { listSpriteEntries, resolveSpriteFile } from "./sprite-library";

const tempDirs: string[] = [];

async function createTempSpritesDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sprite-library-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("sprite-library", () => {
  it("sorts manifest entries by relative path", async () => {
    const root = await createTempSpritesDir();
    await mkdir(path.join(root, "nested"), { recursive: true });
    await writeFile(path.join(root, "z.png"), "z");
    await writeFile(path.join(root, "nested", "a.png"), "a");

    const entries = await listSpriteEntries(root);

    expect(entries.map((entry) => entry.relativePath)).toEqual(["nested/a.png", "z.png"]);
  });

  it("rejects traversal outside the sprites root", async () => {
    const root = await createTempSpritesDir();

    const result = await resolveSpriteFile("../secret.png", root);

    expect(result).toEqual({ kind: "forbidden" });
  });
});
