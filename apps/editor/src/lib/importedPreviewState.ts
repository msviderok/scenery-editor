import type { SpriteProject } from "@msviderok/sprite-editor-ast-schema";

export type ImportedPreviewPayload = {
  project: SpriteProject;
  sourceFileName: string;
};

export type ImportedPreviewHistoryState = {
  importedPreview?: ImportedPreviewPayload;
};

export function getImportedPreviewPayload(state: unknown): ImportedPreviewPayload | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = state as ImportedPreviewHistoryState;
  if (!candidate.importedPreview) {
    return null;
  }

  return candidate.importedPreview;
}
