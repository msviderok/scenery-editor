import { useEditorState } from "@/editor/useEditorState";
import { Button } from "@/components/ui/button";

type AssetDimensionSourcePopoverContentProps = {
  assetUrl: string;
  width: number;
  height: number;
  onClose: () => void;
};

export function AssetDimensionSourcePopoverContent(props: AssetDimensionSourcePopoverContentProps) {
  const { assetUrl, width, height, onClose } = props;
  const { state, updateScene } = useEditorState();

  const scene =
    state.project.scenes.find((entry) => entry.id === state.selectedSceneId) ??
    state.project.scenes[0];

  const sceneWidth = scene?.size.width ?? 0;
  const sceneHeight = scene?.size.height ?? 0;
  const newSceneWidth = height > 0 ? Math.max(1, Math.round((width * sceneHeight) / height)) : 0;
  const matchesScene = width === sceneWidth && height === sceneHeight;
  const canApply = Boolean(scene && assetUrl);

  const apply = () => {
    if (!canApply) return;
    updateScene((draft) => {
      draft.size.width = newSceneWidth;
      draft.backgroundStyle.backgroundImage = `url("${assetUrl}")`;
      draft.backgroundStyle.backgroundSize = "100% 100%";
      draft.backgroundStyle.backgroundRepeat = "no-repeat";
      draft.backgroundStyle.backgroundPosition = "center";
    });
    onClose();
  };

  const repeat = () => {
    if (!canApply) return;
    updateScene((draft) => {
      draft.backgroundStyle.backgroundImage = `url("${assetUrl}")`;
      draft.backgroundStyle.backgroundSize = `${width}px ${height}px`;
      draft.backgroundStyle.backgroundRepeat = "repeat";
      draft.backgroundStyle.backgroundPosition = "top left";
    });
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="font-[var(--font-ui)] text-[11px] font-bold uppercase tracking-[0.14em] text-white/68">
        Dimension source
      </div>

      <div className="flex flex-col gap-1.5 font-mono text-[11px] text-white/72">
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/45">Scene</span>
          <span>
            {sceneWidth} × {sceneHeight}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-white/45">Asset</span>
          <span className="truncate">
            {width} × {height}
          </span>
        </div>
      </div>

      {matchesScene ? (
        <div className="border-l-2 border-[var(--accent)]/60 bg-white/[0.03] px-2 py-1.5 font-mono text-[11px] text-white/68">
          Asset already matches scene size.
        </div>
      ) : (
        <div className="flex flex-col gap-1 border-l-2 border-[var(--accent)]/60 bg-white/[0.03] px-2 py-1.5 font-mono text-[11px] text-white/72">
          <span className="text-white/45">Scaling asset to scene height ({sceneHeight}px) →</span>
          <span className="font-bold text-[var(--accent)]">
            new scene size: {newSceneWidth} × {sceneHeight}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="accent"
          size="compact"
          className="flex-1"
          disabled={!canApply}
          onClick={apply}
        >
          Apply
        </Button>
        <Button
          type="button"
          variant="muted"
          size="compact"
          className="flex-1"
          disabled={!canApply}
          onClick={repeat}
        >
          Repeat
        </Button>
        <Button type="button" variant="muted" size="compact" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
