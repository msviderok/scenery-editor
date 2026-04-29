import { Button } from "@/components/ui/button";

type ImportedPreviewEmptyStateProps = {
  errorMessage: string | null;
  onSelectFile: () => void;
};

export function ImportedPreviewEmptyState({
  errorMessage,
  onSelectFile,
}: ImportedPreviewEmptyStateProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="space-y-2">
        <p className="font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
          Imported AST Preview
        </p>
        <h1 className="font-[var(--font-ui)] text-2xl font-semibold text-white">
          No imported AST loaded
        </h1>
        <p className="max-w-md text-sm text-white/60">
          Select a sprite AST JSON file to preview its first scene without replacing the current
          editor project.
        </p>
      </div>

      <Button variant="accent" type="button" onClick={onSelectFile}>
        Select scene file
      </Button>

      {errorMessage ? (
        <div className="max-w-md border border-[#e76464]/50 bg-[#281313] px-4 py-3 font-mono text-[11px] text-[#f0b1b1]">
          {errorMessage}
        </div>
      ) : null}
    </main>
  );
}
