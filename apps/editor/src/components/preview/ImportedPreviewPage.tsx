import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { SpriteProject } from "@msviderok/sprite-editor-ast-schema";
import { ArrowLeft, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImportedPreviewPayload } from "@/lib/importedPreviewState";
import { readSpriteProjectFromFile } from "@/lib/readSpriteProjectFromFile";
import { ImportedPreviewEmptyState } from "./ImportedPreviewEmptyState";
import { PreviewScene } from "./PreviewScene";

export function ImportedPreviewPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const importedPreview = useLocation({
    select: (location) => getImportedPreviewPayload(location.state),
  });

  const [project, setProject] = useState<SpriteProject | null>(importedPreview?.project ?? null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(
    importedPreview?.sourceFileName ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!importedPreview) {
      return;
    }

    setProject(importedPreview.project);
    setSourceFileName(importedPreview.sourceFileName);
    setErrorMessage(null);
  }, [importedPreview]);

  const scene = project?.scenes[0] ?? null;

  const openPicker = () => fileInputRef.current?.click();

  const clearImportedPreview = () => {
    setProject(null);
    setSourceFileName(null);
    setErrorMessage(null);
    void navigate({
      to: "/preview/imported",
      replace: true,
      state: (prev) => ({
        ...prev,
        importedPreview: undefined,
      }),
    });
  };

  const handleFileSelection = async (file: File | undefined) => {
    if (!file) return;

    try {
      const nextProject = await readSpriteProjectFromFile(file);
      setProject(nextProject);
      setSourceFileName(file.name);
      setErrorMessage(null);
      void navigate({
        to: "/preview/imported",
        replace: true,
        state: (prev) => ({
          ...prev,
          importedPreview: {
            project: nextProject,
            sourceFileName: file.name,
          },
        }),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to parse AST.");
    }
  };

  if (!project || !scene) {
    return (
      <>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".json,.sprite.json,application/json"
          onChange={(event) => {
            void handleFileSelection(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <ImportedPreviewEmptyState errorMessage={errorMessage} onSelectFile={openPicker} />
      </>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept=".json,.sprite.json,application/json"
        onChange={(event) => {
          void handleFileSelection(event.currentTarget.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      <PreviewScene project={project} scene={scene} />

      <div className="fixed top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-[0.35rem] border border-white/14 bg-[#232323] px-[0.7rem] py-[0.25rem] font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 shadow-[2px_2px_0_#000] transition-colors duration-[120ms] hover:border-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Editor
        </Link>
        <Button variant="muted" size="compact" type="button" onClick={openPicker}>
          <Upload className="h-3.5 w-3.5" />
          Change file
        </Button>
        <Button variant="muted" size="compact" type="button" onClick={clearImportedPreview}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <div className="fixed top-4 right-4 z-10 max-w-sm text-right">
        <div className="border border-white/14 bg-[#1a1a1a]/90 px-3 py-2 shadow-[2px_2px_0_#000] backdrop-blur">
          <div className="font-[var(--font-ui)] text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
            Imported AST Preview
          </div>
          <div className="mt-1 text-sm text-white">{sourceFileName ?? "Untitled file"}</div>
          <div className="mt-1 font-mono text-[10px] text-white/45">
            Showing first scene: {scene.name}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-2 border border-[#e76464]/50 bg-[#281313] px-3 py-2 font-mono text-[11px] text-[#f0b1b1]">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </main>
  );
}
