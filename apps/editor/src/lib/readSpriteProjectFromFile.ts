import { parseSpriteProject, type SpriteProject } from "@msviderok/sprite-editor-ast-schema";

export async function readSpriteProjectFromFile(file: File | undefined): Promise<SpriteProject> {
  if (!file) {
    throw new Error("No file selected.");
  }

  const text = await file.text();
  return parseSpriteProject(JSON.parse(text));
}
