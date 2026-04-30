import { Ratio, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { SpriteScene } from "@msviderok/sprite-editor-ast-schema";
import { readImageSize } from "@/editor/assets";
import { useEditorState } from "@/editor/useEditorState";
import { Button } from "@/components/ui/button";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AssetDimensionSourcePopoverContent } from "./AssetDimensionSourcePopover";

type SceneBackgroundToolbarProps = {
  scene: SpriteScene;
  pan: { x: number; y: number };
  zoom: number;
  selected: boolean;
};

function extractBackgroundUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const match = value.match(/url\(["']?([^"')]+)["']?\)/);
  return match ? match[1] : null;
}

export function SceneBackgroundToolbar(props: SceneBackgroundToolbarProps) {
  const { scene, pan, selected } = props;
  const { mutate, updateScene } = useEditorState();
  const url = extractBackgroundUrl(scene.backgroundStyle.backgroundImage);

  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [dimensionOpen, setDimensionOpen] = useState(false);

  useEffect(() => {
    if (!url) {
      setSize(null);
      return;
    }
    let cancelled = false;
    void readImageSize(url)
      .then((measured) => {
        if (!cancelled) setSize(measured);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    setDimensionOpen(false);
  }, [scene.id, selected]);

  if (!selected || !url) return null;

  const left = pan.x;
  const top = Math.max(10, pan.y - 32);

  const clearSelection = () => {
    mutate((draft) => {
      draft.backgroundSelected = false;
    });
  };

  const removeBackground = () => {
    updateScene((draft) => {
      draft.backgroundStyle.backgroundImage = undefined;
      draft.backgroundStyle.backgroundSize = undefined;
      draft.backgroundStyle.backgroundRepeat = undefined;
      draft.backgroundStyle.backgroundPosition = undefined;
    });
    clearSelection();
  };

  return (
    <div
      className="absolute z-50 flex items-center gap-0.5 border border-white/12 bg-[#1f1f1f] p-[3px] shadow-[3px_3px_0_#000]"
      style={{ left: `${left}px`, top: `${top}px` }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <PopoverRoot open={dimensionOpen} onOpenChange={setDimensionOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    aria-pressed={dimensionOpen || undefined}
                    className={`grid h-6 w-6 place-items-center border border-white/12 bg-[#232323] text-white/58 transition-colors hover:border-white/22 hover:text-white ${
                      dimensionOpen
                        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,#232323)] text-[var(--accent)]"
                        : ""
                    }`}
                  >
                    <Ratio className="h-3.5 w-3.5" />
                  </Button>
                }
              />
            }
          />
          <TooltipContent>Use as scene dimension source</TooltipContent>
        </Tooltip>
        <PopoverContent
          side="bottom"
          sideOffset={8}
          align="start"
          className="w-80 border-white/14 bg-[#1a1a1a] text-foreground"
        >
          {size ? (
            <AssetDimensionSourcePopoverContent
              assetUrl={url}
              width={size.width}
              height={size.height}
              onClose={() => setDimensionOpen(false)}
            />
          ) : (
            <div className="font-mono text-[11px] text-white/45">Measuring image…</div>
          )}
        </PopoverContent>
      </PopoverRoot>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              className="grid h-6 w-6 place-items-center border border-white/12 bg-[#232323] text-white/58 transition-colors hover:border-[#e76464] hover:text-[#e76464]"
              onClick={removeBackground}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <TooltipContent>Remove background</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              className="grid h-6 w-6 place-items-center border border-white/12 bg-[#232323] text-white/58 transition-colors hover:border-white/22 hover:text-white"
              onClick={clearSelection}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <TooltipContent>Deselect</TooltipContent>
      </Tooltip>
    </div>
  );
}
