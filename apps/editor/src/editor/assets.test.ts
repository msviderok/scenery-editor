import { describe, expect, it, vi } from "vite-plus/test";
import { createEmptyProject } from "@msviderok/sprite-editor-ast";
import { buildEmbeddedExportProject } from "./assets";

describe("assets", () => {
  it("embeds exported asset data and strips transient url/sourcePath fields", async () => {
    const project = createEmptyProject();
    project.assets.asset_1 = {
      id: "asset_1",
      kind: "image",
      fileName: "sprite.png",
      width: 16,
      height: 16,
      mimeType: "image/png",
      url: "/sprite.png",
    };

    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(new Blob(["sprite"], { type: "image/png" }), { status: 200 });
    });

    const exportedProject = await buildEmbeddedExportProject(project, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("/sprite.png");
    expect(exportedProject.assets.asset_1.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(exportedProject.assets.asset_1.url).toBeUndefined();
    expect(exportedProject.assets.asset_1.sourcePath).toBeUndefined();
  });
});
