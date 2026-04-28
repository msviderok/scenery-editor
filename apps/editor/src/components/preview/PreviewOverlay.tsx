import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorState } from "@/editor/useEditorState";
import { PreviewScene } from "./PreviewScene";

export function PreviewOverlay() {
  const { state, dispatch, selectors } = useEditorState();

  useEffect(() => {
    if (!state.previewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dispatch({ type: "setPreviewOpen", previewOpen: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.previewOpen, dispatch]);

  if (!state.previewOpen) return null;

  const scene = selectors.selectedScene;
  if (!scene) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <PreviewScene project={state.project} scene={scene} />

      <div className="fixed top-4 right-4 z-10 flex gap-2">
        <Button
          variant="muted"
          size="compact"
          type="button"
          onClick={() => dispatch({ type: "setPreviewOpen", previewOpen: false })}
        >
          <X className="h-3.5 w-3.5" />
          Close
        </Button>
      </div>
    </div>
  );
}
